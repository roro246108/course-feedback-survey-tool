const assert = require("node:assert/strict");
const { test } = require("node:test");

const originalCsrfSecret = process.env.CSRF_SECRET;
const originalFrontendUrl = process.env.FRONTEND_URL;
process.env.CSRF_SECRET = "csrf-unit-test-secret-that-is-at-least-32-bytes";
process.env.FRONTEND_URL = "http://frontend.test";

const { issueCsrfToken, csrfProtection } = require("../shared/middleware/csrfProtection");

if (originalCsrfSecret === undefined) {
  delete process.env.CSRF_SECRET;
} else {
  process.env.CSRF_SECRET = originalCsrfSecret;
}
if (originalFrontendUrl === undefined) {
  delete process.env.FRONTEND_URL;
} else {
  process.env.FRONTEND_URL = originalFrontendUrl;
}

test("CSRF cookie is scoped to the API and validates protected API mutations", () => {
  let issuedToken;
  let cookieOptions;
  let clearedCookieOptions;
  let responseStatus;
  let responseBody;
  const response = {
    clearCookie(name, options) {
      assert.equal(name, "csrfToken");
      clearedCookieOptions = options;
      return this;
    },
    cookie(name, value, options) {
      assert.equal(name, "csrfToken");
      issuedToken = value;
      cookieOptions = options;
      return this;
    },
    set() {
      return this;
    },
    status(status) {
      responseStatus = status;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  issueCsrfToken({}, response);

  assert.equal(cookieOptions.path, "/api");
  assert.equal(clearedCookieOptions.path, "/api/auth");
  assert.equal(responseStatus, 200);
  assert.equal(responseBody.csrfToken, issuedToken);

  let passed = false;
  csrfProtection({
    cookies: { csrfToken: issuedToken },
    get(name) {
      return name === "origin"
        ? "http://frontend.test"
        : name === "X-CSRF-Token"
          ? issuedToken
          : undefined;
    },
  }, response, () => {
    passed = true;
  });
  assert.equal(passed, true);

  responseStatus = null;
  responseBody = null;
  csrfProtection({
    cookies: { csrfToken: issuedToken },
    get(name) {
      return name === "origin"
        ? "http://frontend.test"
        : name === "X-CSRF-Token"
          ? "different-token"
          : undefined;
    },
  }, response, () => {
    throw new Error("Invalid CSRF token unexpectedly passed.");
  });
  assert.equal(responseStatus, 403);
  assert.equal(responseBody.message, "CSRF validation failed.");
});
