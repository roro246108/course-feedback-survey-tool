
const rateLimit = require("express-rate-limit");

// General authentication requests.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again later.",
  },
});

// Login attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

// Password reset requests.
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many password reset requests. Please try again later.",
  },
});

// Email verification requests.
const emailVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many email verification attempts. Please try again later.",
  },
});

// Invitation acceptance attempts.
const invitationAcceptanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many invitation attempts. Please try again later.",
  },
});

// Admin invitation creation.
const invitationCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    message: "Too many invitations created. Please try again later.",
  },
});

module.exports = {
  authLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  emailVerificationLimiter,
  invitationAcceptanceLimiter,
  invitationCreationLimiter,
};
