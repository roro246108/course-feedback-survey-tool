
const semesterComparisonService = require('../services/semesterComparisonService');

const MAX_ID = 2147483647;

const FILTERS = {
    courseId: 'course',
    instructorId: 'instructor'
};

class RequestError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const parsePositiveInteger = (raw, name) => {
    if (raw === undefined || raw === '') {
        return null;
    }

    if (
        typeof raw !== 'string' ||
        !/^[1-9]\d*$/.test(raw) ||
        Number(raw) > MAX_ID
    ) {
        throw new RequestError(
            400,
            `${name} must be a positive whole number.`
        );
    }

    return Number(raw);
};

const readFilters = async (query, allowedFilters) => {
    const filters = {};

    for (const name of allowedFilters) {
        filters[name] = parsePositiveInteger(query[name], name);
    }

    for (const name of allowedFilters) {
        const entity = FILTERS[name];

        if (entity && filters[name] !== null) {
            const exists = await semesterComparisonService.entityExists(
                entity,
                filters[name]
            );

            if (!exists) {
                throw new RequestError(
                    404,
                    `No ${entity} found with ${name} ${filters[name]}.`
                );
            }
        }
    }

    return filters;
};

const getSemesterComparison = async (req, res) => {
    try {
        let allowedFilters = ['courseId', 'instructorId'];

        // Instructors cannot choose another instructor's ID.
        // Their ID always comes from the authenticated session.
        if (req.user.role === 'Instructor') {
            allowedFilters = ['courseId'];
        }

        const filters = await readFilters(
            req.query,
            allowedFilters
        );

        if (req.user.role === 'Instructor') {
            filters.instructorId = req.user.userId;
        }

        const data =
            await semesterComparisonService.getSemesterComparison(filters);

        return res.status(200).json({
            success: true,
            data
        });

    } catch (error) {
        if (error instanceof RequestError) {
            return res.status(error.status).json({
                success: false,
                message: error.message
            });
        }

        console.error(
            'Semester Comparison Controller Error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve semester comparison data'
        });
    }
};

module.exports = {
    getSemesterComparison
};
