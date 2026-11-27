
const crypto = require("crypto");
const argon2 = require("argon2");

const pool = require("../../database/db");

const authModel = require("../models/authModel");
const invitationModel = require("../models/invitationModel");

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,128}$/;

function validateAcceptanceInput({ token, password }) {
  if (
    typeof token !== "string" ||
    token.length < 40 ||
    token.length > 200
  ) {
    throw new Error("Invalid or expired invitation.");
  }

  if (
    typeof password !== "string" ||
    !PASSWORD_REGEX.test(password)
  ) {
    throw new Error(
      "Password must be 8-128 characters and include uppercase, lowercase, a number, and a special character, with no spaces."
    );
  }
}

function hashInvitationToken(token) {
  return crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

async function acceptInvitation({
  token,
  password,
  ipAddress,
  userAgent,
}) {
  validateAcceptanceInput({ token, password });

  const tokenHash = hashInvitationToken(token);

  // Hash the password before opening the database transaction.
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const client = await pool.connect();

  let transactionStarted = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    // Find and lock the invitation to prevent simultaneous acceptance.
    const invitation = await invitationModel.findInvitationForUpdate(
      tokenHash,
      client
    );

    if (!invitation) {
      throw new Error("Invalid or expired invitation.");
    }

    // Check whether the invitation was already used or revoked.
    if (invitation.accepted_at || invitation.revoked_at) {
      throw new Error("Invalid or expired invitation.");
    }

    // Check invitation expiration.
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      throw new Error("Invalid or expired invitation.");
    }

    // Check that the email does not already belong to an account.
    const existingUser = await authModel.findUserByEmail(
      invitation.email,
      client
    );

    if (existingUser) {
      throw new Error("An account already exists for this email address.");
    }

    // Create the account in Pending status.
    const newUser = await authModel.createUser(
      {
        fullName: invitation.full_name,
        email: invitation.email,
        passwordHash,
        role: invitation.role,
      },
      client
    );

    // The invitation link confirms ownership of the invited email.
    const activated = await authModel.activateVerifiedUser(
      newUser.user_id,
      client
    );

    if (!activated) {
      throw new Error("Unable to activate the account.");
    }

    // Mark the invitation as accepted.
    const invitationAccepted =
      await invitationModel.markInvitationAccepted(
        invitation.invitation_id,
        client
      );

    if (!invitationAccepted) {
      throw new Error("Invalid or expired invitation.");
    }

    // Record successful invitation acceptance.
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
        newUser.user_id,
        newUser.email,
        ipAddress || null,
        userAgent || null,
      ]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    return {
      message: "Your account has been created successfully.",
      user: {
        userId: newUser.user_id,
        fullName: newUser.full_name,
        email: newUser.email,
        role: newUser.role,
      },
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Invitation acceptance rollback failed:",
          rollbackError
        );
      }
    }

    // Handle a duplicate email caused by a concurrent account creation.
    if (error.code === "23505") {
      throw new Error("An account already exists for this email address.");
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  acceptInvitation,
};
