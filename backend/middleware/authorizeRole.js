
const ALLOWED_ROLES = ["Admin", "Student", "Instructor"];

// Restrict access based on the user's role.
function authorizeRole(...allowedRoles) {
  // Validate role configuration when the middleware is created.
  const invalidRoles = allowedRoles.filter(
    (role) => !ALLOWED_ROLES.includes(role)
  );

  if (
    allowedRoles.length === 0 ||
    invalidRoles.length > 0
  ) {
    throw new Error(
      "Invalid authorization role configuration."
    );
  }

  return function (req, res, next) {
    // Check whether the user is authenticated.
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    // Check whether the authenticated user has permission.
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message:
          "You do not have permission to access this resource.",
      });
    }

    return next();
  };
}

module.exports = authorizeRole;
