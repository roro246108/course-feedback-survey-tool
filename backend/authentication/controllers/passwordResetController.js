
const passwordResetService = require("../services/passwordResetService");

// Handle forgot password request
async function requestPasswordReset(req, res, next) {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        message: "A valid email address is required.",
      });
    }

    const result =
      await passwordResetService.requestPasswordReset(email);

    // Prevent caching of authentication-related responses.
    res.set("Cache-Control", "no-store");

    return res.status(200).json(result);
  } catch (error) {
    return next(error);
  }
}

// Handle password reset using the emailed token
async function resetPassword(req, res, next) {
  try {
    const { token, password, confirmPassword } = req.body;

    if (
      typeof token !== "string" ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({
        message: "Token and password fields are required.",
      });
    }

    const result = await passwordResetService.resetPassword({
      token,
      password,
      confirmPassword,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.set("Cache-Control", "no-store");

    return res.status(200).json(result);
  } catch (error) {
    if (
      error.message === "Invalid or expired password reset link." ||
      error.message === "This account cannot reset its password." ||
      error.message === "Passwords do not match." ||
      error.message.startsWith("Password must be")
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return next(error);
  }
}

module.exports = {
  requestPasswordReset,
  resetPassword,
};
