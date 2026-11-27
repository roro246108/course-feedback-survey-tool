
const refreshTokenService = require("../services/refreshTokenService");
const { refreshCookieOptions } = require("./authController");

// Remove the refresh token cookie using matching cookie settings.
function clearRefreshTokenCookie(res) {
  const { maxAge, ...clearOptions } = refreshCookieOptions;

  res.clearCookie("refreshToken", clearOptions);
}

// Refresh the access token using the refresh token cookie.
async function refreshToken(req, res, next) {
  res.set("Cache-Control", "no-store");

  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      clearRefreshTokenCookie(res);

      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const result = await refreshTokenService.refreshAccessToken({
      refreshToken: token,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    // Replace the old refresh token with the newly generated one.
    res.cookie(
      "refreshToken",
      result.refreshToken,
      refreshCookieOptions
    );

    return res.status(200).json({
      message: "Token refreshed successfully.",
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    if (error.message === "Invalid or expired refresh token.") {
      clearRefreshTokenCookie(res);

      return res.status(401).json({
        message: "Session expired. Please log in again.",
      });
    }

    return next(error);
  }
}

module.exports = {
  refreshToken,
};
