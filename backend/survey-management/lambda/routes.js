// Survey Management routes served by SurveyManagementLambda.
//
// These mirror backend/survey-management/routes/surveyRoutes.js and
// dashboardRoutes.js exactly (same paths, same order, same middleware:
// authenticateToken + authorizeRole('Admin')). The Express routes are kept
// for local development; this table is the Lambda equivalent.
//
// `lifecycle` marks routes that can change a survey's status and therefore
// may emit SurveyPublished / SurveyClosed after a successful response.

const SURVEYS = '/api/surveys';
const DASHBOARD = '/api/dashboard';

const buildRouteDefinitions = ({ surveyController, dashboardController }) => [
    // Surveys — order matters (static segments before :id), as in Express.
    { method: 'GET', path: `${SURVEYS}`, handler: surveyController.getAllSurveys },
    { method: 'GET', path: `${SURVEYS}/courses`, handler: surveyController.getAllCourses },
    { method: 'GET', path: `${SURVEYS}/instructors`, handler: surveyController.getInstructorsByCourseAndSemester },
    { method: 'GET', path: `${SURVEYS}/semesters`, handler: surveyController.getAllSemesters },

    { method: 'GET', path: `${SURVEYS}/:id/questions`, handler: surveyController.getSurveyQuestions },
    { method: 'POST', path: `${SURVEYS}/:id/questions`, handler: surveyController.addQuestion },
    { method: 'PUT', path: `${SURVEYS}/:id/questions/reorder`, handler: surveyController.reorderQuestions },
    { method: 'PUT', path: `${SURVEYS}/:id/questions/:questionId`, handler: surveyController.updateQuestion },
    { method: 'DELETE', path: `${SURVEYS}/:id/questions/:questionId`, handler: surveyController.deleteQuestion },

    { method: 'PUT', path: `${SURVEYS}/:id`, handler: surveyController.updateSurvey, lifecycle: 'update' },
    { method: 'PATCH', path: `${SURVEYS}/:id/status`, handler: surveyController.changeSurveyStatus, lifecycle: 'update' },
    { method: 'DELETE', path: `${SURVEYS}/:id`, handler: surveyController.deleteSurvey },
    { method: 'GET', path: `${SURVEYS}/:id`, handler: surveyController.getSurveyById },
    { method: 'POST', path: `${SURVEYS}`, handler: surveyController.createSurvey, lifecycle: 'create' },

    // Admin Survey Management dashboard
    { method: 'GET', path: `${DASHBOARD}/stats`, handler: dashboardController.getDashboardStats },
    { method: 'GET', path: `${DASHBOARD}/response-trend`, handler: dashboardController.getResponseTrend },
    { method: 'GET', path: `${DASHBOARD}/survey-status`, handler: dashboardController.getSurveyStatus },
    { method: 'GET', path: `${DASHBOARD}/recent-surveys`, handler: dashboardController.getRecentSurveys }
];

const compilePath = (path) => {
    const paramNames = [];
    const pattern = path
        .split('/')
        .map((segment) => {
            if (segment.startsWith(':')) {
                paramNames.push(segment.slice(1));
                return '([^/]+)';
            }
            return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        })
        .join('/');

    return { regex: new RegExp(`^${pattern}$`), paramNames };
};

const createRouter = (routeDefinitions) => {
    const compiled = routeDefinitions.map((route) => ({
        ...route,
        ...compilePath(route.path)
    }));

    // Returns { route, params } | { methodNotAllowed: true, allow } | null
    const match = (method, path) => {
        const allowed = new Set();

        for (const route of compiled) {
            const result = route.regex.exec(path);
            if (!result) continue;

            if (route.method !== method) {
                allowed.add(route.method);
                continue;
            }

            const params = {};
            route.paramNames.forEach((name, index) => {
                try {
                    params[name] = decodeURIComponent(result[index + 1]);
                } catch {
                    params[name] = result[index + 1];
                }
            });

            return { route, params };
        }

        if (allowed.size > 0) {
            return { methodNotAllowed: true, allow: [...allowed].sort() };
        }

        return null;
    };

    return { match, routes: compiled };
};

module.exports = {
    buildRouteDefinitions,
    compilePath,
    createRouter
};
