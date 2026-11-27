

const API_BASE_URL = `${(
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/+$/, "")}/api`;

// ==========================================
// Student / Anonymous Feedback Dashboard
// ==========================================

// Get recent feedback submissions
export async function getRecentSubmissions(apiFetch) {
  const response = await apiFetch(
    `${API_BASE_URL}/feedback/dashboard/recent-submissions`
  );

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

const ADMIN_DASHBOARD_URL = `${API_BASE_URL}/dashboard`;

// Get admin dashboard statistics
export async function getAdminDashboardStats(apiFetch) {
  const response = await apiFetch(
    `${ADMIN_DASHBOARD_URL}/stats`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch admin dashboard statistics"
    );
  }

  return result.data;
}

// Get response trend
export async function getResponseTrend(apiFetch) {
  const response = await apiFetch(
    `${ADMIN_DASHBOARD_URL}/response-trend`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch response trend"
    );
  }

  return result.data;
}

// Get survey status
export async function getSurveyStatus(apiFetch) {
  const response = await apiFetch(
    `${ADMIN_DASHBOARD_URL}/survey-status`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch survey status"
    );
  }

  return result.data;
}

// Get recent surveys
export async function getRecentSurveys(apiFetch) {
  const response = await apiFetch(
    `${ADMIN_DASHBOARD_URL}/recent-surveys`
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.message || "Failed to fetch recent surveys"
    );
  }

  return result.data;
}

