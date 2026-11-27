
const logoutService = require("../services/logoutService");
const { refreshCookieOptions } = require("./authController");

// Handle user logout
async function logout(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await logoutService.logout(refreshToken, {
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    }

    // Clear the browser cookie using the same cookie scope.
    const { maxAge, ...clearOptions } = refreshCookieOptions;

    res.clearCookie("refreshToken", clearOptions);

    return res.status(200).json({
      message: "Logged out successfully.",
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  logout,
};
