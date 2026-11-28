
<<<<<<< Updated upstream
const API_URL = 'http://localhost:5000/api/dashboard';
=======
import { resolveSurveyManagementApiBase } from "../config/surveyManagementApi";
>>>>>>> Stashed changes

// Get dashboard statistics
export const getDashboardStats = async () => {
    try {
        const response = await fetch(`${API_URL}/stats`);

        if (!response.ok) {
            throw new Error('Failed to fetch dashboard statistics');
        }

        const result = await response.json();
        return result.data;

<<<<<<< Updated upstream
    } catch (error) {
        console.error('Dashboard Stats API Error:', error);
        throw error;
    }
};
=======
  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch recent submissions"
    );
  }

  return result.data;
}

// Get feedback dashboard statistics
export async function getDashboardStats(apiFetch) {
  const response = await apiFetch(
    `${API_BASE_URL}/feedback/dashboard/stats`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch dashboard statistics"
    );
  }

  return result.data;
}

// ==========================================
// Admin Survey Management Dashboard
// ==========================================

// Uses API Gateway (SurveyManagementLambda) when
// VITE_SURVEY_MANAGEMENT_API_URL is set; otherwise the existing Express URL.
// The student feedback dashboard above is not affected.
const ADMIN_DASHBOARD_URL = `${resolveSurveyManagementApiBase(API_BASE_URL)}/dashboard`;

// Get admin dashboard statistics
export async function getAdminDashboardStats(apiFetch, options = {}) {
  const response = await apiFetch(
    `${ADMIN_DASHBOARD_URL}/stats`,
    options
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch admin dashboard statistics"
    );
  }

  return result.data;
}
>>>>>>> Stashed changes

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