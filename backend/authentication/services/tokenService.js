
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

// Environment configuration
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const ACCESS_TOKEN_EXPIRES_IN =
  process.env.ACCESS_TOKEN_EXPIRES_IN || "10m";

const REFRESH_TOKEN_EXPIRES_IN_DAYS = Number(
  process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || 7
);

// Validate environment variables
if (
  !ACCESS_TOKEN_SECRET ||
  Buffer.byteLength(ACCESS_TOKEN_SECRET, "utf8") < 32
) {
  throw new Error(
    "ACCESS_TOKEN_SECRET must contain at least 32 bytes."
  );
}

if (
  !Number.isInteger(REFRESH_TOKEN_EXPIRES_IN_DAYS) ||
  REFRESH_TOKEN_EXPIRES_IN_DAYS < 1 ||
  REFRESH_TOKEN_EXPIRES_IN_DAYS > 90
) {
  throw new Error(
    "REFRESH_TOKEN_EXPIRES_IN_DAYS must be between 1 and 90."
  );
}

// Generate a short-lived access token
function generateAccessToken(user, sessionId) {
  if (!user || !user.user_id || !user.role || !sessionId) {
    throw new Error("Invalid user or session information.");
  }

  return jwt.sign(
    {
      role: user.role,
      sid: sessionId,
    },
    ACCESS_TOKEN_SECRET,
    {
      algorithm: "HS256",
      subject: String(user.user_id),
      issuer: "course-feedback-api",
      audience: "course-feedback-client",
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    }
  );
}

// Verify an access token
function verifyAccessToken(token) {
  if (typeof token !== "string" || !token.trim()) {
    throw new Error("Access token is required.");
  }

  return jwt.verify(token, ACCESS_TOKEN_SECRET, {
    algorithms: ["HS256"],
    issuer: "course-feedback-api",
    audience: "course-feedback-client",
  });
}

// Generate a cryptographically random refresh token
function generateRefreshToken() {
  return crypto.randomBytes(64).toString("base64url");
}

// Hash a token before storing it in the database
function hashToken(token) {
  if (typeof token !== "string" || !token) {
    throw new Error("A valid token is required.");
  }

  return crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

// Generate a unique session ID
function generateSessionId() {
  return crypto.randomUUID();
}

// Generate a unique token family ID
function generateFamilyId() {
  return crypto.randomUUID();
}

// Calculate the refresh token expiration date
function getRefreshTokenExpiry() {
  const expiresAt = new Date(
    Date.now() +
      REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000
  );

  return expiresAt;
}

module.exports = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  generateSessionId,
  generateFamilyId,
  getRefreshTokenExpiry,
};
