
import { useEffect, useState } from "react";
import { getDashboardStats } from "../../services/dashboardService";
import { useAuth } from "../../context/AuthContext";

function ImpactStats() {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState({
    completedSurveys: 0,
    availableSurveys: 0,
    enrolledCourses: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError("");

        const data = await getDashboardStats(apiFetch);
        setStats(data);
      } catch (err) {
        console.error("Error fetching dashboard statistics:", err);
        setError("Unable to load dashboard statistics.");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [apiFetch]);

  const statItems = [
    {
      id: 1,
      value: stats.completedSurveys,
      label: "Completed Surveys",
      description: "Surveys you have submitted",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7"
        >
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h5M8 16l2 2 5-5" />
        </svg>
      ),
    },
    {
      id: 2,
      value: stats.availableSurveys,
      label: "Available Surveys",
      description: "Surveys waiting for your feedback",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7"
        >
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      ),
    },
    {
      id: 3,
      value: stats.enrolledCourses,
      label: "Enrolled Courses",
      description: "Courses you are currently enrolled in",
      icon: (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-7 w-7"
        >
          <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Z" />
          <path d="M7 11v5c3.3 2.5 6.7 2.5 10 0v-5" />
          <path d="M21 9v6" />
        </svg>
      ),
    },
  ];

  return (
    <section className="mx-4 mt-6 md:mx-8">
      <div className="relative overflow-hidden rounded-2xl border border-[#A6B398]/30 bg-gradient-to-r from-[#DED4AF]/50 via-[#F4F7F6] to-[#A6B398]/30 px-5 py-7 shadow-sm md:px-9">

        {/* Decorative Background */}
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-[#A6B398]/20 blur-2xl" />

        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:items-center lg:gap-4">

          {/* Section Heading */}
          <div className="border-b border-[#4B5545]/20 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
            <h2 className="font-serif text-2xl font-bold leading-tight text-[#2B5748] md:text-3xl">
              Our Student
              <br />
              Feedback Impact
            </h2>

            <p className="mt-2 text-sm text-[#4B5545]">
              Together, we make a difference.
            </p>
          </div>

          {/* Statistics */}
          {statItems.map((stat, index) => (
            <div
              key={stat.id}
              className={`flex items-center gap-4 ${
                index !== statItems.length - 1
                  ? "border-b border-[#4B5545]/20 pb-5 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4"
                  : ""
              }`}
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#A6B398]/35 text-[#2B5748]">
                {stat.icon}
              </div>

              <div>
                <p className="font-serif text-3xl font-bold text-[#2B5748]">
                  {loading ? "--" : error ? "--" : stat.value}
                </p>

                <h3 className="mt-1 text-sm font-semibold text-[#4B5545]">
                  {stat.label}
                </h3>

                <p className="mt-1 text-xs leading-5 text-[#4B5545]/75">
                  {stat.description}
                </p>
              </div>
            </div>
          ))}

        </div>

        {error && (
          <p className="relative mt-5 text-center text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

export default ImpactStats;
