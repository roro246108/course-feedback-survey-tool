
const crypto = require("crypto");

const CSRF_SECRET = process.env.CSRF_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;

const isProduction = process.env.NODE_ENV === "production";

if (!CSRF_SECRET || Buffer.byteLength(CSRF_SECRET) < 32) {
  throw new Error("CSRF_SECRET must contain at least 32 bytes.");
}

if (!FRONTEND_URL) {
  throw new Error("FRONTEND_URL is required for CSRF protection.");
}

const csrfCookieOptions = {
  httpOnly: false,
  secure: isProduction,
  sameSite: "lax",
  path: "/api/auth",
};

function createSignature(randomValue) {
  return crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(randomValue)
    .digest("base64url");
}

// Generate a signed CSRF token
function generateCsrfToken() {
  const randomValue = crypto.randomBytes(32).toString("base64url");
  const signature = createSignature(randomValue);

  return `${randomValue}.${signature}`;
}

// Verify token signature safely
function isValidSignature(token) {
  if (typeof token !== "string") {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [randomValue, providedSignature] = parts;

  if (
    !/^[A-Za-z0-9_-]{40,50}$/.test(randomValue) ||
    !/^[A-Za-z0-9_-]{40,50}$/.test(providedSignature)
  ) {
    return false;
  }

  const expectedSignature = createSignature(randomValue);

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

// Issue a CSRF token and set its cookie
function issueCsrfToken(req, res) {
  const token = generateCsrfToken();

  res.cookie("csrfToken", token, {
    ...csrfCookieOptions,
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.set("Cache-Control", "no-store");

  return res.status(200).json({
    csrfToken: token,
  });
}

// Protect cookie-authenticated state-changing requests
function csrfProtection(req, res, next) {
  try {
    const allowedOrigin = new URL(FRONTEND_URL).origin;
    const requestOrigin = req.get("origin");

    if (requestOrigin !== allowedOrigin) {
      return res.status(403).json({
        message: "Invalid request origin.",
      });
    }

    const cookieToken = req.cookies?.csrfToken;
    const headerToken = req.get("X-CSRF-Token");

    if (
      !cookieToken ||
      !headerToken ||
      cookieToken !== headerToken ||
      !isValidSignature(cookieToken)
    ) {
      return res.status(403).json({
        message: "CSRF validation failed.",
      });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  issueCsrfToken,
  csrfProtection,
};
