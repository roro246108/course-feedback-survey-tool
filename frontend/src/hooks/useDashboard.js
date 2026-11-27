import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

import {
    getAdminDashboardStats,
    getResponseTrend,
    getSurveyStatus,
    getRecentSurveys
} from '../services/dashboardService';

function useDashboard() {
    const { apiFetch } = useAuth();
    const [stats, setStats] = useState(null);
    const [responseTrend, setResponseTrend] = useState([]);
    const [surveyStatus, setSurveyStatus] = useState([]);
    const [recentSurveys, setRecentSurveys] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                setError(null);

                const [
                    statsData,
                    trendData,
                    statusData,
                    surveysData
                ] = await Promise.all([
                    getAdminDashboardStats(apiFetch, { signal: controller.signal }),
                    getResponseTrend(apiFetch, { signal: controller.signal }),
                    getSurveyStatus(apiFetch, { signal: controller.signal }),
                    getRecentSurveys(apiFetch, { signal: controller.signal })
                ]);

                if (controller.signal.aborted) return;

                setStats(statsData);
                setResponseTrend(trendData);
                setSurveyStatus(statusData);
                setRecentSurveys(surveysData);

            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(err.message || 'Unable to load dashboard data.');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchDashboardData();

        return () => controller.abort();
    }, [apiFetch]);

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