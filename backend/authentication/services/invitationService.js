
const crypto = require("crypto");
const pool = require("../../database/db");

const invitationModel = require("../models/invitationModel");
const {
  sendEmail,
  EmailDeliveryError,
} = require("../../notifications/emailService");

const INVITATION_EXPIRY_HOURS = 24;

const ALLOWED_ROLES = ["Student", "Instructor"];

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

function validateInvitationInput({
  fullName,
  personalEmail,
  academicEmail,
  role,
}) {
  if (
    typeof fullName !== "string" ||
    fullName.trim().length < 2 ||
    fullName.trim().length > 150
  ) {
    throw new Error("Full name must be between 2 and 150 characters.");
  }

  if (
    typeof personalEmail !== "string" ||
    personalEmail.trim().length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalEmail.trim())
  ) {
    throw new Error("Please provide a valid personal email address.");
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error("Invalid account role.");
  }

  if (
    typeof academicEmail !== "string" ||
    academicEmail.trim().length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(academicEmail.trim())
  ) {
    throw new Error("Please provide a valid academic email address.");
  }
}

async function createInvitation({
  fullName,
  personalEmail,
  academicEmail,
  role,
  invitedBy,
  ipAddress,
  userAgent,
}) {
  validateInvitationInput({
    fullName,
    personalEmail,
    academicEmail,
    role,
  });

  if (!Number.isInteger(Number(invitedBy)) || Number(invitedBy) <= 0) {
    throw new Error("Invalid administrator.");
  }

  const normalizedName = fullName.trim();
  const normalizedPersonalEmail = personalEmail.trim().toLowerCase();
  const normalizedAcademicEmail = academicEmail.trim().toLowerCase();
  const administratorId = Number(invitedBy);
  let invitationUrl;

  try {
    if (!process.env.FRONTEND_URL) {
      throw new Error("Missing frontend URL.");
    }

    invitationUrl = new URL("/accept-invitation", process.env.FRONTEND_URL);
    if (!["http:", "https:"].includes(invitationUrl.protocol)) {
      throw new Error("Invalid frontend URL protocol.");
    }
  } catch {
    const error = new Error(
      "Invitation email configuration is incomplete: FRONTEND_URL must be a valid HTTP(S) URL."
    );
    error.code = "INVITATION_EMAIL_CONFIGURATION_ERROR";
    error.statusCode = 503;
    throw error;
  }

  const emailAddresses = [...new Set(
    [normalizedPersonalEmail, normalizedAcademicEmail]
  )].sort();

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

    // Lock every address in a stable order so cross-field duplicates cannot race.
    for (const address of emailAddresses) {
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended($1, 0));`,
        [address]
      );
    }

    // Prevent invitations for existing accounts.
    const existingUser = await client.query(
      `
        SELECT user_id
        FROM users
        WHERE LOWER(TRIM(email)) = ANY($1::text[])
          OR (
            role IN ('Student', 'Instructor')
            AND LOWER(TRIM(personal_email)) = ANY($1::text[])
          )
        LIMIT 1;
      `,
      [emailAddresses]
    );

    if (existingUser.rowCount > 0) {
      throw new Error("An account already exists for this email address.");
    }

    // Revoke older invitations that overlap a delivery or login address.
    await invitationModel.revokeActiveInvitationsByEmails(
      emailAddresses,
      client
    );

    // Create the new invitation.
    invitation = await invitationModel.createInvitation(
      {
        email: normalizedPersonalEmail,
        academicEmail: normalizedAcademicEmail,
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
        normalizedPersonalEmail,
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
    invitationUrl.searchParams.set("token", rawToken);

    const safeName = escapeHtml(normalizedName);
    const safeRole = escapeHtml(role);
    const safeAcademicEmail = escapeHtml(normalizedAcademicEmail);
    const safeUrl = escapeHtml(invitationUrl.toString());

    await sendEmail({
      to: normalizedPersonalEmail,
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

          <p>Use this academic email to sign in: <strong>${safeAcademicEmail}</strong></p>

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
Sign in using your academic email: ${normalizedAcademicEmail}

Accept your invitation here:
${invitationUrl.toString()}

This link expires in ${INVITATION_EXPIRY_HOURS} hours.
      `.trim(),
    });
  } catch (emailError) {
    // Revoke the invitation if the email could not be sent.
    const providerFailure = emailError instanceof EmailDeliveryError;
    const diagnostic = providerFailure
      ? emailError.message
      : "The email service failed before confirming delivery.";
    let cleanupClient;
    let cleanupTransactionStarted = false;

    try {
      cleanupClient = await pool.connect();
      await cleanupClient.query("BEGIN");
      cleanupTransactionStarted = true;

      const invitationRevoked = await invitationModel.revokeInvitation(
        invitation.invitation_id,
        cleanupClient
      );

      if (!invitationRevoked) {
        throw new Error("Invitation revocation was not confirmed.");
      }

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
          normalizedPersonalEmail,
          ipAddress || null,
          userAgent || null,
        ]
      );

      await cleanupClient.query("COMMIT");
      cleanupTransactionStarted = false;
    } catch (cleanupError) {
      if (cleanupClient && cleanupTransactionStarted) {
        try {
          await cleanupClient.query("ROLLBACK");
        } catch {
          console.error("Invitation cleanup rollback failed.");
        }
      }

      console.error("Invitation cleanup failed after email delivery failure.", {
        provider: providerFailure ? emailError.provider : "Email service",
        providerCode: providerFailure ? emailError.providerCode : null,
        providerStatusCode: providerFailure ? emailError.statusCode : null,
        providerMessage: providerFailure
          ? emailError.safeMessage
          : "Email delivery was not confirmed.",
        cleanupCode:
          typeof cleanupError.code === "string" &&
          /^[A-Za-z0-9_.-]{1,64}$/.test(cleanupError.code)
            ? cleanupError.code
            : "UNKNOWN",
      });

      const error = new Error(
        `Invitation email delivery failed: ${diagnostic} The prior invitation could not be confirmed revoked. Retrying will invalidate any active invitation matching these addresses before creating another.`
      );
      error.code = "INVITATION_EMAIL_CLEANUP_FAILED";
      error.statusCode = 503;
      throw error;
    } finally {
      if (cleanupClient) {
        cleanupClient.release();
      }
    }

    console.error("Invitation email delivery failed.", {
      provider: providerFailure ? emailError.provider : "Email service",
      providerCode: providerFailure ? emailError.providerCode : null,
      providerStatusCode: providerFailure ? emailError.statusCode : null,
      message: providerFailure
        ? emailError.safeMessage
        : "Email delivery was not confirmed.",
    });

    const error = new Error(
      `The invitation record was created but then revoked because email delivery failed. ${diagnostic}`
    );
    error.code = "EMAIL_DELIVERY_FAILED";
    error.statusCode = 502;
    throw error;
  }

  return {
    message: "Invitation sent successfully.",

    invitation: {
      invitationId: invitation.invitation_id,
      email: invitation.email,
      personalEmail: invitation.email,
      academicEmail: invitation.academic_email,
      fullName: invitation.full_name,
      role: invitation.role,
      expiresAt: invitation.expires_at,
    },
  };
}

module.exports = {
  createInvitation,
};
