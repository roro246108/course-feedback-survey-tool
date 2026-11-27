const dashboardHandler = require('../handlers/dashboardHandler');

const getDashboardStats = async (req, res) => {
    try {
        const stats = await dashboardHandler.getDashboardStats();

        res.status(200).json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error fetching dashboard statistics:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve dashboard statistics'
        });
    }
};
const getResponseTrend = async (req, res) => {
    try {
        const trend = await dashboardHandler.getResponseTrend();

        res.status(200).json({
            success: true,
            data: trend
        });

    } catch (error) {
        console.error('Error fetching response trend:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve response trend'
        });
    }
};
const getSurveyStatus = async (req, res) => {
    try {
        const status = await dashboardHandler.getSurveyStatus();

        res.status(200).json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Error fetching survey status:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve survey status'
        });
    }
};
const getRecentSurveys = async (req, res) => {
    try {
        const surveys = await dashboardHandler.getRecentSurveys();

        res.status(200).json({
            success: true,
            data: surveys
        });

    } catch (error) {
        console.error('Error fetching recent surveys:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to retrieve recent surveys'
        });
    }
};
module.exports = {
    getDashboardStats,
     getResponseTrend,
     getSurveyStatus,
     getRecentSurveys
};