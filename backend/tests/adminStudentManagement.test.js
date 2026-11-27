const assert = require("node:assert/strict");
const { test } = require("node:test");

const dotenv = require("dotenv");
const originalDotenvConfig = dotenv.config;
dotenv.config = () => ({ parsed: {} });
process.env.DATABASE_URL = "postgresql://unit-test:unit-test@127.0.0.1/unit_test";
process.env.RESEND_API_KEY = "re_test_unit_test_key";
process.env.EMAIL_FROM = "unit-test@example.invalid";
process.env.EMAIL_PROVIDER = "resend";
process.env.ACCESS_TOKEN_SECRET = "unit-test-access-token-secret-with-at-least-32-bytes";

const adminUserModel = require("../authentication/models/adminUserModel");
const adminUserController = require("../authentication/controllers/adminUserController");
const authModel = require("../authentication/models/authModel");
const invitationModel = require("../authentication/models/invitationModel");
const invitationController = require("../authentication/controllers/invitationController");
const emailVerificationController = require("../authentication/controllers/emailVerificationController");
const invitationService = require("../authentication/services/invitationService");
const acceptInvitationService = require("../authentication/services/acceptInvitationService");
const emailDeliveryService = require("../notifications/emailService");
const emailVerificationService = require("../authentication/services/emailVerificationService");
const pool = require("../database/db");
const dashboardModel = require("../survey-management/models/dashboardModel");

dotenv.config = originalDotenvConfig;

test("admin student listing is role-scoped and excludes credential fields", async () => {
  let capturedQuery;
  const expected = [{ student_id: 17, full_name: "Test Student", courses: [] }];
  const db = {
    query: async (query) => {
      capturedQuery = query;
      return { rows: expected };
    },
  };

  assert.deepEqual(await adminUserModel.getStudents(db), expected);
  assert.match(capturedQuery, /WHERE u\.role = 'Student'/);
  assert.match(capturedQuery, /LEFT JOIN enrollments/);
  assert.match(capturedQuery, /json_agg/);
  assert.doesNotMatch(capturedQuery, /personal_email/i);
  assert.doesNotMatch(capturedQuery, /password|password_hash/i);
});

test("student name updates only target a Student account", async () => {
  let capturedParams;
  let capturedQuery;
  const db = {
    query: async (query, params) => {
      capturedQuery = query;
      capturedParams = params;
      return { rows: [{ student_id: 17, full_name: "Updated Name" }] };
    },
  };

  const result = await adminUserModel.updateStudentName(17, "Updated Name", db);
  assert.equal(result.full_name, "Updated Name");
  assert.deepEqual(capturedParams, ["Updated Name", 17]);
  assert.match(capturedQuery, /WHERE user_id = \$2\s+AND role = 'Student'/);
});

test("deactivating a Student updates status and revokes sessions in the same transaction", async () => {
  const queries = [];
  const client = {
    query: async (query, params) => {
      queries.push({ query, params });
      if (/SELECT user_id, account_status/i.test(query)) {
        return {
          rows: [{ user_id: 17, account_status: "Active", email_verified: true }],
        };
      }
      if (/UPDATE users/i.test(query)) {
        return { rows: [{ user_id: 17, account_status: "Inactive" }] };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {
      queries.push({ query: "RELEASE" });
    },
  };
  const db = { connect: async () => client };

  const result = await adminUserModel.updateStudentAccountStatus(
    17,
    "Inactive",
    db
  );

  assert.deepEqual(result, { user_id: 17, account_status: "Inactive" });
  assert.ok(queries.some(({ query }) => /UPDATE user_sessions/i.test(query)));
  assert.ok(queries.some(({ query }) => query === "COMMIT"));
  assert.ok(queries.some(({ query, params }) =>
    /UPDATE user_sessions/i.test(query) && params[0] === 17
  ));
});

test("pending students cannot be activated or deactivated through account management", async () => {
  const queries = [];
  const client = {
    query: async (query) => {
      queries.push(query);
      if (/SELECT user_id, account_status/i.test(query)) {
        return {
          rows: [{ user_id: 17, account_status: "Pending", email_verified: false }],
        };
      }
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };

  await assert.rejects(
    adminUserModel.updateStudentAccountStatus(17, "Active", {
      connect: async () => client,
    }),
    (error) => error.code === "STUDENT_STATUS_NOT_CHANGEABLE"
  );
  assert.ok(queries.some((query) => query === "ROLLBACK"));
  assert.ok(!queries.some((query) => /UPDATE users/i.test(query)));
});

test("user creation stores login and personal emails for both invitee roles", async () => {
  let capturedQuery;
  let capturedParams;
  for (const role of ["Student", "Instructor"]) {
    const expected = {
      user_id: 17,
      email: `${role.toLowerCase()}@university.example`,
      personal_email: `${role.toLowerCase()}@mail.example`,
    };

    const result = await authModel.createUser({
      fullName: `Test ${role}`,
      email: `${role.toUpperCase()}@UNIVERSITY.EXAMPLE`,
      personalEmail: `${role.toLowerCase()}@mail.example`,
      passwordHash: "hashed-password",
      role,
    }, {
      query: async (query, params) => {
        capturedQuery = query;
        capturedParams = params;
        return { rows: [expected] };
      },
    });

    assert.deepEqual(result, expected);
    assert.match(capturedQuery, /personal_email/);
    assert.match(capturedQuery, /VALUES\s*\(\s*\$1, \$2, \$3, \$4, \$5,/);
    assert.deepEqual(capturedParams, [
      `Test ${role}`,
      `${role.toLowerCase()}@university.example`,
      `${role.toLowerCase()}@mail.example`,
      "hashed-password",
      role,
    ]);
  }
});

test("email collision checks treat personal_email as an invitee address for both roles", async () => {
  let capturedQuery;
  await authModel.findUserByEmailAddresses(["student@mail.example"], {
    query: async (query) => {
      capturedQuery = query;
      return { rows: [] };
    },
  });

  assert.match(capturedQuery, /role IN \('Student', 'Instructor'\)[\s\S]*LOWER\(TRIM\(personal_email\)\)/);
});

test("provider diagnostics preserve failure details while redacting sensitive values", () => {
  const error = emailDeliveryService.toEmailDeliveryError({
    name: "validation_error",
    statusCode: 422,
    message: "Invalid recipient safe-test@example.invalid; API key=re_test_secret_value and token=private-invitation-token.",
  });

  assert.equal(error.code, "EMAIL_DELIVERY_FAILED");
  assert.equal(error.providerCode, "validation_error");
  assert.equal(error.statusCode, 422);
  assert.match(error.message, /Resend validation_error \(HTTP 422\): Invalid recipient/);
  assert.doesNotMatch(error.message, /safe-test@example\.invalid/);
  assert.doesNotMatch(error.message, /re_test_secret_value|private-invitation-token/);
});

test("Resend response errors surface their safe provider code, status, and message", async () => {
  const providerError = {
    name: "validation_error",
    statusCode: 422,
    message: "Invalid recipient safe-test@example.invalid; API key=re_test_secret_value.",
  };
  const client = {
    emails: {
      send: async () => ({ error: providerError }),
    },
  };

  await assert.rejects(
    emailDeliveryService.sendEmailWithClient(client, "verified-sender@example.invalid", {
      to: "safe-test@example.invalid",
      subject: "Delivery diagnostic test",
      html: "<p>Test</p>",
    }),
    (error) => {
      assert.equal(error.code, "EMAIL_DELIVERY_FAILED");
      assert.equal(error.providerCode, "validation_error");
      assert.equal(error.statusCode, 422);
      assert.match(error.message, /Invalid recipient/);
      assert.doesNotMatch(error.message, /safe-test@example\.invalid|verified-sender@example\.invalid/);
      assert.doesNotMatch(error.message, /re_test_secret_value/);
      return true;
    }
  );
});

test("Gmail provider uses Nodemailer service and credentials from the environment", async () => {
  let transportOptions;
  let sentMessage;
  const nodemailerModule = {
    createTransport(options) {
      transportOptions = options;
      return {
        sendMail: async (message) => {
          sentMessage = message;
          return {
            messageId: "gmail-message-id",
            accepted: [message.to],
            rejected: [],
          };
        },
      };
    },
  };
  const sendGmail = emailDeliveryService.createEmailSender({
    provider: "GMAIL",
    env: {
      EMAIL_USER: "sender@example.invalid",
      EMAIL_APP_PASSWORD: "test-only-app-password",
    },
    nodemailerModule,
  });

  await sendGmail({
    to: "personal@example.invalid",
    subject: "Invitation test",
    html: "<p>Invitation</p>",
    text: "Invitation",
  });

  assert.deepEqual(transportOptions, {
    service: "gmail",
    auth: {
      user: "sender@example.invalid",
      pass: "test-only-app-password",
    },
  });
  assert.deepEqual(sentMessage, {
    from: "sender@example.invalid",
    to: "personal@example.invalid",
    subject: "Invitation test",
    html: "<p>Invitation</p>",
    text: "Invitation",
  });
});

test("Gmail SMTP failures preserve a safe diagnostic without exposing credentials", async () => {
  const nodemailerModule = {
    createTransport() {
      return {
        sendMail: async () => {
          const error = new Error(
            "Invalid login for sender@example.invalid with password=test-only-app-password."
          );
          error.code = "EAUTH";
          error.responseCode = 535;
          throw error;
        },
      };
    },
  };
  const sendGmail = emailDeliveryService.createEmailSender({
    provider: "gmail",
    env: {
      EMAIL_USER: "sender@example.invalid",
      EMAIL_APP_PASSWORD: "test-only-app-password",
    },
    nodemailerModule,
  });

  await assert.rejects(
    sendGmail({
      to: "personal@example.invalid",
      subject: "Invitation test",
      html: "<p>Invitation</p>",
    }),
    (error) => {
      assert.equal(error.code, "EMAIL_DELIVERY_FAILED");
      assert.equal(error.provider, "Gmail SMTP");
      assert.equal(error.providerCode, "EAUTH");
      assert.equal(error.statusCode, 535);
      assert.match(error.message, /Invalid login/);
      assert.doesNotMatch(
        error.message,
        /sender@example\.invalid|personal@example\.invalid|test-only-app-password/
      );
      return true;
    }
  );
});

test("Resend remains available through the configured-provider factory", async () => {
  let sentPayload;
  const sendResend = emailDeliveryService.createEmailSender({
    provider: "resend",
    env: {
      RESEND_API_KEY: "test-only-resend-key",
      EMAIL_FROM: "sender@example.invalid",
    },
    resendClient: {
      emails: {
        send: async (payload) => {
          sentPayload = payload;
          return { data: { id: "resend-message-id" } };
        },
      },
    },
  });

  await sendResend({
    to: "personal@example.invalid",
    subject: "Invitation test",
    html: "<p>Invitation</p>",
  });

  assert.equal(sentPayload.from, "sender@example.invalid");
  assert.equal(sentPayload.to, "personal@example.invalid");
});

test("retries revoke pending invitations matching either email address", async () => {
  let capturedQuery;
  let capturedParams;

  const revokedCount = await invitationModel.revokeActiveInvitationsByEmails(
    ["personal@example.invalid", "academic@example.invalid"],
    {
      query: async (query, params) => {
        capturedQuery = query;
        capturedParams = params;
        return { rowCount: 1 };
      },
    }
  );

  assert.equal(revokedCount, 1);
  assert.deepEqual(capturedParams, [
    ["personal@example.invalid", "academic@example.invalid"],
  ]);
  assert.match(capturedQuery, /LOWER\(TRIM\(email\)\) = ANY/);
  assert.match(capturedQuery, /LOWER\(TRIM\(academic_email\)\) = ANY/);
  assert.match(capturedQuery, /accepted_at IS NULL/);
  assert.match(capturedQuery, /revoked_at IS NULL/);
});

test("invitation controller maps both email addresses for Student and Instructor roles", async () => {
  const originalCreateInvitation = invitationService.createInvitation;
  const invitationInputs = [];
  const response = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set() {},
  };

  invitationService.createInvitation = async (input) => {
    invitationInputs.push(input);
    return { message: "Invitation sent." };
  };

  try {
    for (const role of ["Student", "Instructor"]) {
      await invitationController.createInvitation({
        body: {
          fullName: `Test ${role}`,
          personalEmail: `${role.toLowerCase()}@mail.example`,
          academicEmail: `${role.toLowerCase()}@university.example`,
          role,
        },
        user: { userId: 1 },
        ip: "127.0.0.1",
        get: () => "test-agent",
      }, response);
    }

    assert.equal(response.statusCode, 201);
    assert.deepEqual(invitationInputs.map(({ personalEmail, academicEmail, role }) => ({
      personalEmail,
      academicEmail,
      role,
    })), [
      {
        personalEmail: "student@mail.example",
        academicEmail: "student@university.example",
        role: "Student",
      },
      {
        personalEmail: "instructor@mail.example",
        academicEmail: "instructor@university.example",
        role: "Instructor",
      },
    ]);
  } finally {
    invitationService.createInvitation = originalCreateInvitation;
  }
});

test("invitation controller returns the safe provider failure instead of the generic server response", async () => {
  const originalCreateInvitation = invitationService.createInvitation;
  const response = {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set() {},
  };

  invitationService.createInvitation = async () => {
    const error = new Error(
      "The invitation record was created but then revoked. Resend validation_error (HTTP 422): Sender is not verified."
    );
    error.code = "EMAIL_DELIVERY_FAILED";
    error.statusCode = 502;
    throw error;
  };

  try {
    await invitationController.createInvitation({
      body: {
        fullName: "Test User",
        personalEmail: "personal@example.invalid",
        academicEmail: "academic@example.invalid",
        role: "Student",
      },
      user: { userId: 1 },
      get: () => "test-agent",
    }, response);

    assert.equal(response.statusCode, 502);
    assert.match(response.body.message, /Resend validation_error \(HTTP 422\)/);
    assert.match(response.body.message, /Sender is not verified/);
  } finally {
    invitationService.createInvitation = originalCreateInvitation;
  }
});

test("invitation service stores academic email and sends each role's invitation to personal email", async () => {
  const emailService = emailDeliveryService;
  const invitationServicePath = require.resolve(
    "../authentication/services/invitationService"
  );
  const cachedInvitationService = require.cache[invitationServicePath];
  const originalSendEmail = emailService.sendEmail;
  const originalConnect = pool.connect;
  const originalRevoke = invitationModel.revokeActiveInvitationsByEmails;
  const originalRevokeInvitation = invitationModel.revokeInvitation;
  const originalCreate = invitationModel.createInvitation;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const sentEmails = [];
  const persistedInvitations = [];
  const lockedAddressSets = [];
  const revokedInvitationIds = [];
  let failNextDelivery = false;
  const client = {
    query: async (query) => {
      if (/AND role = 'Admin'/i.test(query)) {
        return { rows: [{ user_id: 1 }], rowCount: 1 };
      }
      if (/SELECT user_id/i.test(query)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };

  emailService.sendEmail = async (message) => {
    if (failNextDelivery) {
      failNextDelivery = false;
      throw emailService.toEmailDeliveryError({
        name: "validation_error",
        statusCode: 422,
        message: "Provider rejected safe-test@example.invalid; key=re_test_private_value.",
      });
    }
    sentEmails.push(message);
  };
  process.env.FRONTEND_URL = "https://course-feedback.example";
  pool.connect = async () => client;
  invitationModel.revokeActiveInvitationsByEmails = async (emails) => {
    lockedAddressSets.push(emails);
  };
  invitationModel.revokeInvitation = async (invitationId) => {
    revokedInvitationIds.push(invitationId);
    return true;
  };
  invitationModel.createInvitation = async (input) => {
    persistedInvitations.push(input);
    return {
      invitation_id: persistedInvitations.length,
      email: input.email,
      academic_email: input.academicEmail,
      full_name: input.fullName,
      role: input.role,
      expires_at: input.expiresAt,
    };
  };
  delete require.cache[invitationServicePath];
  const isolatedInvitationService = require(invitationServicePath);

  try {
    for (const role of ["Student", "Instructor"]) {
      await isolatedInvitationService.createInvitation({
        fullName: `Test ${role}`,
        personalEmail: `${role.toLowerCase()}@Mail.Example`,
        academicEmail: `${role.toLowerCase()}@University.Example`,
        role,
        invitedBy: 1,
      });
    }

    assert.deepEqual(persistedInvitations.map((invitation) => ({
      email: invitation.email,
      academicEmail: invitation.academicEmail,
      role: invitation.role,
    })), [
      {
        email: "student@mail.example",
        academicEmail: "student@university.example",
        role: "Student",
      },
      {
        email: "instructor@mail.example",
        academicEmail: "instructor@university.example",
        role: "Instructor",
      },
    ]);
    assert.deepEqual(sentEmails.map(({ to }) => to), [
      "student@mail.example",
      "instructor@mail.example",
    ]);
    assert.ok(sentEmails[0].html.includes("student@university.example"));
    assert.ok(sentEmails[1].html.includes("instructor@university.example"));
    assert.deepEqual(lockedAddressSets, [
      ["student@mail.example", "student@university.example"],
      ["instructor@mail.example", "instructor@university.example"],
    ]);

    failNextDelivery = true;
    await assert.rejects(
      isolatedInvitationService.createInvitation({
        fullName: "Retry Student",
        personalEmail: "student@mail.example",
        academicEmail: "student@university.example",
        role: "Student",
        invitedBy: 1,
      }),
      (error) => {
        assert.equal(error.code, "EMAIL_DELIVERY_FAILED");
        assert.equal(error.statusCode, 502);
        assert.match(error.message, /validation_error \(HTTP 422\)/);
        assert.match(error.message, /was created but then revoked/);
        assert.doesNotMatch(error.message, /safe-test@example\.invalid|re_test_private_value/);
        return true;
      }
    );

    await isolatedInvitationService.createInvitation({
      fullName: "Retry Student",
      personalEmail: "student@mail.example",
      academicEmail: "student@university.example",
      role: "Student",
      invitedBy: 1,
    });

    assert.deepEqual(revokedInvitationIds, [3]);
    assert.equal(persistedInvitations.length, 4);
    assert.deepEqual(lockedAddressSets.slice(2), [
      ["student@mail.example", "student@university.example"],
      ["student@mail.example", "student@university.example"],
    ]);
    assert.deepEqual(sentEmails.map(({ to }) => to), [
      "student@mail.example",
      "instructor@mail.example",
      "student@mail.example",
    ]);
  } finally {
    emailService.sendEmail = originalSendEmail;
    pool.connect = originalConnect;
    invitationModel.revokeActiveInvitationsByEmails = originalRevoke;
    invitationModel.revokeInvitation = originalRevokeInvitation;
    invitationModel.createInvitation = originalCreate;
    if (originalFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = originalFrontendUrl;
    }
    delete require.cache[invitationServicePath];
    if (cachedInvitationService) {
      require.cache[invitationServicePath] = cachedInvitationService;
    }
  }
});

test("accepting either invitee role activates immediately without sending a verification email", async () => {
  const originalConnect = pool.connect;
  const originals = {
    findInvitationForUpdate: invitationModel.findInvitationForUpdate,
    markInvitationAccepted: invitationModel.markInvitationAccepted,
    findUserByEmailAddresses: authModel.findUserByEmailAddresses,
    createUser: authModel.createUser,
    activateVerifiedUser: authModel.activateVerifiedUser,
    sendVerificationEmail: emailVerificationService.sendVerificationEmail,
  };
  const queries = [];
  const activatedUserIds = [];
  let invitation = {
    invitation_id: 44,
    email: "student@mail.example",
    academic_email: "student@university.example",
    full_name: "Test Student",
    role: "Student",
    expires_at: new Date(Date.now() + 60_000),
  };
  const createdUsers = [];
  const verificationUserIds = [];
  const client = {
    query: async (query, params) => {
      queries.push({ query, params });
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };

  pool.connect = async () => client;
  invitationModel.findInvitationForUpdate = async () => invitation;
  invitationModel.markInvitationAccepted = async () => true;
  authModel.findUserByEmailAddresses = async () => null;
  authModel.createUser = async (input) => {
    createdUsers.push(input);
    return {
      user_id: 16 + createdUsers.length,
      full_name: input.fullName,
      email: input.email,
      personal_email: input.personalEmail,
      role: input.role,
    };
  };
  authModel.activateVerifiedUser = async () => {
    activatedUserIds.push(16 + createdUsers.length);
    return true;
  };
  emailVerificationService.sendVerificationEmail = async (userId) => {
    verificationUserIds.push(userId);
  };

  try {
    const studentResult = await acceptInvitationService.acceptInvitation({
      token: "a".repeat(48),
      password: "StrongPassword1!",
    });
    invitation = {
      invitation_id: 45,
      email: "instructor@mail.example",
      academic_email: "instructor@university.example",
      full_name: "Test Instructor",
      role: "Instructor",
      expires_at: new Date(Date.now() + 60_000),
    };
    const instructorResult = await acceptInvitationService.acceptInvitation({
      token: "b".repeat(48),
      password: "StrongPassword1!",
    });

    assert.deepEqual(createdUsers.map(({ email, personalEmail, role }) => ({
      email,
      personalEmail,
      role,
    })), [
      {
        email: "student@university.example",
        personalEmail: "student@mail.example",
        role: "Student",
      },
      {
        email: "instructor@university.example",
        personalEmail: "instructor@mail.example",
        role: "Instructor",
      },
    ]);
    assert.equal(studentResult.user.email, "student@university.example");
    assert.equal(studentResult.user.personalEmail, "student@mail.example");
    assert.equal(instructorResult.user.email, "instructor@university.example");
    assert.equal(instructorResult.user.personalEmail, "instructor@mail.example");
    assert.match(studentResult.message, /created and activated/);
    assert.match(instructorResult.message, /created and activated/);
    assert.deepEqual(activatedUserIds, [17, 18]);
    assert.deepEqual(verificationUserIds, []);
    assert.ok(queries.some(({ query }) => query === "COMMIT"));
    assert.equal(queries.filter(({ query }) => query === "COMMIT").length, 2);
  } finally {
    pool.connect = originalConnect;
    Object.assign(invitationModel, {
      findInvitationForUpdate: originals.findInvitationForUpdate,
      markInvitationAccepted: originals.markInvitationAccepted,
    });
    Object.assign(authModel, {
      findUserByEmailAddresses: originals.findUserByEmailAddresses,
      createUser: originals.createUser,
      activateVerifiedUser: originals.activateVerifiedUser,
    });
    emailVerificationService.sendVerificationEmail =
      originals.sendVerificationEmail;
  }
});

test("verification resend endpoint validates input and preserves the generic response", async () => {
  const originalResend = emailVerificationService.resendVerificationEmail;
  const requestedEmails = [];
  emailVerificationService.resendVerificationEmail = async (email) => {
    requestedEmails.push(email);
    return {
      message: "If an eligible account exists, a verification email has been sent.",
    };
  };
  const makeResponse = () => ({
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    set() {},
  });

  try {
    const invalidResponse = makeResponse();
    await emailVerificationController.resendVerificationEmail(
      { body: { email: "not-an-email" } },
      invalidResponse
    );
    assert.equal(invalidResponse.statusCode, 400);
    assert.equal(requestedEmails.length, 0);

    const validResponse = makeResponse();
    await emailVerificationController.resendVerificationEmail(
      { body: { email: "student@university.example" } },
      validResponse
    );
    assert.equal(validResponse.statusCode, 200);
    assert.deepEqual(requestedEmails, ["student@university.example"]);
    assert.match(validResponse.body.message, /If an eligible account exists/);
  } finally {
    emailVerificationService.resendVerificationEmail = originalResend;
  }
});

test("course assignment inserts the exact student-course-semester tuple", async () => {
  let capturedParams;
  let capturedQuery;
  const db = {
    query: async (query, params) => {
      capturedQuery = query;
      capturedParams = params;
      return {
        rows: [{ enrollment_id: 91, student_id: 17, course_id: 8, semester_id: 4 }],
      };
    },
  };

  const enrollment = await adminUserModel.addStudentEnrollment(17, 8, 4, db);
  assert.equal(enrollment.enrollment_id, 91);
  assert.deepEqual(capturedParams, [17, 8, 4]);
  assert.match(capturedQuery, /INSERT INTO enrollments \(student_id, course_id, semester_id\)/);
  assert.match(capturedQuery, /ON CONFLICT \(student_id, course_id, semester_id\) DO NOTHING/);
  assert.match(capturedQuery, /role = 'Student'/);
});

test("instructor choices expose academic email only", async () => {
  let capturedQuery;
  const expected = [{
    instructor_id: 23,
    full_name: "Test Instructor",
    email: "instructor@university.example",
  }];
  const db = {
    query: async (query) => {
      capturedQuery = query;
      return { rows: expected };
    },
  };

  assert.deepEqual(await adminUserModel.getInstructors(db), expected);
  assert.match(capturedQuery, /WHERE u\.role = 'Instructor'/);
  assert.match(capturedQuery, /u\.user_id AS instructor_id/);
  assert.match(capturedQuery, /LEFT JOIN course_instructors ci/);
  assert.match(capturedQuery, /ci\.semester_id/);
  assert.match(capturedQuery, /json_agg/);
  assert.match(capturedQuery, /email/);
  assert.doesNotMatch(capturedQuery, /personal_email/i);
});

test("instructor course assignment writes the course-instructor-semester relation", async () => {
  let capturedParams;
  let capturedQuery;
  const db = {
    query: async (query, params) => {
      capturedQuery = query;
      capturedParams = params;
      return {
        rows: [{
          course_instructor_id: 91,
          instructor_id: 23,
          course_id: 8,
          semester_id: 4,
        }],
      };
    },
  };

  const assignment = await adminUserModel.addInstructorCourseAssignment(
    23,
    8,
    4,
    db
  );

  assert.equal(assignment.course_instructor_id, 91);
  assert.deepEqual(capturedParams, [23, 8, 4]);
  assert.match(capturedQuery, /INSERT INTO course_instructors/);
  assert.match(capturedQuery, /course_id,\s*semester_id,\s*instructor_id/);
  assert.match(capturedQuery, /role = 'Instructor'/);
  assert.match(capturedQuery, /ON CONFLICT \(course_id, semester_id, instructor_id\) DO NOTHING/);
  assert.doesNotMatch(capturedQuery, /INSERT INTO enrollments/);
});

test("duplicate instructor course assignment does not insert a second relationship", async () => {
  let queryCount = 0;
  const db = {
    query: async () => {
      queryCount += 1;
      if (queryCount === 1) return { rows: [] };
      return { rowCount: 1, rows: [{}] };
    },
  };

  assert.equal(
    await adminUserModel.addInstructorCourseAssignment(23, 8, 4, db),
    null
  );
  assert.equal(queryCount, 4);
});

test("multiple Student enrollments commit together with the selected semester", async () => {
  const queries = [];
  const client = {
    query: async (query, params) => {
      queries.push({ query, params });
      if (/SELECT user_id/i.test(query)) {
        return { rowCount: 1, rows: [{ user_id: 17 }] };
      }
      if (/SELECT course_id/i.test(query)) {
        return { rowCount: 2, rows: [{ course_id: 8 }, { course_id: 9 }] };
      }
      if (/SELECT semester_id/i.test(query)) {
        return { rowCount: 1, rows: [{ semester_id: 4 }] };
      }
      if (/INSERT INTO enrollments/i.test(query)) {
        return {
          rowCount: 2,
          rows: [
            { enrollment_id: 91, student_id: 17, course_id: 8, semester_id: 4 },
            { enrollment_id: 92, student_id: 17, course_id: 9, semester_id: 4 },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {
      queries.push({ query: "RELEASE" });
    },
  };

  const result = await adminUserModel.addStudentEnrollments(
    17,
    [8, 9],
    4,
    { connect: async () => client }
  );

  assert.equal(result.assignments.length, 2);
  assert.deepEqual(result.alreadyAssignedCourseIds, []);
  const insert = queries.find(({ query }) => /INSERT INTO enrollments/i.test(query));
  assert.deepEqual(insert.params, [17, [8, 9], 4]);
  assert.match(insert.query, /UNNEST\(\$2::int\[\]\)/);
  assert.match(insert.query, /ON CONFLICT \(student_id, course_id, semester_id\) DO NOTHING/);
  assert.ok(queries.some(({ query }) => query === "COMMIT"));
  assert.ok(!queries.some(({ query }) => query === "ROLLBACK"));
});

test("multiple Instructor assignments use course_instructors and report existing duplicates", async () => {
  const queries = [];
  const client = {
    query: async (query, params) => {
      queries.push({ query, params });
      if (/SELECT user_id/i.test(query)) {
        assert.deepEqual(params, [23, "Instructor"]);
        return { rowCount: 1, rows: [{ user_id: 23 }] };
      }
      if (/SELECT course_id/i.test(query)) {
        return { rowCount: 2, rows: [{ course_id: 8 }, { course_id: 9 }] };
      }
      if (/SELECT semester_id/i.test(query)) {
        return { rowCount: 1, rows: [{ semester_id: 4 }] };
      }
      if (/INSERT INTO course_instructors/i.test(query)) {
        return {
          rowCount: 1,
          rows: [{
            course_instructor_id: 91,
            instructor_id: 23,
            course_id: 8,
            semester_id: 4,
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {
      queries.push({ query: "RELEASE" });
    },
  };

  const result = await adminUserModel.addInstructorCourseAssignments(
    23,
    [8, 9],
    4,
    { connect: async () => client }
  );

  assert.equal(result.assignments.length, 1);
  assert.deepEqual(result.alreadyAssignedCourseIds, [9]);
  const insert = queries.find(({ query }) => /INSERT INTO course_instructors/i.test(query));
  assert.deepEqual(insert.params, [23, [8, 9], 4]);
  assert.match(insert.query, /ON CONFLICT \(course_id, semester_id, instructor_id\) DO NOTHING/);
  assert.ok(queries.some(({ query }) => query === "COMMIT"));
  assert.ok(!queries.some(({ query }) => query === "ROLLBACK"));
});

test("batch assignment rolls back without inserts if any selected course is missing", async () => {
  const queries = [];
  const client = {
    query: async (query) => {
      queries.push(query);
      if (/SELECT user_id/i.test(query)) {
        return { rowCount: 1, rows: [{ user_id: 23 }] };
      }
      if (/SELECT course_id/i.test(query)) {
        return { rowCount: 1, rows: [{ course_id: 8 }] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };

  await assert.rejects(
    adminUserModel.addInstructorCourseAssignments(
      23,
      [8, 9],
      4,
      { connect: async () => client }
    ),
    (error) => error.code === "COURSE_NOT_FOUND"
  );
  assert.ok(queries.includes("ROLLBACK"));
  assert.ok(!queries.some((query) => /INSERT INTO course_instructors/i.test(query)));
});

test("course assignment reports a missing student instead of treating it as a duplicate", async () => {
  let queryCount = 0;
  const db = {
    query: async () => {
      queryCount += 1;
      return queryCount === 1 ? { rows: [] } : { rowCount: 0, rows: [] };
    },
  };

  await assert.rejects(
    adminUserModel.addStudentEnrollment(404, 8, 4, db),
    (error) => error.code === "STUDENT_NOT_FOUND"
  );
  assert.equal(queryCount, 2);
});

test("course assignment removal is constrained to the requested student and semester", async () => {
  let capturedQuery;
  let capturedParams;
  const db = {
    query: async (query, params) => {
      capturedQuery = query;
      capturedParams = params;
      return { rowCount: 1, rows: [{ enrollment_id: 91 }] };
    },
  };

  assert.equal(await adminUserModel.removeStudentEnrollment(17, 8, 4, db), true);
  assert.deepEqual(capturedParams, [17, 8, 4]);
  assert.match(capturedQuery, /DELETE FROM enrollments e/);
  assert.match(capturedQuery, /e\.semester_id = \$3/);
  assert.match(capturedQuery, /u\.role = 'Student'/);
});

test("batch assignment controller dispatches each role and rejects empty selections", async () => {
  const originalAddStudentEnrollments = adminUserModel.addStudentEnrollments;
  const originalAddInstructorCourseAssignments =
    adminUserModel.addInstructorCourseAssignments;
  const calls = [];

  adminUserModel.addStudentEnrollments = async (...args) => {
    calls.push({ role: "Student", args });
    return {
      assignments: [{ course_id: 8 }],
      alreadyAssignedCourseIds: [9],
    };
  };
  adminUserModel.addInstructorCourseAssignments = async (...args) => {
    calls.push({ role: "Instructor", args });
    return {
      assignments: [{ course_id: 8 }],
      alreadyAssignedCourseIds: [9],
    };
  };

  function createResponse() {
    return {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
  }

  try {
    const studentResponse = createResponse();
    await adminUserController.addEnrollment({
      params: { studentId: "17" },
      body: { courseIds: ["8", "9", "8"], semesterId: "4" },
    }, studentResponse);

    const instructorResponse = createResponse();
    await adminUserController.addInstructorCourseAssignment({
      params: { instructorId: "23" },
      body: { courseIds: ["8", "9"], semesterId: "4" },
    }, instructorResponse);

    const invalidResponse = createResponse();
    await adminUserController.addEnrollment({
      params: { studentId: "17" },
      body: { courseIds: [], semesterId: "4" },
    }, invalidResponse);

    assert.deepEqual(calls, [
      { role: "Student", args: [17, [8, 9], 4] },
      { role: "Instructor", args: [23, [8, 9], 4] },
    ]);
    assert.equal(studentResponse.statusCode, 201);
    assert.match(studentResponse.body.message, /1 already assigned course was skipped/);
    assert.equal(instructorResponse.statusCode, 201);
    assert.equal(invalidResponse.statusCode, 400);
  } finally {
    adminUserModel.addStudentEnrollments = originalAddStudentEnrollments;
    adminUserModel.addInstructorCourseAssignments =
      originalAddInstructorCourseAssignments;
  }
});

test("admin student controller rejects invalid IDs and names before database access", async () => {
  const originalGetStudentById = adminUserModel.getStudentById;
  const originalUpdateStudentName = adminUserModel.updateStudentName;
  let modelCalled = false;
  adminUserModel.getStudentById = async () => {
    modelCalled = true;
  };
  adminUserModel.updateStudentName = async () => {
    modelCalled = true;
  };

  function createResponse() {
    return {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
  }

  try {
    const invalidIdResponse = createResponse();
    await adminUserController.getStudent(
      { params: { studentId: "1.5" } },
      invalidIdResponse
    );
    assert.equal(invalidIdResponse.statusCode, 400);

    const invalidNameResponse = createResponse();
    await adminUserController.updateStudent(
      { params: { studentId: "17" }, body: { fullName: " " } },
      invalidNameResponse
    );
    assert.equal(invalidNameResponse.statusCode, 400);
    assert.equal(modelCalled, false);
  } finally {
    adminUserModel.getStudentById = originalGetStudentById;
    adminUserModel.updateStudentName = originalUpdateStudentName;
  }
});

test("admin dashboard counts students, instructors, courses, and active surveys", async () => {
  let capturedQuery;
  const db = {
    query: async (query) => {
      capturedQuery = query;
      return {
        rows: [{
          total_students: "12",
          total_instructors: "3",
          total_surveys: "5",
          active_surveys: "2",
          total_responses: "40",
          total_courses: "8",
        }],
      };
    },
  };

  assert.deepEqual(await dashboardModel.getDashboardStats(db), {
    total_students: 12,
    total_instructors: 3,
    total_surveys: 5,
    active_surveys: 2,
    total_responses: 40,
    total_courses: 8,
  });
  assert.match(capturedQuery, /WHERE role = 'Student'/);
  assert.match(capturedQuery, /WHERE role = 'Instructor'/);
  assert.match(capturedQuery, /status = 'Published'[\s\S]*opening_date <= CURRENT_TIMESTAMP[\s\S]*closing_date > CURRENT_TIMESTAMP/);
});
