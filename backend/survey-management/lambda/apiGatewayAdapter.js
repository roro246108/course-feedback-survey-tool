// Adapter between API Gateway HTTP API (payload format 2.0) and the existing
// Express-style Survey Management middleware and controllers.
//
// The controllers only use req.params, req.query, req.body, req.headers,
// req.user, res.status() and res.json(). This adapter provides exactly that
// surface, so the same controllers serve both Express (local) and Lambda.

const MAX_BODY_BYTES = 10 * 1024; // Same limit as express.json({ limit: '10kb' })

const BASE_RESPONSE_HEADERS = Object.freeze({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
});

class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
    }
}

const isApiGatewayV2Event = (event) =>
    Boolean(
        event &&
        typeof event === 'object' &&
        event.version === '2.0' &&
        event.requestContext &&
        event.requestContext.http &&
        typeof event.requestContext.http.method === 'string'
    );

const jsonResponse = (statusCode, body, extraHeaders = {}) => ({
    statusCode,
    headers: { ...BASE_RESPONSE_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
    isBase64Encoded: false
});

const normalizeHeaders = (event) => {
    const headers = {};

    for (const [name, value] of Object.entries(event.headers || {})) {
        if (typeof value === 'string') {
            headers[name.toLowerCase()] = value;
        }
    }

    // Payload 2.0 moves cookies out of the headers object.
    if (Array.isArray(event.cookies) && event.cookies.length > 0) {
        headers.cookie = event.cookies.join('; ');
    }

    return headers;
};

const normalizePath = (event) => {
    let path = typeof event.rawPath === 'string' && event.rawPath
        ? event.rawPath
        : '/';

    // When a named stage is used, rawPath starts with "/<stage>".
    const stage = event.requestContext && event.requestContext.stage;
    if (
        typeof stage === 'string' &&
        stage &&
        stage !== '$default' &&
        (path === `/${stage}` || path.startsWith(`/${stage}/`))
    ) {
        path = path.slice(stage.length + 1) || '/';
    }

    // Express ignores one trailing slash by default; do the same.
    if (path.length > 1 && path.endsWith('/')) {
        path = path.replace(/\/+$/, '') || '/';
    }

    return path;
};

const parseBody = (event, headers) => {
    if (event.body === undefined || event.body === null || event.body === '') {
        return undefined;
    }

    const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64')
        : Buffer.from(String(event.body), 'utf8');

    if (rawBody.length > MAX_BODY_BYTES) {
        throw new HttpError(413, 'Request body is too large.');
    }

    // Like express.json(), only JSON bodies are parsed.
    const contentType = headers['content-type'] || '';
    if (!/^application\/(?:[\w.+-]+\+)?json\b/i.test(contentType)) {
        return undefined;
    }

    try {
        return JSON.parse(rawBody.toString('utf8'));
    } catch {
        throw new HttpError(400, 'Request body must be valid JSON.');
    }
};

const toExpressRequest = (event, params = {}) => {
    const headers = normalizeHeaders(event);

    return {
        method: event.requestContext.http.method.toUpperCase(),
        path: normalizePath(event),
        headers,
        params,
        query: { ...(event.queryStringParameters || {}) },
        body: parseBody(event, headers),
        requestId: event.requestContext.requestId,
        ip: event.requestContext.http.sourceIp
    };
};

// Minimal Express response object used by the existing controllers.
const createResponseRecorder = () => {
    let onFinish = () => {};

    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        headersSent: false,
        finished: false,

        status(code) {
            this.statusCode = code;
            return this;
        },

        set(name, value) {
            this.headers[String(name).toLowerCase()] = String(value);
            return this;
        },

        setHeader(name, value) {
            return this.set(name, value);
        },

        json(payload) {
            if (this.finished) {
                return this;
            }
            this.body = payload;
            this.finished = true;
            this.headersSent = true;
            onFinish();
            return this;
        },

        send(payload) {
            return this.json(payload);
        },

        _setOnFinish(callback) {
            onFinish = callback;
        }
    };

    return res;
};


const runExpressHandler = (handler, req, res) =>
    new Promise((resolve, reject) => {
        let settled = false;

        const settle = (callback, value) => {
            if (!settled) {
                settled = true;
                callback(value);
            }
        };

        res._setOnFinish(() => settle(resolve, 'finished'));

        const next = (error) => {
            if (error) {
                settle(reject, error);
            } else {
                settle(resolve, 'next');
            }
        };

        try {
            const result = handler(req, res, next);

            if (result && typeof result.then === 'function') {
                result.then(
                    () => settle(resolve, res.finished ? 'finished' : 'returned'),
                    (error) => settle(reject, error)
                );
            } else if (!settled) {
                settle(resolve, res.finished ? 'finished' : 'returned');
            }
        } catch (error) {
            settle(reject, error);
        }
    });

// Runs handlers in order until one responds. Returns true when a response
// was sent, false when every handler called next() (middleware-only chain).
const runExpressChain = async (handlers, req, res) => {
    for (const handler of handlers) {
        const outcome = await runExpressHandler(handler, req, res);

        if (outcome === 'finished') {
            return true;
        }

        if (outcome === 'returned') {
            throw new Error('A route handler finished without sending a response.');
        }
    }

    return res.finished;
};

const toLambdaResponse = (res, extraHeaders = {}) =>
    jsonResponse(res.statusCode, res.body ?? {}, {
        ...res.headers,
        ...extraHeaders
    });

module.exports = {
    BASE_RESPONSE_HEADERS,
    HttpError,
    MAX_BODY_BYTES,
    createResponseRecorder,
    isApiGatewayV2Event,
    jsonResponse,
    normalizePath,
    runExpressChain,
    toExpressRequest,
    toLambdaResponse
};
