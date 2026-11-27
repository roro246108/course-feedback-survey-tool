
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

module.exports = {
  verifyEmail,
};
