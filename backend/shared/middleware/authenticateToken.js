
const { verifyAccessToken } = require("../../authentication/services/tokenService");

const sessionModel = require("../../authentication/models/sessionModel");
const authModel = require("../../authentication/models/authModel");

// Verify the access token and identify the authenticated user.
async function authenticateToken(req, res, next) {
  try {
    // Read the Authorization header.
    const authorizationHeader = req.headers.authorization;

    if (
      typeof authorizationHeader !== "string" ||
      !authorizationHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Extract the access token.
    const accessToken = authorizationHeader.slice(7).trim();

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    // Verify the JWT.
    let payload;

    try {
      payload = verifyAccessToken(accessToken);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token.",
      });
    }

    // Validate token payload.
    if (
      !payload ||
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      !/^[1-9]\d*$/.test(payload.sub) ||
      typeof payload.sid !== "string" ||
      !payload.sid.trim()
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token.",
      });
    }

    const userId = Number(payload.sub);
    const sessionId = payload.sid;

    if (!Number.isSafeInteger(userId)) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token.",
      });
    }

    // Confirm that the session is still active and not expired.
    const session = await sessionModel.findActiveSession(
      sessionId,
      userId
    );

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Your session is no longer active. Please log in again.",
      });
    }

    // Load current account information from the database.
    const user = await authModel.findUserById(userId);

    if (
      !user ||
      user.account_status !== "Active" ||
      !user.email_verified
    ) {
      return res.status(403).json({
        success: false,
        message: user?.account_status === "Inactive"
          ? "Your account has been deactivated. Contact an administrator."
          : "Your account is not active or verified.",
      });
    }

    // Attach authenticated user information to the request.
    // Always use the current role stored in the database.
    req.user = {
      userId: user.user_id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      sessionId: session.session_id,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authenticateToken;
