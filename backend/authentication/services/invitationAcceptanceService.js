
const argon2 = require("argon2");
const pool = require("../../database/db");

const authModel = require("../models/authModel");
const invitationModel = require("../models/invitationModel");

const { hashToken } = require("./tokenService");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

function validatePassword(password) {
  if (
    typeof password !== "string" ||
    !PASSWORD_REGEX.test(password)
  ) {
    throw new Error(
      "Password must be 8-128 characters and include uppercase, lowercase, a number and a special character, without spaces."
    );
  }
}

// Accept an invitation and create the user account
async function acceptInvitation({
  token,
  password,
  confirmPassword,
  ipAddress,
  userAgent,
}) {
  if (
    typeof token !== "string" ||
    token.length < 40 ||
    token.length > 200
  ) {
    throw new Error("Invalid or expired invitation.");
  }

  validatePassword(password);

  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  // Hash the password before starting the database transaction.
  const passwordHash = await argon2.hash(
    password,
    ARGON2_OPTIONS
  );

  const tokenHash = hashToken(token);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the invitation to prevent it from being accepted twice.
    const invitation =
      await invitationModel.findInvitationForUpdate(
        tokenHash,
        client
      );

    if (
      !invitation ||
      invitation.accepted_at ||
      invitation.revoked_at ||
      new Date(invitation.expires_at) <= new Date()
    ) {
      throw new Error("Invalid or expired invitation.");
    }

    const normalizedEmail = invitation.email
      .trim()
      .toLowerCase();

    // Prevent duplicate accounts, including different email casing.
    const existingUser = await client.query(
      `
        SELECT user_id
        FROM users
        WHERE LOWER(TRIM(email)) = $1
        LIMIT 1;
      `,
      [normalizedEmail]
    );

    if (existingUser.rowCount > 0) {
      throw new Error("An account already exists for this email.");
    }

    // The role and name come from the invitation, not the client.
    const user = await authModel.createUser(
      {
        fullName: invitation.full_name,
        email: normalizedEmail,
        passwordHash,
        role: invitation.role,
      },
      client
    );

    // The invitation proves control of the invited email address.
    const activated = await authModel.activateVerifiedUser(
      user.user_id,
      client
    );

    if (!activated) {
      throw new Error("Account activation failed.");
    }

    const invitationAccepted =
      await invitationModel.markInvitationAccepted(
        invitation.invitation_id,
        client
      );

    if (!invitationAccepted) {
      throw new Error("Invitation could not be accepted.");
    }

    await client.query(
      `
        INSERT INTO auth_audit_logs (
          user_id,
          email,
          event_type,
          success,
          ip_address,
          user_agent
        )
        VALUES ($1, $2, 'INVITATION_ACCEPTED', TRUE, $3, $4);
      `,
      [
        user.user_id,
        normalizedEmail,
        ipAddress || null,
        userAgent || null,
      ]
    );

    await client.query("COMMIT");

    return {
      message: "Your account has been created successfully.",
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        accountStatus: "Active",
        emailVerified: true,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  acceptInvitation,
};
