
const API_URL = 'http://localhost:5000/api/dashboard';

// Get dashboard statistics
export const getDashboardStats = async () => {
    try {
        const response = await fetch(`${API_URL}/stats`);

        if (!response.ok) {
            throw new Error('Failed to fetch dashboard statistics');
        }

        const result = await response.json();
        return result.data;

    } catch (error) {
        console.error('Dashboard Stats API Error:', error);
        throw error;
    }
};

// Get response trend
export const getResponseTrend = async () => {
    try {
        const response = await fetch(`${API_URL}/response-trend`);

        if (!response.ok) {
            throw new Error('Failed to fetch response trend');
        }

        const result = await response.json();
        return result.data;

    } catch (error) {
        console.error('Response Trend API Error:', error);
        throw error;
    }
};

// Get survey status
export const getSurveyStatus = async () => {
    try {
        const response = await fetch(`${API_URL}/survey-status`);

        if (!response.ok) {
            throw new Error('Failed to fetch survey status');
        }

        const result = await response.json();
        return result.data;

    } catch (error) {
        console.error('Survey Status API Error:', error);
        throw error;
    }
};

// Get recent surveys
export const getRecentSurveys = async () => {
    try {
        const response = await fetch(`${API_URL}/recent-surveys`);

        if (!response.ok) {
            throw new Error('Failed to fetch recent surveys');
        }

        const result = await response.json();
        return result.data;

    } catch (error) {
        console.error('Recent Surveys API Error:', error);
        throw error;
    }
};