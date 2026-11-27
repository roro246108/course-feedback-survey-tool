import { useState, useEffect } from 'react';

import {
    getDashboardStats,
    getResponseTrend,
    getSurveyStatus,
    getRecentSurveys
} from '../services/dashboardService';

function useDashboard() {
    const [stats, setStats] = useState(null);
    const [responseTrend, setResponseTrend] = useState([]);
    const [surveyStatus, setSurveyStatus] = useState([]);
    const [recentSurveys, setRecentSurveys] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [
                    statsData,
                    trendData,
                    statusData,
                    surveysData
                ] = await Promise.all([
                    getDashboardStats(),
                    getResponseTrend(),
                    getSurveyStatus(),
                    getRecentSurveys()
                ]);

                setStats(statsData);
                setResponseTrend(trendData);
                setSurveyStatus(statusData);
                setRecentSurveys(surveysData);

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    return {
        stats,
        responseTrend,
        surveyStatus,
        recentSurveys,
        loading,
        error
    };
}

export default useDashboard;