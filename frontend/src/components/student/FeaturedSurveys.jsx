
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getAvailableSurveys } from "../../services/availableSurveysService";
import SurveyCard from "./SurveyCard";
import { useAuth } from "../../context/AuthContext";

function FeaturedSurveys() {
  const { apiFetch } = useAuth();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchSurveys() {
      try {
        setLoading(true);
        setError("");

        const data = await getAvailableSurveys(apiFetch);

        // Display up to 3 surveys on the Home Dashboard
        setSurveys(data.slice(0, 3));
      } catch (err) {
        console.error("Error loading surveys:", err);
        setError("Unable to load surveys. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    fetchSurveys();
  }, [apiFetch]);

  return (
    <section id="surveys" className="min-w-0">
      {/* Section Heading */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 rounded-full bg-[#2B5748]" />

          <h2 className="font-serif text-2xl font-bold text-[#2B5748] md:text-3xl">
            Featured Course Feedback Surveys
          </h2>
        </div>

        <Link
          to="/surveys"
          className="flex items-center gap-2 text-sm font-semibold text-[#4B5545] transition hover:text-[#2B5748]"
        >
          View All
          <span className="text-lg">→</span>
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <p className="py-10 text-center text-[#4B5545]">
          Loading surveys...
        </p>
      )}

      {/* Error State */}
      {!loading && error && (
        <p className="rounded-xl bg-red-50 p-5 text-center text-red-600">
          {error}
        </p>
      )}

      {/* Empty State */}
      {!loading && !error && surveys.length === 0 && (
        <p className="rounded-xl bg-white p-8 text-center text-[#4B5545]">
          No surveys are currently available.
        </p>
      )}

      {/* Survey Cards */}
      {!loading && !error && surveys.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {surveys.map((survey) => (
            <SurveyCard
              key={survey.survey_id}
              survey={survey}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default FeaturedSurveys;
