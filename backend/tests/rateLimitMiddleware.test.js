const assert = require("node:assert/strict");
const { test } = require("node:test");

const rateLimitMiddleware = require("../middleware/rateLimitMiddleware");

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
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

test("allows five submissions and rejects the sixth attempt in the window", () => {
  const studentId = Math.floor(Math.random() * 1_000_000_000) + 1_000_000_000;
  const request = { user: { user_id: studentId } };
  let nextCalls = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    rateLimitMiddleware(request, createResponse(), () => {
      nextCalls += 1;
    });
  }

  const response = createResponse();
  rateLimitMiddleware(request, response, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 5);
  assert.equal(response.statusCode, 429);
  assert.equal(response.body.code, "RATE_LIMIT_EXCEEDED");
  assert.ok(Number(response.headers["Retry-After"]) > 0);
});
