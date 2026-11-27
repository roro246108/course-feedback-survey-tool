const assert = require("node:assert/strict");
const { test } = require("node:test");

const authMiddlewarePath = require.resolve("../middleware/authenticateToken.js");
const previousAuthModule = require.cache[authMiddlewarePath];
let authenticatedUser = null;

require.cache[authMiddlewarePath] = {
  id: authMiddlewarePath,
  filename: authMiddlewarePath,
  loaded: true,
  exports: (req, _res, next) => {
    if (authenticatedUser) req.user = { ...authenticatedUser };
    next();
  },
};

const requireStudent = require("../anonymous-feedback/handlers/requireStudent");

if (previousAuthModule) {
  require.cache[authMiddlewarePath] = previousAuthModule;
} else {
  delete require.cache[authMiddlewarePath];
}

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

test("student guard permits only Student role and maps authenticated ID", () => {
  authenticatedUser = { userId: 28, role: "Student" };
  const req = {};
  const res = createResponse();
  let nextCalled = false;

  requireStudent(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.user_id, 28);
});

test("student guard rejects a different authenticated role", () => {
  authenticatedUser = { userId: 28, role: "Instructor" };
  const res = createResponse();

  requireStudent({}, res, () => {
    assert.fail("next must not run for a non-student role");
  });

  assert.equal(res.statusCode, 403);
});

test("student guard rejects a request with no authenticated user", () => {
  authenticatedUser = null;
  const res = createResponse();

  requireStudent({}, res, () => {
    assert.fail("next must not run without an authenticated user");
  });

  assert.equal(res.statusCode, 401);
});
