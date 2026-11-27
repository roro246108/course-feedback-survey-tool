import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import {
  getStudentSubmissionMetadata,
  submitFeedback,
} from "./feedbackService.js";
import { getEnrolledCourses } from "./availableSurveysService.js";

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

test("submit client uses canonical path and does not send student identity", async () => {
  let request;
  const apiFetch = async (url, options) => {
    request = { url, options };
    return jsonResponse({ success: true, data: { surveyId: 5 } }, 201);
  };
  await submitFeedback(5, [{ question_id: 10, rating_value: 4 }], apiFetch, "idem-key-test");
  assert.match(request.url, /\/api\/feedback\/submit$/);
  assert.equal(request.options.method, "POST");
  const body = JSON.parse(request.options.body);
  assert.equal(body.survey_id, 5);
  assert.equal("student_id" in body, false);
  assert.equal(request.options.headers["Idempotency-Key"], "idem-key-test");
});

test("enrolled courses client calls the authenticated student courses endpoint", async () => {
  let requestedUrl;
  const courses = await getEnrolledCourses(async (url) => {
    requestedUrl = url;
    return jsonResponse({ success: true, data: [{ course_id: 3, course_name: "Networks" }] });
  });

  assert.equal(requestedUrl, "http://localhost:5000/api/student/courses");
  assert.equal(courses[0].course_name, "Networks");
});

test("My Submissions client requests only the authenticated student's metadata endpoint", async () => {
  let requestedUrl;
  const metadata = [{
    id: 10,
    survey_title: "Course survey",
    course_name: "Networks",
    semester_name: "Fall",
    submitted_at: "2026-11-01T10:00:00Z",
    status: "Submitted",
  }];
  const rows = await getStudentSubmissionMetadata(async (url) => {
    requestedUrl = url;
    return jsonResponse({ success: true, data: metadata });
  });

  assert.equal(requestedUrl, "http://localhost:5000/api/student/submissions");
  assert.deepEqual(rows, metadata);
});

test("My Submissions page displays metadata without response-management actions", () => {
  const page = readFileSync(resolve("src/pages/student/MySubmissions.jsx"), "utf8");
  assert.match(page, /survey_title/);
  assert.match(page, /course_name/);
  assert.match(page, /semester_name/);
  assert.match(page, /submitted_at/);
  assert.match(page, /status/);
  assert.doesNotMatch(page, /rating_value|text_answer|feedback_answers|feedback_submissions/);
  assert.doesNotMatch(page, /View submission|Edit submission|Withdraw submission|Delete submission/i);
});

