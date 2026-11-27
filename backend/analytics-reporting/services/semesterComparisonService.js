
const semesterComparisonModel = require('../../analytics-reporting/models/semesterComparisonModel');

// PostgreSQL returns COUNT/SUM/ROUND results as strings; convert them to numbers
const toNumberOrNull = value =>
    value === null || value === undefined ? null : Number(value);

const getSemesterComparison = async (filters = {}) => {
    const data = await semesterComparisonModel.getSemesterComparison(filters);

    return data.map(item => ({
        semester_id: item.semester_id,
        semester_name: item.semester_name,
        academic_year: item.academic_year,
        course_offerings: Number(item.course_offerings),
        total_submissions: Number(item.total_submissions),
        total_ratings: Number(item.total_ratings),
        total_rating_sum: toNumberOrNull(item.total_rating_sum),
        average_rating: toNumberOrNull(item.average_rating)
    }));
};

const entityExists = (entity, id) => semesterComparisonModel.entityExists(entity, id);

module.exports = {
    getSemesterComparison,
    entityExists
};
