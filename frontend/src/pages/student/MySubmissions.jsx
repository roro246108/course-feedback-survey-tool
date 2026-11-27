
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { getStudentSubmissionMetadata } from "../../services/feedbackService";

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DocumentIcon({ className = "h-6 w-6" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 3.75h6l4.25 4.25v12H5.75V3.75H8Z"
        strokeLinejoin="round"
      />
      <path d="M14 4v4h4M9 13h6M9 16.5h6" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 4 4" strokeLinecap="round" />
    </svg>
  );
}

function HeroIllustration() {
  return (
    <div className="pointer-events-none absolute bottom-0 right-10 hidden items-end justify-center lg:flex">
      <div className="relative flex h-64 w-64 items-center justify-center">
        <div className="absolute h-52 w-52 rounded-full bg-[#DCE4D2]/10" />

        <svg
          viewBox="0 0 240 240"
          fill="none"
          className="relative z-10 h-60 w-60"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Feedback paper */}
          <rect
            x="65"
            y="35"
            width="112"
            height="145"
            rx="12"
            fill="#E8E9DD"
          />

          <path d="M145 35V65H177" fill="#D0D9C9" />

          <path
            d="M145 35L177 65"
            stroke="#B7C5B3"
            strokeWidth="2"
          />

          {/* Paper lines */}
          <rect x="85" y="83" width="72" height="5" rx="2.5" fill="#A5B49E" />
          <rect x="85" y="99" width="58" height="5" rx="2.5" fill="#A5B49E" />
          <rect x="85" y="115" width="72" height="5" rx="2.5" fill="#A5B49E" />

          {/* Check mark */}
          <circle cx="119" cy="151" r="14" fill="#315B48" />
          <path
            d="M112 151L117 156L126 146"
            stroke="#F7F5F0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Botanical detail */}
          <path
            d="M177 185C178 157 191 139 207 126"
            stroke="#B9C8AF"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          <path
            d="M187 159C170 157 165 145 168 136C180 138 190 147 187 159Z"
            fill="#A8B99D"
          />

          <path
            d="M194 144C192 130 201 120 214 119C215 132 207 142 194 144Z"
            fill="#C3CEB8"
          />

          <path
            d="M177 177C163 170 151 175 148 188C161 193 173 189 177 177Z"
            fill="#91A98D"
          />

          {/* Decorative sparkle */}
          <path
            d="M48 78V94M40 86H56"
            stroke="#D5DCCB"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function MySubmissions() {
  const { apiFetch } = useAuth();

  const [submissions, setSubmissions] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestSubmissions = useCallback(
    () => getStudentSubmissionMetadata(apiFetch),
    [apiFetch]
  );

  useEffect(() => {
    let isMounted = true;

    requestSubmissions()
      .then((records) => {
        if (isMounted) setSubmissions(records);
      })
      .catch((requestError) => {
        if (isMounted) {
          setError(
            requestError.message || "Unable to load your submissions."
          );
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [requestSubmissions]);

  const retry = async () => {
    setLoading(true);
    setError("");

    try {
      setSubmissions(await requestSubmissions());
    } catch (requestError) {
      setError(
        requestError.message || "Unable to load your submissions."
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return submissions;

    return submissions.filter((submission) =>
      [
        submission.survey_title,
        submission.course_name,
        submission.course_code,
        submission.semester_name,
        submission.academic_year,
        submission.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [submissions, search]);

  return (
    <main className="min-h-screen bg-[#F6F6F1] text-[#203F34]">
      <div className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8 lg:px-12">

        {/* HERO */}
        <section className="relative overflow-hidden rounded-[1.8rem] bg-[#1F493B] px-7 py-12 shadow-sm sm:px-12 sm:py-14">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border border-white/[0.08]" />
          <div className="pointer-events-none absolute -right-5 -top-16 h-56 w-56 rounded-full border border-white/[0.08]" />
          <div className="pointer-events-none absolute bottom-0 right-48 h-36 w-36 rounded-full bg-[#A8B49B]/10 blur-3xl" />

          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-[#C3CEB8]" />
              <p className="text-[10px] font-semibold uppercase tracking-[3px] text-[#C3CEB8]">
                OAK · Student Portal
              </p>
            </div>

            <h1 className="mt-6 font-serif text-5xl leading-tight text-white sm:text-6xl">
              My Submissions
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-[#E0E7DE]/80 sm:text-base">
              Your feedback journey, all in one place. Review your
              survey participation and stay connected with your
              academic experience.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#submissions"
                className="rounded-full bg-[#E7E9DD] px-6 py-3 text-sm font-semibold text-[#214C3E] transition hover:bg-white"
              >
                View activity <span className="ml-2">↓</span>
              </a>

              <span className="text-xs text-white/60">
                Your submitted answers remain anonymous.
              </span>
            </div>
          </div>

          {/* Hero Illustration */}
          <HeroIllustration />
        </section>

        {/* SUMMARY */}
        <section className="mt-7 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#E5E7DE] bg-white p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[1.8px] text-[#89977F]">
                Total submissions
              </p>

              <div className="rounded-xl bg-[#EDF0E8] p-2.5 text-[#315B48]">
                <DocumentIcon />
              </div>
            </div>

            <div className="mt-4 flex items-end gap-3">
              <span className="font-serif text-5xl text-[#214C3E]">
                {submissions.length.toString().padStart(2, "0")}
              </span>

              <span className="mb-2 text-xs text-[#899184]">
                Surveys completed
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7DE] bg-[#E9EBE2] p-6">
            <p className="text-xs font-semibold uppercase tracking-[1.8px] text-[#89977F]">
              Your contribution
            </p>

            <h2 className="mt-4 font-serif text-2xl text-[#214C3E]">
              Making learning better.
            </h2>

            <p className="mt-2 max-w-md text-sm leading-6 text-[#687568]">
              Every participation helps build a better understanding
              of the student learning experience.
            </p>
          </div>
        </section>

        {/* SUBMISSIONS HEADER */}
        <section id="submissions" className="mt-16 scroll-mt-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[2.5px] text-[#89977F]">
                Participation history
              </p>

              <h2 className="mt-2 font-serif text-4xl text-[#214C3E]">
                Your Activity
              </h2>

              <p className="mt-3 text-sm text-[#7A8578]">
                Review the surveys you have participated in.
              </p>
            </div>

            <Link
              to="/surveys"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-[#C9D2C5] px-5 py-3 text-sm font-semibold text-[#315B48] transition hover:bg-[#E9EBE2]"
            >
              Browse surveys <span>↗</span>
            </Link>
          </div>

          {/* SEARCH */}
          <div className="mt-7 flex items-center gap-3 rounded-xl border border-[#E2E5DC] bg-white px-5 py-1 shadow-sm">
            <span className="text-[#89977F]">
              <SearchIcon />
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by survey title or course name..."
              aria-label="Search submissions"
              className="min-w-0 flex-1 border-0 bg-transparent py-4 text-sm text-[#214C3E] outline-none placeholder:text-[#A0A79C] focus:ring-0"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-xs font-semibold text-[#54745D] hover:text-[#214C3E]"
              >
                Clear
              </button>
            )}
          </div>

          {/* LOADING */}
          {loading && (
            <div
              role="status"
              className="mt-6 rounded-2xl bg-white p-12 text-center"
            >
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#DCE3D3] border-t-[#214C3E]" />

              <p className="mt-4 text-sm text-[#718071]">
                Loading your submissions...
              </p>
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-red-100 bg-white p-10 text-center"
            >
              <p className="text-sm text-red-700">{error}</p>

              <button
                type="button"
                onClick={retry}
                className="mt-5 rounded-full bg-[#214C3E] px-6 py-3 text-sm font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          )}

          {/* EMPTY */}
          {!loading && !error && submissions.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-[#CCD5C7] bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EDF0E8] text-[#315B48]">
                <DocumentIcon className="h-7 w-7" />
              </div>

              <h3 className="mt-5 font-serif text-2xl text-[#214C3E]">
                No submissions yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718071]">
                Your survey participation will appear here after you
                submit feedback.
              </p>

              <Link
                to="/surveys"
                className="mt-6 inline-flex rounded-full bg-[#214C3E] px-6 py-3 text-sm font-semibold text-white"
              >
                Browse available surveys
              </Link>
            </div>
          )}

          {/* NO RESULTS */}
          {!loading &&
            !error &&
            submissions.length > 0 &&
            filteredSubmissions.length === 0 && (
              <div className="mt-6 rounded-2xl bg-white p-12 text-center">
                <h3 className="font-serif text-2xl text-[#214C3E]">
                  No matching submissions
                </h3>

                <p className="mt-2 text-sm text-[#718071]">
                  Try another survey or course name.
                </p>
              </div>
            )}

          {/* SUBMISSION LIST */}
          {!loading && !error && filteredSubmissions.length > 0 && (
            <div className="mt-6 space-y-4">
              {filteredSubmissions.map((submission) => (
                <article
                  key={submission.id}
                  className="group rounded-2xl border border-[#E5E7DE] bg-white p-6 shadow-[0_2px_8px_rgba(32,63,52,0.03)] transition hover:border-[#C9D4C5] hover:shadow-md sm:p-7"
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EDF0E8] text-[#315B48]">
                      <DocumentIcon className="h-7 w-7" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-serif text-xl text-[#214C3E]">
                          {submission.survey_title || "Course feedback survey"}
                        </h3>

                        <span className="rounded-full bg-[#E9EEE5] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#315B48]">
                          {submission.status || "Submitted"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-medium text-[#405548]">
                        {submission.course_name || "Course unavailable"}
                        {submission.course_code
                          ? ` · ${submission.course_code}`
                          : ""}
                      </p>

                      <p className="mt-1 text-xs text-[#899184]">
                        {[
                          submission.semester_name,
                          submission.academic_year,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Semester unavailable"}
                      </p>
                    </div>

                    <div className="border-t border-[#ECEDE7] pt-4 sm:min-w-[175px] sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#A0A79C]">
                        Submission date
                      </p>

                      <p className="mt-2 text-xs font-medium leading-5 text-[#647264]">
                        {formatDate(submission.submitted_at)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* PRIVACY */}
        <section className="mt-12 flex gap-4 rounded-2xl border border-[#E2E5DC] bg-[#EEF0E9] p-6 sm:p-7">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#DCE4D7] text-[#315B48]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                d="M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-3Z"
                strokeLinejoin="round"
              />
              <path
                d="m9 12 2 2 4-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <h3 className="font-serif text-lg text-[#214C3E]">
              Your privacy is protected
            </h3>

            <p className="mt-1 text-sm leading-6 text-[#687568]">
              This page displays participation metadata only. Your submitted
              answers remain anonymous and cannot be viewed, edited, or
              withdrawn.
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}

export default MySubmissions;
