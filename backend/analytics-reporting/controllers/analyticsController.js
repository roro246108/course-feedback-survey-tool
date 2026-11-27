
const analyticsService = require('../services/analyticsService');

class RequestError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const ENTITY_FILTERS = {
    courseId: 'course',
    semesterId: 'semester',
    instructorId: 'instructor'
};

const MAX_ID = 2147483647;
const DEFAULT_FEEDBACK_LIMIT = 6;
const MAX_FEEDBACK_LIMIT = 50;

const parsePositiveInteger = (raw, name, max = MAX_ID) => {
    if (raw === undefined || raw === '') {
        return null;
    }

    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || Number(raw) > max) {
        throw new RequestError(
            400,
            max === MAX_ID
                ? `${name} must be a positive whole number.`
                : `${name} must be a whole number between 1 and ${max}.`
        );
    }

    return Number(raw);
};

const readQuery = async (query, allowed) => {
    const filters = {};

    for (const name of allowed) {
        if (name === 'limit') {
            filters.limit =
                parsePositiveInteger(query.limit, 'limit', MAX_FEEDBACK_LIMIT)
                ?? DEFAULT_FEEDBACK_LIMIT;
        } else {
            filters[name] = parsePositiveInteger(query[name], name);
        }
    }

    for (const name of allowed) {
        const entity = ENTITY_FILTERS[name];

        if (entity && filters[name] !== null) {
            const exists = await analyticsService.entityExists(entity, filters[name]);

            if (!exists) {
                throw new RequestError(404, `No ${entity} found with ${name} ${filters[name]}.`);
            }
        }
    }

    return filters;
};

// Never trust instructorId supplied by the frontend.
// The authenticated user's ID is taken from authenticateToken middleware.
const getAuthorizedFilters = async (req, allowed) => {
    const query = { ...req.query };

    if (req.user.role === 'Instructor') {
        delete query.instructorId;
    }

    const filters = await readQuery(query, allowed);

    if (req.user.role === 'Instructor') {
        filters.instructorId = req.user.userId;
    }

    return filters;
};

const sendError = (res, error, errorMessage) => {
    if (error instanceof RequestError) {
        return res.status(error.status).json({
            success: false,
            message: error.message
        });
    }

    console.error(errorMessage, error);

    return res.status(500).json({
        success: false,
        message: errorMessage
    });
};

const handleRequest = (serviceMethod, errorMessage, allowedQuery = []) => {
    return async (req, res) => {
        try {
            const filters = await getAuthorizedFilters(req, allowedQuery);
            const data = await serviceMethod(filters);

            return res.status(200).json({
                success: true,
                data
            });

        } catch (error) {
            return sendError(res, error, errorMessage);
        }
    };
};

// 1. Overall Analytics
const getOverview = handleRequest(
    analyticsService.getOverview,
    'Failed to fetch analytics overview'
);

// 2. Feedback Trends
const getFeedbackTrends = handleRequest(
    analyticsService.getFeedbackTrends,
    'Failed to fetch feedback trends'
);

// 3. Semester Comparison
const getSemesterComparison = handleRequest(
    analyticsService.getSemesterComparison,
    'Failed to fetch semester comparison'
);

// 4. Course Performance
const getCoursePerformance = handleRequest(
    analyticsService.getCoursePerformance,
    'Failed to fetch course performance',
    ['semesterId', 'instructorId']
);

// 5. Instructor Performance
const getInstructorPerformance = handleRequest(
    analyticsService.getInstructorPerformance,
    'Failed to fetch instructor performance',
    ['semesterId', 'courseId']
);

// 6. Recent Feedback
const getRecentFeedback = async (req, res) => {
    const errorMessage = 'Failed to fetch recent feedback';

    try {
        const filters = await getAuthorizedFilters(
            req,
            ['courseId', 'semesterId', 'limit']
        );

        const { items, meta } =
            await analyticsService.getRecentFeedback(filters);

        return res.status(200).json({
            success: true,
            data: items,
            meta
        });

    } catch (error) {
        return sendError(res, error, errorMessage);
    }
};

// 7. Rating Distribution
const getRatingDistribution = handleRequest(
    analyticsService.getRatingDistribution,
    'Failed to fetch rating distribution',
    ['courseId', 'semesterId', 'instructorId']
);

// 8. Response Rates
const getResponseRates = handleRequest(
    analyticsService.getResponseRates,
    'Failed to fetch response rates',
    ['courseId', 'semesterId', 'instructorId']
);

module.exports = {
    getOverview,
    getFeedbackTrends,
    getSemesterComparison,
    getCoursePerformance,
    getInstructorPerformance,
    getRecentFeedback,
    getRatingDistribution,
    getResponseRates
};
