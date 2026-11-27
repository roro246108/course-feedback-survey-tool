
const invitationService = require("../services/invitationService");

// Handle account invitation creation.
async function createInvitation(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const { fullName, email, role } = req.body || {};

    // Validate required fields.
    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof role !== "string" ||
      !fullName.trim() ||
      !email.trim() ||
      !role.trim()
    ) {
      return res.status(400).json({
        message: "Full name, email and role are required.",
      });
    }

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim();
    const normalizedRole = role.trim();

    // Validate full name length.
    if (
      normalizedName.length < 2 ||
      normalizedName.length > 150
    ) {
      return res.status(400).json({
        message: "Full name must be between 2 and 150 characters.",
      });
    }

    // Validate email format and length.
    if (
      normalizedEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        message: "Please provide a valid email address.",
      });
    }

    // The administrator ID must come from the authenticated user.
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // Create the invitation.
    const result = await invitationService.createInvitation({
      fullName: normalizedName,
      email: normalizedEmail,
      role: normalizedRole,
      invitedBy: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json(result);
  } catch (error) {
    // Invalid input.
    if (
      error.message === "Invalid account role." ||
      error.message === "Please provide a valid email address." ||
      error.message ===
        "Full name must be between 2 and 150 characters."
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

    // Admin authorization failure.
    if (
      error.message ===
      "Only an active, verified Admin can create invitations."
    ) {
      return res.status(403).json({
        message: "You are not authorized to create invitations.",
      });
    }

    return next(error);
  }
}

module.exports = {
  createInvitation,
};
