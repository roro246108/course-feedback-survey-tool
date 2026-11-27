
const invitationService = require("../services/invitationService");

// Handle account invitation creation.
async function createInvitation(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const body = req.body || {};
    const {
      fullName,
      personalEmail,
      academicEmail,
      role,
    } = body;

    // Validate required fields.
    if (
      typeof fullName !== "string" ||
      typeof personalEmail !== "string" ||
      typeof academicEmail !== "string" ||
      typeof role !== "string" ||
      !fullName.trim() ||
      !personalEmail.trim() ||
      !academicEmail.trim() ||
      !role.trim()
    ) {
      return res.status(400).json({
        message: "Full name, account type, personal email, and academic email are required.",
      });
    }

    const normalizedName = fullName.trim();
    const normalizedPersonalEmail = personalEmail.trim();
    const normalizedAcademicEmail = academicEmail.trim();
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
      normalizedPersonalEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPersonalEmail)
    ) {
      return res.status(400).json({
        message: "Please provide a valid personal email address.",
      });
    }

    if (
      normalizedAcademicEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedAcademicEmail)
    ) {
      return res.status(400).json({
        message: "Please provide a valid academic email address.",
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
      personalEmail: normalizedPersonalEmail,
      academicEmail: normalizedAcademicEmail,
      role: normalizedRole,
      invitedBy: req.user.userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json(result);
  } catch (error) {
    if (
      error.code === "EMAIL_DELIVERY_FAILED" ||
      error.code === "INVITATION_EMAIL_CLEANUP_FAILED" ||
      error.code === "INVITATION_EMAIL_CONFIGURATION_ERROR"
    ) {
      return res.status(error.statusCode || 503).json({
        success: false,
        message: error.message,
      });
    }

    // Invalid input.
    if (
      error.message === "Invalid account role." ||
      error.message === "Please provide a valid personal email address." ||
      error.message === "Please provide a valid academic email address." ||
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
