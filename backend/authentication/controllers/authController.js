
const authService = require("../services/authService");

// Refresh token cookie configuration
const REFRESH_TOKEN_EXPIRES_IN_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 7
);

const isProduction = process.env.NODE_ENV === "production";

// Validate refresh token expiration configuration
if (
  !Number.isInteger(REFRESH_TOKEN_EXPIRES_IN_DAYS) ||
  REFRESH_TOKEN_EXPIRES_IN_DAYS < 1 ||
  REFRESH_TOKEN_EXPIRES_IN_DAYS > 90
) {
  throw new Error(
    "REFRESH_TOKEN_EXPIRES_IN_DAYS must be between 1 and 90."
  );
}

// Shared cookie options used by login, refresh and logout.
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/api/auth",
  maxAge:
    REFRESH_TOKEN_EXPIRES_IN_DAYS *
    24 *
    60 *
    60 *
    1000,
};

// Handle user login
async function login(req, res, next) {
  // Prevent browsers and intermediaries from caching authentication responses.
  res.set("Cache-Control", "no-store");

  try {
    const { email, password } = req.body || {};

    // Validate login input
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    // Authenticate the user
    const result = await authService.login({
      email,
      password,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Store refresh token in an HttpOnly cookie.
    res.cookie(
      "refreshToken",
      result.refreshToken,
      refreshCookieOptions
    );

    // Return user information and access token.
    // Never expose the refresh token in the response body.
    return res.status(200).json({
      message: "Login successful.",
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (error) {
    if (error.message === "Invalid email or password.") {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (
      error.message ===
        "Please verify your email before logging in." ||
      error.message === "Your account is not active."
    ) {
      return res.status(403).json({
        message: error.message,
      });
    }

    return next(error);
  }
}

module.exports = {
  login,
  refreshCookieOptions,
};
