
const express = require("express");

const router = express.Router();

// Controllers
const authController = require("../controllers/authController");
const refreshTokenController = require("../controllers/refreshTokenController");
const logoutController = require("../controllers/logoutController");
const invitationController = require("../controllers/invitationController");
const emailVerificationController = require("../controllers/emailVerificationController");
const invitationAcceptanceController = require("../controllers/invitationAcceptanceController");
const passwordResetController = require("../controllers/passwordResetController");

// Middleware
const authenticateToken = require("../../middleware/authenticateToken");
const authorizeRole = require("../../middleware/authorizeRole");

const {
  issueCsrfToken,
  csrfProtection,
} = require("../../middleware/csrfProtection");

// Rate limiters
const {
  authLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  emailVerificationLimiter,
  invitationAcceptanceLimiter,
  invitationCreationLimiter,
} = require("../../middleware/rateLimiters");

// Get CSRF token
router.get(
  "/csrf",
  authLimiter,
  issueCsrfToken
);

// Login
router.post(
  "/login",
  authLimiter,
  loginLimiter,
  csrfProtection,
  authController.login
);

// Refresh access token
router.post(
  "/refresh",
  authLimiter,
  csrfProtection,
  refreshTokenController.refreshToken
);

// Logout
router.post(
  "/logout",
  authLimiter,
  csrfProtection,
  logoutController.logout
);

// Email verification
router.post(
  "/verify-email",
  emailVerificationLimiter,
  emailVerificationController.verifyEmail
);

// Accept an account invitation
router.post(
  "/accept-invitation",
  invitationAcceptanceLimiter,
  invitationAcceptanceController.acceptInvitation
);

// Forgot password
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  passwordResetController.requestPasswordReset
);

// Reset password
router.post(
  "/reset-password",
  forgotPasswordLimiter,
  passwordResetController.resetPassword
);

// Create invitations (Admin only)
router.post(
  "/invitations",
  authenticateToken,
  authorizeRole("Admin"),
  invitationCreationLimiter,
  csrfProtection,
  invitationController.createInvitation
);

module.exports = router;
