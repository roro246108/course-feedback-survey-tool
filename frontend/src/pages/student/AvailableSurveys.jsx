
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getAvailableSurveys } from "../../services/availableSurveysService";
import SurveyCard from "../../components/student/SurveyCard";
import { useAuth } from "../../context/AuthContext";

import algorithmsImage from "../../assets/images/surveys/algorithms.jpg";
import dataStructuresImage from "../../assets/images/surveys/data-structures.jpg";
import softwareEngineeringImage from "../../assets/images/surveys/software-engineering.jpg";

function AvailableSurveys() {
  const { apiFetch } = useAuth();

  const [surveys, setSurveys] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSurveys = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getAvailableSurveys(apiFetch);
      setSurveys(data);
    } catch (err) {
      console.error("Error loading available surveys:", err);
      setError("Unable to load surveys. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const filteredSurveys = useMemo(() => {
    const search = searchTerm.toLowerCase().trim();

    if (!search) return surveys;

    return surveys.filter((survey) =>
      [
        survey.course_name,
        survey.course_code,
        survey.title,
        survey.instructor_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search))
    );
  }, [surveys, searchTerm]);

  const featuredImages = [
    {
      src: dataStructuresImage,
      className: "left-0 top-8 h-48 w-52 sm:h-60 sm:w-64",
    },
    {
      src: softwareEngineeringImage,
      className: "right-0 top-0 h-64 w-56 sm:h-80 sm:w-72",
    },
    {
      src: algorithmsImage,
      className: "bottom-0 left-1/3 h-36 w-40 sm:h-44 sm:w-48",
    },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#F5F6F2] pb-16">

      {/* Hero Section */}
      <section className="relative mx-auto max-w-[1500px] px-5 pb-10 pt-8 md:px-10 lg:px-14 lg:pt-12">

        <div className="relative grid min-h-[480px] items-center gap-10 overflow-hidden rounded-[2rem] bg-[#E7E9DE] px-7 py-12 sm:px-12 lg:grid-cols-2 lg:px-16">

          {/* Decorative background */}
          <div className="pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full border-[45px] border-[#A6B398]/20" />
          <div className="pointer-events-none absolute -bottom-36 left-1/3 h-72 w-72 rounded-full bg-[#DED4AF]/40 blur-2xl" />

          {/* Hero Text */}
          <div className="relative z-10 max-w-xl">

            <Link
              to="/"
              className="mb-12 inline-flex items-center gap-2 text-sm font-semibold text-[#4B5545] transition hover:text-[#2B5748]"
            >
              <span>←</span>
              Back to Dashboard
            </Link>

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#A6B398]/40 bg-white/70 px-4 py-2 text-[10px] font-bold uppercase tracking-[2px] text-[#557060]">
              <span className="h-2 w-2 rounded-full bg-[#557C61]" />
              OAK Student Experience
            </div>

            <h1 className="font-serif text-4xl font-bold leading-[1.12] tracking-tight text-[#214E3D] sm:text-5xl lg:text-[4.2rem]">
              Your Voice.
              <br />
              Your Courses.
              <br />
              <span className="italic text-[#87977D]">
                Better Learning.
              </span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-8 text-[#586456]">
              Every opinion makes a difference. Explore your courses,
              share your experience, and help shape a better learning
              environment.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#available-surveys"
                className="inline-flex items-center gap-4 rounded-full bg-[#285747] px-7 py-4 text-sm font-semibold text-white shadow-lg shadow-[#285747]/15 transition duration-300 hover:-translate-y-1 hover:bg-[#1D4437]"
              >
                Explore Surveys
                <span className="text-lg">↗</span>
              </a>

              <span className="text-sm text-[#667364]">
                Your feedback matters.
              </span>
            </div>
          </div>

          {/* Image Collage */}
          <div className="relative mx-auto h-[360px] w-full max-w-[550px] sm:h-[430px]">

            <div className="absolute right-5 top-5 h-72 w-72 rounded-full bg-[#B7C2AA]/50 blur-3xl" />

            {featuredImages.map((image, index) => (
              <div
                key={image.src}
                className={`absolute overflow-hidden border-[6px] border-[#F5F6F2] shadow-xl shadow-[#334A3B]/15 transition duration-700 hover:z-20 hover:scale-105 ${image.className} ${
                  index === 0
                    ? "rounded-[2rem] rounded-tr-[5rem]"
                    : index === 1
                    ? "rounded-[5rem] rounded-bl-[2rem]"
                    : "rounded-[2rem] rounded-tl-[5rem]"
                }`}
              >
                <img
                  src={image.src}
                  alt="University learning and student workspace"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}

            <div className="absolute bottom-5 right-0 z-10 rounded-2xl border border-white/70 bg-white/90 px-5 py-4 shadow-xl backdrop-blur-md sm:right-3">
              <p className="text-[10px] font-bold uppercase tracking-[2px] text-[#89957F]">
                Learn · Share · Improve
              </p>
              <p className="mt-1 font-serif text-xl font-bold text-[#285747]">
                Make it count.
              </p>
            </div>
          </div>
        </div>

        {/* Floating Search */}
        <div
          id="available-surveys"
          className="relative z-20 mx-auto -mt-7 max-w-5xl rounded-[1.7rem] border border-[#E7E9DE] bg-white p-3 shadow-[0_18px_55px_rgba(43,87,72,0.12)] sm:p-4"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center">

            <div className="flex flex-1 items-center gap-4 rounded-2xl bg-[#F5F6F2] px-5 py-4 transition focus-within:bg-[#EDF0E8]">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#DDE5D8] text-xl text-[#285747]">
                ⌕
              </div>

              <div className="min-w-0 flex-1">
                <label
                  htmlFor="survey-search"
                  className="mb-1 block text-[10px] font-bold uppercase tracking-[1.5px] text-[#84917F]"
                >
                  Find your course
                </label>

                <input
                  id="survey-search"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Course, instructor or survey name..."
                  className="w-full bg-transparent text-sm text-[#285747] outline-none placeholder:text-[#A0A99A]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 px-3 md:min-w-[180px] md:justify-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#89957F]">
                  Available now
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-[#285747]">
                  {loading ? "—" : filteredSurveys.length.toString().padStart(2, "0")}
                  <span className="ml-1 text-xs font-sans font-normal text-[#7C897B]">
                    Surveys
                  </span>
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#285747] text-xl text-white">
                ↗
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Strip */}
      <section className="mx-auto max-w-[1400px] px-5 pt-8 md:px-10 lg:px-14">
        <div className="grid grid-cols-1 gap-3 rounded-[1.8rem] border border-[#E7E9DE] bg-white p-5 shadow-sm sm:grid-cols-3 sm:p-7">

          {[
            {
              icon: "✦",
              title: "Your Voice Matters",
              description: "Every response helps improve learning.",
            },
            {
              icon: "◎",
              title: "Student Experience",
              description: "Share your real course experience.",
            },
            {
              icon: "↗",
              title: "Make an Impact",
              description: "Help create a better university.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-4 border-b border-[#E9ECE5] py-3 last:border-0 sm:border-b-0 sm:border-r sm:px-5 sm:last:border-0"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E9EDE4] font-serif text-2xl text-[#285747]">
                {item.icon}
              </div>

              <div>
                <h2 className="font-semibold text-[#285747]">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#788477]">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section className="mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-20 md:px-10 lg:grid-cols-2 lg:gap-16 lg:px-14">

        <div className="relative">
          <div className="absolute -left-5 -top-5 h-28 w-28 rounded-full bg-[#DED4AF]/60" />

          <div className="relative h-[330px] overflow-hidden rounded-[2.5rem] rounded-tr-[7rem] shadow-xl sm:h-[410px]">
            <img
              src={softwareEngineeringImage}
              alt="Student studying and working on a course"
              className="h-full w-full object-cover transition duration-700 hover:scale-105"
              loading="lazy"
            />
          </div>

          <div className="absolute -bottom-6 right-5 rounded-2xl bg-[#285747] px-6 py-5 text-white shadow-xl sm:right-10">
            <p className="font-serif text-3xl font-bold">OAK</p>
            <p className="mt-1 text-[10px] uppercase tracking-[2px] text-white/70">
              Listen · Learn · Grow
            </p>
          </div>
        </div>

        <div className="pt-6 lg:pt-0">
          <span className="text-[11px] font-bold uppercase tracking-[3px] text-[#9A9D78]">
            More than a survey
          </span>

          <h2 className="mt-4 max-w-lg font-serif text-4xl font-bold leading-tight text-[#214E3D] sm:text-5xl">
            A Better Learning Experience Starts With You.
          </h2>

          <p className="mt-6 max-w-lg text-sm leading-8 text-[#687466]">
            Your feedback is an important part of building a better
            academic experience. Share what works, tell us what can
            improve, and help make every course better.
          </p>

          <div className="mt-8 space-y-5">
            {[
              ["01", "Share your experience", "Tell us about your courses and instructors."],
              ["02", "Help us understand", "Your responses highlight what matters to students."],
              ["03", "Make learning better", "Your voice contributes to positive improvements."],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-4">
                <span className="font-serif text-xl font-bold text-[#A6B398]">
                  {number}
                </span>

                <div>
                  <h3 className="font-semibold text-[#285747]">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#7C897B]">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Surveys Section */}
      <section className="mx-auto max-w-[1400px] px-5 pb-20 md:px-10 lg:px-14">

        <div className="mb-9 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[3px] text-[#9A9D78]">
              Your courses · Your voice
            </span>

            <h2 className="mt-3 font-serif text-3xl font-bold text-[#214E3D] sm:text-4xl">
              Explore Your Surveys
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-7 text-[#758173]">
              Discover your available course surveys and make your
              experience count.
            </p>
          </div>

          <span className="text-sm font-semibold text-[#285747]">
            {loading ? "Loading..." : `${filteredSurveys.length} surveys found`}
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-[2rem] bg-white py-20 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#DDE5D8] border-t-[#285747]" />
            <p className="text-sm text-[#687466]">
              Loading your surveys...
            </p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-[2rem] bg-red-50 p-10 text-center">
            <p className="text-red-600">{error}</p>

            <button
              type="button"
              onClick={fetchSurveys}
              className="mt-5 rounded-full bg-[#285747] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#1D4437]"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && surveys.length === 0 && (
          <div className="rounded-[2rem] border border-[#E7E9DE] bg-white px-6 py-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E9EDE4] text-3xl text-[#285747]">
              ✦
            </div>

            <h3 className="mt-5 font-serif text-2xl font-bold text-[#285747]">
              No Surveys Available
            </h3>

            <p className="mt-3 text-sm text-[#788477]">
              There are currently no surveys available for your enrolled courses.
            </p>
          </div>
        )}

        {/* No Search Results */}
        {!loading &&
          !error &&
          surveys.length > 0 &&
          filteredSurveys.length === 0 && (
            <div className="rounded-[2rem] bg-white px-6 py-16 text-center shadow-sm">
              <h3 className="font-serif text-2xl font-bold text-[#285747]">
                No Matching Surveys
              </h3>

              <p className="mt-3 text-sm text-[#788477]">
                Try another course name, code, or instructor.
              </p>

              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="mt-5 rounded-full bg-[#285747] px-6 py-3 text-sm font-semibold text-white"
              >
                Clear Search
              </button>
            </div>
          )}

        {/* Survey Cards */}
        {!loading && !error && filteredSurveys.length > 0 && (
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3">
            {filteredSurveys.map((survey, index) => (
              <SurveyCard
                key={survey.survey_id}
                survey={survey}
                featured={index === 0}
              />
            ))}
          </div>
        )}
      </section>

      {/* Closing Banner */}
      <section className="mx-auto max-w-[1400px] px-5 md:px-10 lg:px-14">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-[#244D3D] px-8 py-12 text-center sm:px-14 sm:py-16">
          <div className="absolute -right-16 -top-28 h-72 w-72 rounded-full border-[35px] border-white/5" />
          <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full border-[35px] border-white/5" />

          <div className="relative z-10 mx-auto max-w-2xl">
            <span className="text-[10px] font-bold uppercase tracking-[3px] text-[#C8D2B8]">
              Your voice matters
            </span>

            <h2 className="mt-4 font-serif text-3xl font-bold text-white sm:text-4xl">
              Small Feedback. Meaningful Change.
            </h2>

            <p className="mt-4 text-sm leading-7 text-white/70">
              Take a moment to share your thoughts. Together, we can
              make the learning experience better for everyone.
            </p>

            <a
              href="#available-surveys"
              className="mt-7 inline-flex items-center gap-3 rounded-full bg-[#E6E6D6] px-7 py-3.5 text-sm font-bold text-[#285747] transition hover:-translate-y-1 hover:bg-white"
            >
              Find a Survey
              <span>↗</span>
            </a>
          </div>
        </div>
      </section>

    </main>
  );
}

export default AvailableSurveys;
