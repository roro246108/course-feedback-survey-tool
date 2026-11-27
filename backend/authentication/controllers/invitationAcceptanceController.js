
const acceptInvitationService = require("../services/acceptInvitationService");

// Handle invitation acceptance and account creation.
async function acceptInvitation(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const { token, password, confirmPassword } = req.body || {};

    // Validate required fields.
    if (
      typeof token !== "string" ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      return res.status(400).json({
        message: "Token and password fields are required.",
      });
    }

    // Check that both passwords match.
    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match.",
      });
    }

    // Accept the invitation.
    const result = await acceptInvitationService.acceptInvitation({
      token,
      password,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json(result);
  } catch (error) {
    // Invalid or expired invitation.
    if (
      error.message === "Invalid or expired invitation."
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // Account already exists.
    if (
      error.message ===
      "An account already exists for this email address."
    ) {
      return res.status(409).json({
        message: error.message,
      });
    }

    // Invalid password.
    if (error.message.startsWith("Password must be")) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // Other errors are handled by the central error handler.
    return next(error);
  }
}

module.exports = {
  acceptInvitation,
};
