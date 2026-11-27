
const API_BASE_URL = `${(import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "")}/api`;

// Get recent submissions for the dashboard
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

// Get dashboard statistics
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
