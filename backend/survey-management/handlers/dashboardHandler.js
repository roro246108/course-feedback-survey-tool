const dashboardModel = require('../models/dashboardModel');

const getDashboardStats = () => dashboardModel.getDashboardStats();

const getResponseTrend = () => dashboardModel.getResponseTrend();

const getSurveyStatus = () => dashboardModel.getSurveyStatus();

const getRecentSurveys = () => dashboardModel.getRecentSurveys();

module.exports = {
    getDashboardStats,
    getResponseTrend,
    getSurveyStatus,
    getRecentSurveys
};
