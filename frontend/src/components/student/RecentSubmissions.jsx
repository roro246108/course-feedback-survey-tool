
import { useCallback, useEffect, useState } from "react";
import { getRecentSubmissions } from "../../services/dashboardService";
import { useAuth } from "../../context/AuthContext";

function RecentSubmissions() {
  const { apiFetch } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSubmissions = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getRecentSubmissions(apiFetch);
      setSubmissions(data);
    } catch (err) {
      console.error("Error fetching recent submissions:", err);
      setError("Unable to load recent submissions.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  function formatDate(dateValue) {
    const date = new Date(dateValue);

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(dateValue) {
    const date = new Date(dateValue);

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <section
      id="submissions"
      className="h-full overflow-hidden rounded-2xl border border-[#A6B398]/25 bg-white shadow-sm"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-[#A6B398]/20 px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="h-7 w-1.5 rounded-full bg-[#2B5748]" />

          <h2 className="font-serif text-xl font-bold text-[#2B5748]">
            Recent Submissions
          </h2>
        </div>
      </div>

      <div className="divide-y divide-[#A6B398]/20 px-5">

        {/* Loading State */}
        {loading && (
          <p className="py-8 text-center text-sm text-[#4B5545]/70">
            Loading recent submissions...
          </p>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{error}</p>

            <button
              onClick={fetchSubmissions}
              className="mt-3 text-sm font-semibold text-[#2B5748] hover:underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && submissions.length === 0 && (
          <p className="py-8 text-center text-sm text-[#4B5545]/70">
            You haven't submitted any feedback yet.
          </p>
        )}

        {/* Submissions List */}
        {!loading &&
          !error &&
          submissions.map((submission) => (
            <div
              key={submission.id}
              className="flex items-center gap-3 py-5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#A6B398]/30 text-[#2B5748]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  className="h-5 w-5"
                >
                  <path d="M7 3h8l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                  <path d="M15 3v5h5M9 13h7M9 17h7" />
                </svg>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[#2B5748]">
                  {submission.title}
                </h3>

                <p className="mt-1 text-xs text-[#4B5545]/70">
                  {formatDate(submission.submitted_at)} ·{" "}
                  {formatTime(submission.submitted_at)}
                </p>

                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#A6B398]/30 px-3 py-1 text-[10px] font-semibold text-[#2B5748]">
                  {submission.status || "Submitted"}
                </span>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

export default RecentSubmissions;
