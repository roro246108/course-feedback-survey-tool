function normalizeText(value, fieldName, required = false) {
  if (value === undefined || value === null) {
    if (required) {
      throw new TypeError(`${fieldName} is required.`);
    }
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }

  if (typeof value !== "string") {
    throw new TypeError(`${fieldName} must be a string or a valid Date.`);
  }

  const normalized = value.trim();
  if (required && !normalized) {
    throw new TypeError(`${fieldName} is required.`);
  }
  return normalized;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
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

function getSafeSurveyUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return null;
    }
    return parsedUrl.href;
  } catch {
    return null;
  }
}

function createSurveyReminderTemplate({
  studentName,
  surveyTitle,
  courseName,
  closingDate,
  surveyUrl,
} = {}) {
  const name = normalizeText(studentName, "studentName");
  const title = normalizeText(surveyTitle, "surveyTitle", true);
  const course = normalizeText(courseName, "courseName");
  const closing = normalizeText(closingDate, "closingDate");
  const safeUrl = getSafeSurveyUrl(surveyUrl);
  const greeting = name ? `Hello ${name},` : "Hello,";
  const htmlGreeting = name
    ? `Hello ${escapeHtml(name)},`
    : "Hello,";

  const detailLines = [];
  if (course) {
    detailLines.push(`Course: ${course}`);
  }
  if (closing) {
    detailLines.push(`Closing date: ${closing}`);
  }

  const htmlDetails = [
    course ? `<p><strong>Course:</strong> ${escapeHtml(course)}</p>` : "",
    closing
      ? `<p><strong>Closing date:</strong> ${escapeHtml(closing)}</p>`
      : "",
  ].join("");
  const htmlCallToAction = safeUrl
    ? `<p style="margin:28px 0"><a href="${escapeHtml(
        safeUrl
      )}" style="display:inline-block;background:#174a7e;color:#ffffff;padding:12px 20px;text-decoration:none;border-radius:4px;font-weight:600">Complete the survey</a></p>`
    : "";
  const textDetails = detailLines.length
    ? `\n${detailLines.join("\n")}\n`
    : "";
  const textCallToAction = safeUrl
    ? `\nComplete the survey: ${safeUrl}\n`
    : "";

  return {
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f6f9;color:#243447;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:640px;margin:32px auto;padding:0 16px">
      <div style="background:#174a7e;padding:22px 28px;color:#ffffff;border-radius:6px 6px 0 0">
        <p style="margin:0;font-size:13px;letter-spacing:1px;text-transform:uppercase">Course Feedback</p>
        <h1 style="margin:8px 0 0;font-size:24px">Survey reminder</h1>
      </div>
      <main style="background:#ffffff;padding:28px;border:1px solid #dce3ea;border-top:0;border-radius:0 0 6px 6px">
        <p style="margin-top:0">${htmlGreeting}</p>
        <p>Our records indicate that you have not submitted feedback for <strong>${escapeHtml(
          title
        )}</strong>.</p>
        ${htmlDetails}
        <p>Please complete the survey before it closes. Your feedback helps improve courses and the learning experience.</p>
        ${htmlCallToAction}
        <p>You may need to sign in to your student account before opening the survey.</p>
        <p style="margin-bottom:0;color:#526477">Thank you for taking the time to share your feedback.</p>
      </main>
    </div>
  </body>
</html>`,
    text: `Course Feedback — Survey reminder

${greeting}

Our records indicate that you have not submitted feedback for "${title}".
${textDetails}
Please complete the survey before it closes. Your feedback helps improve courses and the learning experience.
${textCallToAction}
You may need to sign in to your student account before opening the survey.

Thank you for taking the time to share your feedback.`,
  };
}

module.exports = { createSurveyReminderTemplate };
