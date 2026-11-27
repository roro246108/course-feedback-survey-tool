
const analyticsModel = require('../models/analyticsModel');

// Comments are hidden when the group has fewer than 3 answered submissions.
const MIN_RESPONSES_FOR_COMMENTS = 3;

const toNumberOrNull = value =>
    value === null || value === undefined ? null : Number(value);

// 1. Overall Analytics
const getOverview = async (filters = {}) => {
    const data = await analyticsModel.getOverview(filters);

    return {
        totalSubmissions: Number(data.total_submissions),
        averageRating: toNumberOrNull(data.average_rating),
        totalCourses: Number(data.total_courses),
        totalInstructors: Number(data.total_instructors),
        totalRatingAnswers: Number(data.total_rating_answers),
        totalTextAnswers: Number(data.total_text_answers)
    };
};

// 2. Feedback Trends
const getFeedbackTrends = async (filters = {}) => {
    const data = await analyticsModel.getFeedbackTrends(filters);

    return data.map(item => ({
        submission_date: item.submission_date,
        total_submissions: Number(item.total_submissions)
    }));
};

// 3. Semester Comparison
const getSemesterComparison = async (filters = {}) => {
    const data = await analyticsModel.getSemesterComparison(filters);

    return data.map(item => ({
        semester_id: item.semester_id,
        semester_name: item.semester_name,
        academic_year: item.academic_year,
        total_submissions: Number(item.total_submissions),
        average_rating: toNumberOrNull(item.average_rating)
    }));
};

// 4. Course Performance
const getCoursePerformance = async (filters = {}) => {
    const data = await analyticsModel.getCoursePerformance(filters);

    return data.map(item => ({
        course_id: item.course_id,
        course_code: item.course_code,
        course_name: item.course_name,
        total_submissions: Number(item.total_submissions),
        rating_answers: Number(item.rating_answers),
        average_rating: toNumberOrNull(item.average_rating)
    }));
};

// 5. Instructor Performance
const getInstructorPerformance = async (filters = {}) => {
    const data = await analyticsModel.getInstructorPerformance(filters);

    return data.map(item => ({
        instructor_id: item.instructor_id,
        instructor_name: item.instructor_name,
        total_courses: Number(item.total_courses),
        total_submissions: Number(item.total_submissions),
        rating_answers: Number(item.rating_answers),
        average_rating: toNumberOrNull(item.average_rating)
    }));
};

// 6. Recent Anonymous Feedback
const getRecentFeedback = async ({
    courseId = null,
    semesterId = null,
    instructorId = null,
    limit = 6
} = {}) => {
    const filters = {
        courseId,
        semesterId,
        instructorId
    };

    const groupResponses =
        await analyticsModel.countAnsweredSubmissions(filters);

    if (groupResponses < MIN_RESPONSES_FOR_COMMENTS) {
        return {
            items: [],
            meta: {
                commentsHidden: true,
                minimumResponses: MIN_RESPONSES_FOR_COMMENTS,
                groupResponses,
                message: `Comments are hidden because this group has fewer than ${MIN_RESPONSES_FOR_COMMENTS} responses, to protect student anonymity.`
            }
        };
    }

    const data = await analyticsModel.getRecentFeedback({
        ...filters,
        limit
    });

    return {
        items: data.map(item => ({
            answer_id: item.answer_id,
            text_answer: item.text_answer,
            submitted_at: item.submitted_at,
            course_name: item.course_name,
            semester_name: item.semester_name,
            academic_year: item.academic_year
        })),
        meta: {
            commentsHidden: false,
            minimumResponses: MIN_RESPONSES_FOR_COMMENTS,
            groupResponses
        }
    };
};

// 7. Rating Distribution
const getRatingDistribution = async (filters = {}) => {
    const data = await analyticsModel.getRatingDistribution(filters);

    return data.map(item => ({
        rating: Number(item.rating),
        count: Number(item.count)
    }));
};

// 8. Response Rates
const getResponseRates = async (filters = {}) => {
    const data = await analyticsModel.getResponseRates(filters);

    return data.map(item => {
        const enrolled = Number(item.enrolled_students);
        const participated = Number(item.participated_students);

        return {
            survey_id: item.survey_id,
            survey_title: item.survey_title,
            status: item.status,
            course_id: item.course_id,
            course_code: item.course_code,
            course_name: item.course_name,
            semester_id: item.semester_id,
            semester_name: item.semester_name,
            academic_year: item.academic_year,
            enrolled_students: enrolled,
            participated_students: participated,
            response_rate: enrolled > 0
                ? Math.round((participated / enrolled) * 1000) / 10
                : null
        };
    });
};

// Used by the controller to validate filter IDs.
const entityExists = (entity, id) =>
    analyticsModel.entityExists(entity, id);

module.exports = {
    getOverview,
    getFeedbackTrends,
    getSemesterComparison,
    getCoursePerformance,
    getInstructorPerformance,
    getRecentFeedback,
    getRatingDistribution,
    getResponseRates,
    entityExists
};
