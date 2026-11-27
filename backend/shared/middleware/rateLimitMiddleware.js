
const requests = new Map();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 5;

function rateLimitMiddleware(req, res, next) {
    // The authentication middleware must run first.
    const studentId = req.user?.user_id;

    if (!studentId) {
        return res.status(401).json({
            success: false,
            message: "Authentication is required.",
            code: "STUDENT_ID_REQUIRED",
        });
    }

    const now = Date.now();
    const key = String(studentId);

    let record = requests.get(key);

    // Start a new time window if necessary.
    if (!record || now >= record.resetAt) {
        record = {
            count: 0,
            resetAt: now + WINDOW_MS,
        };
    }

    if (record.count >= MAX_REQUESTS) {
        const retryAfter = Math.max(
            1,
            Math.ceil((record.resetAt - now) / 1000)
        );

        res.set("Retry-After", String(retryAfter));

        return res.status(429).json({
            success: false,
            message: "Too many feedback submission attempts. Please try again later.",
            code: "RATE_LIMIT_EXCEEDED",
        });
    }

    record.count += 1;
    requests.set(key, record);

    // Clean expired records.
    for (const [storedKey, storedRecord] of requests.entries()) {
        if (now >= storedRecord.resetAt) {
            requests.delete(storedKey);
        }
    }

    return next();
}

module.exports = rateLimitMiddleware;
