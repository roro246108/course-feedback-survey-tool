// SurveyManagementLambda
//
// Entry point: survey-management/lambda/surveyManagementLambda.handler
//
// Handles two kinds of invocation:
//   1. API Gateway HTTP API (payload format 2.0) for the Survey Management
//      routes in ./routes.js. Authentication and Admin authorization reuse the
//      shared authenticateToken and authorizeRole middleware.
//   2. Direct, IAM-authorized Lambda invocation from AnonymousFeedbackLambda
//      for student eligibility ("4b. direct invoke" in the architecture):
//        { "action": "checkStudentEligibility", "surveyId": 1, "studentId": 2 }
//        { "action": "listEligibleSurveys", "studentId": 2 }
//      API Gateway always wraps requests in a 2.0 envelope, so these payloads
//      cannot be sent by internet clients.
//
// Existing business logic is reused unchanged: controllers -> handlers ->
// models -> Neon PostgreSQL.

const {
    HttpError,
    createResponseRecorder,
    isApiGatewayV2Event,
    jsonResponse,
    runExpressChain,
    toExpressRequest,
    toLambdaResponse
} = require('./apiGatewayAdapter');
const { buildRouteDefinitions, createRouter } = require('./routes');
const { createRuntimeConfigLoader } = require('./runtimeConfig');
const { createSurveyLifecycleNotifier } = require('../events/surveyLifecycleNotifier');
const {
    createDisabledPublisher,
    createEventBridgePublisher
} = require('../events/eventBridgePublisher');

const REQUIRED_CONFIG_KEYS = ['DATABASE_URL', 'ACCESS_TOKEN_SECRET'];
const EVENT_STATUS_HEADER = 'x-survey-event-status';

const DIRECT_ACTIONS = Object.freeze({
    CHECK_STUDENT_ELIGIBILITY: 'checkStudentEligibility',
    LIST_ELIGIBLE_SURVEYS: 'listEligibleSurveys'
});

const parseSurveyId = (value) => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const createPublisherFromEnv = (env) => {
    if (env.SURVEY_EVENTS_ENABLED === 'false' || !env.EVENT_BUS_NAME) {
        return createDisabledPublisher();
    }

    return createEventBridgePublisher({ eventBusName: env.EVENT_BUS_NAME });
};

// Builds the application. Modules that read secrets at import time
// (tokenService, database pools) are required here, after secrets load.
const buildApp = ({
    env = process.env,
    logger = console,
    surveyController,
    dashboardController,
    authenticateToken,
    authorizeRole,
    surveyModel,
    eligibilityHandler,
    publisher
} = {}) => {
    const controllers = {
        surveyController:
            surveyController || require('../controllers/surveyController'),
        dashboardController:
            dashboardController || require('../controllers/dashboardController')
    };
    const authenticate =
        authenticateToken || require('../../shared/middleware/authenticateToken');
    const authorize =
        authorizeRole || require('../../shared/middleware/authorizeRole');
    const model = surveyModel || require('../models/surveyModel');
    const eligibility =
        eligibilityHandler || require('../handlers/eligibilityHandler');

    const router = createRouter(buildRouteDefinitions(controllers));
    const authChain = [authenticate, authorize('Admin')];
    const notifier = createSurveyLifecycleNotifier({
        publisher: publisher || createPublisherFromEnv(env),
        loadSurvey: (surveyId) => model.getSurveyById(surveyId),
        logger
    });

    const publishLifecycleEvent = async (route, req, res, previousStatus) => {
        const succeeded =
            (res.statusCode === 200 || res.statusCode === 201) &&
            res.body &&
            res.body.success === true &&
            res.body.data &&
            typeof res.body.data.status === 'string';

        if (!succeeded) return null;

        const surveyId = route.lifecycle === 'create'
            ? parseSurveyId(res.body.data.survey_id)
            : parseSurveyId(req.params.id);

        if (!surveyId) return null;

        return notifier.notifyIfTransitioned({
            surveyId,
            previousStatus: route.lifecycle === 'create' ? null : previousStatus,
            newStatus: res.body.data.status
        });
    };

    const handleHttp = async (event) => {
        const startedAt = Date.now();
        let req;

        try {
            req = toExpressRequest(event);
        } catch (error) {
            if (error instanceof HttpError) {
                return jsonResponse(error.statusCode, {
                    success: false,
                    message: error.message
                });
            }
            throw error;
        }

        const matched = router.match(req.method, req.path);

        if (!matched) {
            return jsonResponse(404, {
                success: false,
                message: 'Route not found.'
            });
        }

        if (matched.methodNotAllowed) {
            return jsonResponse(405, {
                success: false,
                message: 'Method not allowed.'
            }, { allow: matched.allow.join(', ') });
        }

        const { route } = matched;
        req.params = matched.params;
        const res = createResponseRecorder();
        let extraHeaders = {};

        try {
            // When the chain responds, authentication or authorization failed
            // (401/403) and the route handler must not run.
            const rejected = await runExpressChain(authChain, req, res);

            if (!rejected) {
                let previousStatus = null;
                const surveyId = parseSurveyId(req.params.id);

                if (route.lifecycle === 'update' && surveyId) {
                    previousStatus = await model.getSurveyStatus(surveyId);
                }

                const responded = await runExpressChain([route.handler], req, res);

                if (!responded) {
                    throw new Error('The route handler did not send a response.');
                }

                if (route.lifecycle) {
                    const eventResult = await publishLifecycleEvent(
                        route,
                        req,
                        res,
                        previousStatus
                    );

                    if (eventResult && eventResult.status !== 'none') {
                        extraHeaders = { [EVENT_STATUS_HEADER]: eventResult.status };
                    }
                }
            }
        } catch (error) {
            logger.error('[survey-management] unhandled request error', {
                requestId: req.requestId,
                route: `${route.method} ${route.path}`,
                name: error && error.name,
                code: error && error.code,
                message: error && error.message
            });

            return jsonResponse(500, {
                success: false,
                message: 'An unexpected server error occurred.'
            });
        }

        logger.info('[survey-management] request completed', {
            requestId: req.requestId,
            route: `${route.method} ${route.path}`,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt
        });

        return toLambdaResponse(res, extraHeaders);
    };

    const handleDirectInvoke = async (event) => {
        try {
            if (event.action === DIRECT_ACTIONS.CHECK_STUDENT_ELIGIBILITY) {
                const data = await eligibility.checkStudentEligibility(
                    event.surveyId,
                    event.studentId
                );
                return { ok: true, data };
            }

            if (event.action === DIRECT_ACTIONS.LIST_ELIGIBLE_SURVEYS) {
                const data = await eligibility.listEligibleSurveys(event.studentId);
                return { ok: true, data };
            }

            return {
                ok: false,
                error: {
                    code: 'UNSUPPORTED_ACTION',
                    message: 'The requested action is not supported.'
                }
            };
        } catch (error) {
            if (error && error.code === 'INVALID_REQUEST') {
                return {
                    ok: false,
                    error: { code: 'INVALID_REQUEST', message: error.message }
                };
            }

            // Student IDs are intentionally not logged.
            logger.error('[survey-management] eligibility check failed', {
                action: event.action,
                code: error && error.code,
                name: error && error.name
            });

            return {
                ok: false,
                error: {
                    code: 'ELIGIBILITY_CHECK_UNAVAILABLE',
                    message: 'Student eligibility could not be verified.'
                }
            };
        }
    };

    return { handleHttp, handleDirectInvoke };
};

const isDirectInvokeEvent = (event) =>
    Boolean(
        event &&
        typeof event === 'object' &&
        typeof event.action === 'string' &&
        !event.requestContext
    );

const createSurveyManagementLambda = ({
    configLoader = createRuntimeConfigLoader(),
    appFactory = buildApp,
    logger = console
} = {}) => {
    let app = null;

    return async (event) => {
        const isHttp = isApiGatewayV2Event(event);
        const isDirect = !isHttp && isDirectInvokeEvent(event);

        if (!isHttp && !isDirect) {
            logger.warn('[survey-management] unsupported event received');
            return {
                ok: false,
                error: {
                    code: 'UNSUPPORTED_EVENT',
                    message: 'SurveyManagementLambda received an unsupported event.'
                }
            };
        }

        try {
            await configLoader.load({ requiredKeys: REQUIRED_CONFIG_KEYS });
            if (!app) app = appFactory({ logger });
        } catch (error) {
            logger.error('[survey-management] startup failed', {
                code: error && error.code,
                details: error && error.details
            });

            if (isHttp) {
                return jsonResponse(503, {
                    success: false,
                    message: 'The survey service is temporarily unavailable.'
                });
            }

            return {
                ok: false,
                error: {
                    code: 'SERVICE_UNAVAILABLE',
                    message: 'The survey service is temporarily unavailable.'
                }
            };
        }

        return isHttp ? app.handleHttp(event) : app.handleDirectInvoke(event);
    };
};

const handler = createSurveyManagementLambda();

module.exports = {
    DIRECT_ACTIONS,
    EVENT_STATUS_HEADER,
    REQUIRED_CONFIG_KEYS,
    buildApp,
    createSurveyManagementLambda,
    handler
};
