
const authenticateToken = require("../../middleware/authenticateToken.js");

function requireStudent(req, res, next) {
  return authenticateToken(req, res, (error) => {
    if (error) {
      return next(error);
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (req.user.role !== "Student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access this resource.",
      });
    }

    req.user.user_id = req.user.userId;

    return next();
  });
}

module.exports = requireStudent;
