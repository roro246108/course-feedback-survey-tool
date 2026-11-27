
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const { sendEmail } = require("../notifications/emailService");

async function testEmail() {
  try {
    const result = await sendEmail({
      to: process.env.TEST_EMAIL,
      subject: "Course Feedback - Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>Course Feedback System</h2>
          <p>Hello!</p>
          <p>This is a test email from the Course Feedback Survey Tool.</p>
          <p>Our email service is connected successfully.</p>
        </div>
      `,
      text: "This is a test email from the Course Feedback Survey Tool.",
    });

    console.log("Test email accepted by Resend.");
    console.log("Email ID:", result.id);
  } catch (error) {
    console.error("Email test failed:", error.message);
    process.exitCode = 1;
  }
}

testEmail();
