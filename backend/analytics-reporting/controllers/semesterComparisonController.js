
const semesterComparisonService = require('../../semester-comparison/services/semesterComparisonService');

const MAX_ID = 2147483647; // PostgreSQL integer limit

// Optional filters accepted by this endpoint and the record each one refers to
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

    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || Number(raw) > MAX_ID) {
        throw new RequestError(400, `${name} must be a positive whole number.`);
    }

    return Number(raw);
};

const readFilters = async query => {
    const filters = {};

    for (const name of Object.keys(FILTERS)) {
        filters[name] = parsePositiveInteger(query[name], name);
    }

    for (const [name, entity] of Object.entries(FILTERS)) {
        if (filters[name] !== null) {
            const exists = await semesterComparisonService.entityExists(entity, filters[name]);

            if (!exists) {
                throw new RequestError(404, `No ${entity} found with ${name} ${filters[name]}.`);
            }
        }
    }

    return filters;
};

const getSemesterComparison = async (req, res) => {
    try {
        const filters = await readFilters(req.query);
        const data = await semesterComparisonService.getSemesterComparison(filters);

        res.status(200).json({
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

        console.error('Semester Comparison Controller Error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve semester comparison data'
        });
    }
};

module.exports = {
    getSemesterComparison
};
