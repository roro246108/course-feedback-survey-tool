
const emailVerificationService = require("../services/emailVerificationService");

// Verify user's email address
async function verifyEmail(req, res, next) {
  try {
    const { token } = req.body;

    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        message: "Verification token is required.",
      });
    }

    const result = await emailVerificationService.verifyEmail(token);

    res.set("Cache-Control", "no-store");

    return res.status(200).json(result);
  } catch (error) {
    if (
      error.message === "Invalid or expired verification link." ||
      error.message === "This account cannot be verified."
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return next(error);
  }
}

async function resendVerificationEmail(req, res, next) {
  const { email } = req.body || {};
  if (
    typeof email !== "string" ||
    email.trim().length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({
      message: "Please provide a valid email address.",
    });
  }

  try {
    const result = await emailVerificationService.resendVerificationEmail(email);
    res.set("Cache-Control", "no-store");
    return res.status(200).json(result);
  } catch (error) {
    if (error.message === "Unable to send a verification email right now.") {
      return res.status(503).json({ message: error.message });
    }
    return next(error);
  }
}

module.exports = {
  verifyEmail,
  resendVerificationEmail,
};
