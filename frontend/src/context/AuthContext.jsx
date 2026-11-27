
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

const AUTH_URL = `${API_URL}/api/auth`;

// Share simultaneous CSRF and refresh requests.
let csrfRequestPromise = null;
let refreshRequestPromise = null;

// Normalize user data returned by the backend.
function normalizeUser(user) {
  if (!user) return null;

  return {
    userId: user.userId ?? user.user_id,
    fullName: user.fullName ?? user.full_name,
    email: user.email,
    role: user.role,
  };
}

// Read the error message returned by the backend.
async function getErrorMessage(response) {
  const data = await response.json().catch(() => ({}));

  return data.message || "Something went wrong. Please try again.";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Request a CSRF token from the backend.
  const getCsrfToken = useCallback(async () => {
    if (csrfRequestPromise) {
      return csrfRequestPromise;
    }

    csrfRequestPromise = (async () => {
      const response = await fetch(`${AUTH_URL}/csrf`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to initialize security token.");
      }

      const data = await response.json();
      const token = data.csrfToken || data.token;

      if (!token) {
        throw new Error("CSRF token was not returned by the server.");
      }

      return token;
    })();

    try {
      return await csrfRequestPromise;
    } finally {
      csrfRequestPromise = null;
    }
  }, []);

  // Restore the user's session using the refresh token cookie.
  const refreshSession = useCallback(async () => {
    // Reuse an existing refresh request if one is already running.
    if (refreshRequestPromise) {
      return refreshRequestPromise;
    }

    refreshRequestPromise = (async () => {
      const token = await getCsrfToken();

      const response = await fetch(`${AUTH_URL}/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      if (!data.accessToken || !data.user) {
        throw new Error("Invalid session response from server.");
      }

      setAccessToken(data.accessToken);
      setUser(normalizeUser(data.user));

      return data;
    })();

    try {
      return await refreshRequestPromise;
    } finally {
      refreshRequestPromise = null;
    }
  }, [getCsrfToken]);

  // Log in with email and password.
  const login = useCallback(
    async (email, password) => {
      const token = await getCsrfToken();

      const response = await fetch(`${AUTH_URL}/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      const data = await response.json();

      if (!data.accessToken || !data.user) {
        throw new Error("Invalid login response from server.");
      }

      setAccessToken(data.accessToken);
      setUser(normalizeUser(data.user));

      return data;
    },
    [getCsrfToken]
  );

  // Log out and clear the local authentication state.
  const logout = useCallback(async () => {
    try {
      const token = await getCsrfToken();

      const response = await fetch(`${AUTH_URL}/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
        },
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, [getCsrfToken]);

  // Send authenticated requests to the backend.
  const apiFetch = useCallback(
    async (url, options = {}) => {
      const send = (token) => {
        const headers = new Headers(options.headers || {});
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetch(url, { ...options, headers, credentials: "include" });
      };

      let response = await send(accessToken);
      if (response.status === 401) {
        try {
          const refreshed = await refreshSession();
          response = await send(refreshed.accessToken);
        } catch {
          setUser(null);
          setAccessToken(null);
        }
      }
      return response;
    },
    [accessToken, refreshSession]
  );

  // Make public auth requests with the same CSRF and cookie policy.
  const authRequest = useCallback(async (path, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      headers.set("X-CSRF-Token", await getCsrfToken());
    }
    return fetch(`${AUTH_URL}/${path.replace(/^\/+/, "")}`, {
      ...options,
      method,
      headers,
      credentials: "include",
    });
  }, [getCsrfToken]);

  // Restore the session when the application starts.
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        await refreshSession();
      } catch {
        if (isMounted) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [refreshSession]);

  const value = {
    user,
    accessToken,
    authLoading,
    isAuthenticated: Boolean(user && accessToken),
    login,
    logout,
    refreshSession,
    apiFetch,
    authRequest,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Access authentication data from any component.
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
