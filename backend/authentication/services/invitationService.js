
const crypto = require("crypto");
const pool = require("../../database/db");

const invitationModel = require("../models/invitationModel");
const { sendEmail } = require("../../notifications/emailService");

const INVITATION_EXPIRY_HOURS = 24;

const ALLOWED_ROLES = ["Student", "Instructor", "Admin"];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function validateInvitationInput({ fullName, email, role }) {
  if (
    typeof fullName !== "string" ||
    fullName.trim().length < 2 ||
    fullName.trim().length > 150
  ) {
    throw new Error("Full name must be between 2 and 150 characters.");
  }

  if (
    typeof email !== "string" ||
    email.trim().length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    throw new Error("Please provide a valid email address.");
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error("Invalid account role.");
  }
}

async function createInvitation({
  fullName,
  email,
  role,
  invitedBy,
  ipAddress,
  userAgent,
}) {
  validateInvitationInput({ fullName, email, role });

  if (!Number.isInteger(Number(invitedBy)) || Number(invitedBy) <= 0) {
    throw new Error("Invalid administrator.");
  }

  const normalizedName = fullName.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const administratorId = Number(invitedBy);

  const rawToken = crypto.randomBytes(32).toString("base64url");

  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expiresAt = new Date(
    Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000
  );

  const client = await pool.connect();

  let invitation;

  try {
    await client.query("BEGIN");

    // Confirm that the requester is an active, verified Admin.
    const adminResult = await client.query(
      `
        SELECT user_id
        FROM users
        WHERE user_id = $1
          AND role = 'Admin'
          AND account_status = 'Active'
          AND email_verified = TRUE
        FOR SHARE;
      `,
      [administratorId]
    );

    if (adminResult.rowCount !== 1) {
      throw new Error(
        "Only an active, verified Admin can create invitations."
      );
    }

    // Serialize invitation creation for the same normalized email.
    await client.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtextextended($1, 0)
        );
      `,
      [normalizedEmail]
    );

    // Prevent invitations for existing accounts.
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
      throw new Error("An account already exists for this email address.");
    }

    // Revoke older active invitations for this email.
    await invitationModel.revokeActiveInvitationsByEmail(
      normalizedEmail,
      client
    );

    // Create the new invitation.
    invitation = await invitationModel.createInvitation(
      {
        email: normalizedEmail,
        fullName: normalizedName,
        role,
        tokenHash,
        invitedBy: administratorId,
        expiresAt,
      },
      client
    );

    // Record the invitation creation.
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
        VALUES ($1, $2, 'INVITATION_CREATED', TRUE, $3, $4);
      `,
      [
        administratorId,
        normalizedEmail,
        ipAddress || null,
        userAgent || null,
      ]
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Invitation transaction rollback failed:", rollbackError);
    }

    throw error;
  } finally {
    client.release();
  }

  // Send the invitation email after the database transaction commits.
  try {
    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error("FRONTEND_URL is missing.");
    }

    const invitationUrl = new URL("/accept-invitation", frontendUrl);

    invitationUrl.searchParams.set("token", rawToken);

    const safeName = escapeHtml(normalizedName);
    const safeRole = escapeHtml(role);
    const safeUrl = escapeHtml(invitationUrl.toString());

    await sendEmail({
      to: normalizedEmail,
      subject: "You're invited to Course Feedback",

      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Welcome to Course Feedback!</h2>

          <p>Hello ${safeName},</p>

          <p>
            An administrator has invited you to join
            the Course Feedback Survey Tool.
          </p>

          <p>Your assigned role is: <strong>${safeRole}</strong></p>

          <p>
            Click the link below to accept your invitation
            and create your password.
          </p>

          <p>
            <a
              href="${safeUrl}"
              style="
                display: inline-block;
                padding: 12px 20px;
                background-color: #2B5748;
                color: white;
                text-decoration: none;
                border-radius: 6px;
              "
            >
              Accept Invitation
            </a>
          </p>

          <p>
            This invitation expires in ${INVITATION_EXPIRY_HOURS} hours
            and can only be used once.
          </p>

          <p>
            If you were not expecting this invitation, ignore this email.
          </p>
        </div>
      `,

      text: `
Hello ${normalizedName},

You have been invited to Course Feedback as ${role}.

Accept your invitation here:
${invitationUrl.toString()}

This link expires in ${INVITATION_EXPIRY_HOURS} hours.
      `.trim(),
    });
  } catch (emailError) {
    // Revoke the invitation if the email could not be sent.
    const cleanupClient = await pool.connect();

    try {
      await cleanupClient.query("BEGIN");

      await invitationModel.revokeInvitation(
        invitation.invitation_id,
        cleanupClient
      );

      await cleanupClient.query(
        `
          INSERT INTO auth_audit_logs (
            user_id,
            email,
            event_type,
            success,
            ip_address,
            user_agent
          )
          VALUES ($1, $2, 'INVITATION_EMAIL_FAILED', FALSE, $3, $4);
        `,
        [
          administratorId,
          normalizedEmail,
          ipAddress || null,
          userAgent || null,
        ]
      );

      await cleanupClient.query("COMMIT");
    } catch (cleanupError) {
      try {
        await cleanupClient.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Invitation cleanup rollback failed:", rollbackError);
      }

      console.error("Failed to revoke invitation after email failure:", cleanupError);

      throw new Error(
        "The invitation email could not be sent, and the invitation cleanup requires attention."
      );
    } finally {
      cleanupClient.release();
    }

    throw new Error("The invitation email could not be sent.");
  }

  return {
    message: "Invitation sent successfully.",

    invitation: {
      invitationId: invitation.invitation_id,
      email: invitation.email,
      fullName: invitation.full_name,
      role: invitation.role,
      expiresAt: invitation.expires_at,
    },
  };
}

module.exports = {
  createInvitation,
};
