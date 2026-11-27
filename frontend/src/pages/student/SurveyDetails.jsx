import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  getSurveyDetails,
  getSurveySubmissionStatus,
} from "../../services/availableSurveysService";
import { submitFeedback } from "../../services/feedbackService";
import { useAuth } from "../../context/AuthContext";

import algorithmsImage from "../../assets/images/surveys/algorithms.jpg";
import dataStructuresImage from "../../assets/images/surveys/data-structures.jpg";
import softwareEngineeringImage from "../../assets/images/surveys/software-engineering.jpg";

// --------------------------------------------------
// Helper Functions
// --------------------------------------------------

function getCourseImage(courseName = "") {
  const name = courseName.toLowerCase();

  if (name.includes("data structure")) {
    return dataStructuresImage;
  }

  if (name.includes("software engineering")) {
    return softwareEngineeringImage;
  }

  if (name.includes("algorithm")) {
    return algorithmsImage;
  }

  return dataStructuresImage;
}

function formatDate(date) {
  if (!date) return "Not specified";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not specified";
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// --------------------------------------------------
// Survey Details Component
// --------------------------------------------------

function SurveyDetails() {
  const { surveyId } = useParams();
  const { apiFetch } = useAuth();

  // Survey data
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  // Keep the same key when retrying a failed submission.
  // A new key is generated for a new submission attempt.
  const idempotencyKeyRef = useRef(null);

  // Prevent multiple clicks before the request finishes.
  const submissionLockRef = useRef(false);

  // --------------------------------------------------
  // Fetch Survey Details
  // --------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    async function fetchSurvey() {
      try {
        setLoading(true);
        setError("");

        const status = await getSurveySubmissionStatus(surveyId, apiFetch);

        if (!status.can_submit) {
          const statusMessages = {
            NOT_ENROLLED: "You are not enrolled in this course and semester.",
            ALREADY_SUBMITTED: "You have already submitted feedback for this survey.",
            NOT_PUBLISHED: "This survey is not currently available.",
            SURVEY_NOT_OPEN: "This survey is not currently accepting responses.",
          };

          throw new Error(
            statusMessages[status.reason] ||
              "You are not eligible to submit feedback for this survey."
          );
        }

        const data = await getSurveyDetails(surveyId, apiFetch);

        if (!isMounted) return;

        setSurvey(data);
        setAnswers({});
        setSubmitError("");
        setSubmitSuccess("");

        // Reset the key when opening a different survey.
        idempotencyKeyRef.current = null;
        submissionLockRef.current = false;
      } catch (err) {
        console.error("Error loading survey:", err);

        if (isMounted) {
          setError(
            err.message || "Unable to load this survey. Please try again."
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (surveyId) {
      fetchSurvey();
    } else {
      setError("Invalid survey ID.");
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [surveyId, apiFetch]);

  // --------------------------------------------------
  // Update Answer
  // --------------------------------------------------

  function handleAnswerChange(questionId, value) {
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [questionId]: value,
    }));

    setSubmitError("");
    setSubmitSuccess("");
  }

  // --------------------------------------------------
  // Calculate Progress
  // --------------------------------------------------

  const answeredCount = useMemo(() => {
    if (!survey?.questions) return 0;

    return survey.questions.filter((question) => {
      const answer = answers[question.question_id];

      return (
        answer !== undefined &&
        answer !== null &&
        !(typeof answer === "string" && !answer.trim())
      );
    }).length;
  }, [survey, answers]);

  const totalQuestions = survey?.questions?.length || 0;

  const progress =
    totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0;

  // --------------------------------------------------
  // Check Survey Availability
  // --------------------------------------------------

  const openingDate = survey?.opening_date
    ? new Date(survey.opening_date)
    : null;

  const closingDate = survey?.closing_date
    ? new Date(survey.closing_date)
    : null;

  const now = new Date();

  const isPublished = survey?.status === "Published";

  const isOpen =
    isPublished &&
    openingDate &&
    closingDate &&
    !Number.isNaN(openingDate.getTime()) &&
    !Number.isNaN(closingDate.getTime()) &&
    openingDate <= now &&
    closingDate > now;

  // --------------------------------------------------
  // Validate Required Questions
  // --------------------------------------------------

  function validateAnswers() {
    if (!survey?.questions || survey.questions.length === 0) {
      setSubmitError("This survey does not contain any questions.");
      return false;
    }

    const missingAnswers = survey.questions.filter((question) => {
      if (!question.is_required) return false;

      const answer = answers[question.question_id];

      return (
        answer === undefined ||
        answer === null ||
        (typeof answer === "string" && !answer.trim())
      );
    });

    if (missingAnswers.length > 0) {
      setSubmitError("Please answer all required questions.");
      return false;
    }

    return true;
  }

  // --------------------------------------------------
  // Format Answers for Backend
  // --------------------------------------------------

  function formatAnswers() {
    return survey.questions
      .filter((question) => {
        const answer = answers[question.question_id];

        return (
          answer !== undefined &&
          answer !== null &&
          !(typeof answer === "string" && !answer.trim())
        );
      })
      .map((question) => {
        const answer = answers[question.question_id];

        if (question.question_type === "Rating") {
          return {
            question_id: question.question_id,
            rating_value: answer,
          };
        }

        return {
          question_id: question.question_id,
          text_answer: answer,
        };
      });
  }

  // --------------------------------------------------
  // Submit Feedback
  // --------------------------------------------------

  async function handleSubmit() {
    if (submissionLockRef.current || submitting) {
      return;
    }

    setSubmitError("");
    setSubmitSuccess("");

    // Check survey availability
    if (!survey || !isOpen) {
      setSubmitError(
        "This survey is not currently accepting responses."
      );
      return;
    }

    // Validate required questions
    if (!validateAnswers()) {
      return;
    }

    // Prepare answers
    const formattedAnswers = formatAnswers();

    if (formattedAnswers.length === 0) {
      setSubmitError("Please answer at least one question.");
      return;
    }

    try {
      submissionLockRef.current = true;
      setSubmitting(true);

      // Generate one key for this submission.
      // Keep the same key if the request fails and the student retries.
      if (!idempotencyKeyRef.current) {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
          idempotencyKeyRef.current = crypto.randomUUID();
        } else {
          idempotencyKeyRef.current = [
            Date.now().toString(36),
            Math.random().toString(36).substring(2),
            Math.random().toString(36).substring(2),
          ].join("-");
        }
      }

      await submitFeedback(
        surveyId,
        formattedAnswers,
        apiFetch,
        idempotencyKeyRef.current
      );

      // Submission succeeded.
      setSubmitSuccess(
        "Your feedback has been submitted successfully!"
      );

      // Clear the key after successful submission.
      idempotencyKeyRef.current = null;
    } catch (err) {
      console.error("Error submitting feedback:", err);

      setSubmitError(
        err.message || "Failed to submit feedback. Please try again."
      );

      // Do not clear the key here.
      // If the student retries, the same key will be reused.
    } finally {
      submissionLockRef.current = false;
      setSubmitting(false);
    }
  }

  // --------------------------------------------------
  // Loading State
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[65vh] flex-col items-center justify-center gap-4 bg-[#F5F6F2]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#DDE5D8] border-t-[#285747]" />

        <p className="text-sm font-medium text-[#526456]">
          Preparing your survey...
        </p>
      </div>
    );
  }

  // --------------------------------------------------
  // Error State
  // --------------------------------------------------

  if (error) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#F5F6F2] px-5">
        <div className="max-w-md rounded-[2rem] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-2xl text-red-500">
            !
          </div>

          <h2 className="mt-5 font-serif text-2xl font-bold text-[#285747]">
            Something went wrong
          </h2>

          <p className="mt-3 text-sm text-[#788477]">
            {error}
          </p>

          <Link
            to="/"
            className="mt-6 inline-flex rounded-full bg-[#285747] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#1D4437]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  const courseImage = getCourseImage(survey.course_name);

  // --------------------------------------------------
  // Main UI
  // --------------------------------------------------

  return (
    <main className="min-h-screen overflow-hidden bg-[#F5F6F2] pb-20">

      {/* Page Header */}

      <section className="mx-auto max-w-[1400px] px-5 pt-8 md:px-10 lg:px-14">

        <Link
          to="/"
          className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-[#526456] transition hover:text-[#285747]"
        >
          <span>←</span>
          Back to Dashboard
        </Link>

        {/* Survey Hero */}

        <div className="relative grid overflow-hidden rounded-[2.3rem] bg-[#E7E9DE] lg:min-h-[380px] lg:grid-cols-[1.1fr_0.9fr]">

          {/* Hero Text */}

          <div className="relative z-10 flex flex-col justify-center px-7 py-10 sm:px-12 lg:px-14 lg:py-14">

            <div className="mb-6 flex flex-wrap items-center gap-3">

              <span className="rounded-full border border-[#A6B398]/40 bg-white/70 px-4 py-2 text-[10px] font-bold uppercase tracking-[2px] text-[#526456]">
                OAK · Course Feedback
              </span>

              <span className="rounded-full bg-[#DED4AF] px-4 py-2 text-xs font-bold text-[#285747]">
                {survey.status}
              </span>

            </div>

            <h1 className="max-w-2xl font-serif text-4xl font-bold leading-tight text-[#214E3D] sm:text-5xl lg:text-[3.5rem]">
              {survey.title}
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-[#647264] sm:text-base">
              {survey.description ||
                `Share your thoughts and experience about ${survey.course_name}.`}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">

              <span className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-3 text-xs font-semibold text-[#285747]">
                <span>✦</span>
                Your opinion matters
              </span>

              <span className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-3 text-xs font-semibold text-[#285747]">
                <span>◷</span>
                {formatDate(survey.closing_date)}
              </span>

            </div>
          </div>

          {/* Hero Image */}

          <div className="relative min-h-[260px] lg:min-h-full">

            <img
              src={courseImage}
              alt={`${survey.course_name} learning`}
              className="absolute inset-0 h-full w-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#183D30]/60 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#E7E9DE]/10 lg:via-transparent lg:to-transparent" />

            <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/50 bg-white/85 p-5 shadow-xl backdrop-blur-md sm:bottom-8 sm:left-8 sm:right-8">

              <p className="text-[10px] font-bold uppercase tracking-[2px] text-[#89957F]">
                Your learning journey
              </p>

              <p className="mt-2 font-serif text-2xl font-bold text-[#285747]">
                Let's make it better.
              </p>

              <p className="mt-1 text-xs text-[#687466]">
                A few minutes can make a difference.
              </p>

            </div>
          </div>
        </div>

        {/* Course Information */}

        <div className="relative z-10 -mt-5 mx-3 grid grid-cols-1 gap-3 rounded-[1.7rem] border border-[#E7E9DE] bg-white p-5 shadow-[0_15px_40px_rgba(43,87,72,0.08)] sm:mx-8 sm:grid-cols-2 sm:p-7 lg:grid-cols-4">

          {[
            {
              icon: "⌂",
              label: "Course",
              value: `${survey.course_name} (${survey.course_code})`,
            },
            {
              icon: "♙",
              label: "Instructor",
              value: survey.instructor_name,
            },
            {
              icon: "▤",
              label: "Semester",
              value: `${survey.semester_name || ""} ${
                survey.academic_year || ""
              }`.trim(),
            },
            {
              icon: "◷",
              label: "Closing Date",
              value: formatDate(survey.closing_date),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 border-b border-[#E9ECE5] py-3 last:border-0 sm:border-0 sm:px-2"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E9EDE4] text-xl text-[#285747]">
                {item.icon}
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[1px] text-[#98A18E]">
                  {item.label}
                </p>

                <p className="mt-1 truncate text-sm font-semibold text-[#285747]">
                  {item.value || "Not specified"}
                </p>
              </div>
            </div>
          ))}

        </div>
      </section>

      {/* Feedback Content */}

      <section className="mx-auto grid max-w-[1400px] items-start gap-8 px-5 pt-16 md:px-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-14">

        {/* Questions */}

        <div className="min-w-0">

          <div className="mb-8">

            <span className="text-[10px] font-bold uppercase tracking-[3px] text-[#9A9D78]">
              Student feedback
            </span>

            <h2 className="mt-3 font-serif text-3xl font-bold text-[#214E3D] sm:text-4xl">
              Let's hear your thoughts.
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#788477]">
              Take your time and answer the questions below. Every response counts.
            </p>

          </div>

          {!isOpen && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#DED4AF] bg-[#F0EDDE] p-5 text-sm text-[#526456]">
              <span className="text-xl">ⓘ</span>

              <p>
                This survey is not currently accepting responses.
              </p>
            </div>
          )}

          {/* Progress Card */}

          <div className="mb-6 rounded-[1.7rem] border border-[#E7E9DE] bg-white p-6 shadow-sm">

            <div className="flex items-center justify-between gap-4">

              <div>
                <p className="text-xs font-bold uppercase tracking-[1.5px] text-[#89957F]">
                  Your progress
                </p>

                <p className="mt-2 font-serif text-2xl font-bold text-[#285747]">
                  {answeredCount} of {totalQuestions}

                  <span className="ml-2 font-sans text-xs font-normal text-[#89957F]">
                    answered
                  </span>
                </p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-full border-[5px] border-[#E7EBDD] font-serif text-sm font-bold text-[#285747]">
                {progress}%
              </div>

            </div>

            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-[#EDF0E8]"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Survey completion progress"
            >
              <div
                className="h-full rounded-full bg-[#557C61] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

          </div>

          {/* Questions List */}

          <div className="space-y-5">

            {survey.questions?.map((question, index) => {
              const selectedAnswer = answers[question.question_id];

              return (
                <article
                  key={question.question_id}
                  className="group rounded-[1.8rem] border border-[#E7E9DE] bg-white p-6 shadow-[0_5px_20px_rgba(43,87,72,0.04)] transition duration-300 hover:shadow-[0_15px_35px_rgba(43,87,72,0.08)] sm:p-8"
                >

                  <div className="mb-6 flex items-start gap-4">

                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E9EDE4] font-serif text-xl font-bold text-[#285747] transition duration-300 group-hover:bg-[#285747] group-hover:text-white">
                      {String(index + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0 flex-1 pt-1">

                      <span className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#98A18E]">
                        {question.question_type === "Rating"
                          ? "Rating question"
                          : "Open question"}
                      </span>

                      <h3 className="mt-2 text-base font-semibold leading-7 text-[#285747] sm:text-lg">
                        {question.question_text}
                      </h3>

                      {question.is_required && (
                        <span className="mt-2 inline-block text-[11px] font-medium text-[#A18C5A]">
                          Required *
                        </span>
                      )}

                    </div>
                  </div>

                  {/* Rating Question */}

                  {question.question_type === "Rating" && (
                    <div className="rounded-2xl bg-[#F5F6F2] p-4 sm:p-5">

                      <p className="mb-4 text-xs font-medium text-[#788477]">
                        Select your rating
                      </p>

                      <div className="grid grid-cols-5 gap-2 sm:gap-3">

                        {[1, 2, 3, 4, 5].map((rating) => {
                          const isSelected = selectedAnswer === rating;

                          return (
                            <label
                              key={rating}
                              className={`flex min-h-[62px] cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border transition duration-200 hover:-translate-y-1 ${
                                isSelected
                                  ? "border-[#285747] bg-[#285747] text-white shadow-lg shadow-[#285747]/20"
                                  : "border-[#DDE3D7] bg-white text-[#285747] hover:border-[#82977B]"
                              } ${
                                !isOpen || submitting
                                  ? "cursor-not-allowed opacity-60"
                                  : ""
                              }`}
                            >

                              <input
                                type="radio"
                                name={`question-${question.question_id}`}
                                value={rating}
                                checked={isSelected}
                                onChange={() =>
                                  handleAnswerChange(
                                    question.question_id,
                                    rating
                                  )
                                }
                                disabled={!isOpen || submitting}
                                className="sr-only"
                              />

                              <span className="font-serif text-xl font-bold">
                                {rating}
                              </span>

                            </label>
                          );
                        })}

                      </div>

                      <div className="mt-4 flex justify-between text-[10px] font-medium text-[#89957F]">
                        <span>1 · Poor</span>
                        <span>5 · Excellent</span>
                      </div>

                    </div>
                  )}

                  {/* Text Question */}

                  {question.question_type === "Text" && (
                    <div className="rounded-2xl bg-[#F5F6F2] p-3 sm:p-4">

                      <textarea
                        rows={5}
                        value={selectedAnswer || ""}
                        onChange={(event) =>
                          handleAnswerChange(
                            question.question_id,
                            event.target.value
                          )
                        }
                        disabled={!isOpen || submitting}
                        placeholder="Share your thoughts, suggestions, and ideas..."
                        maxLength={2000}
                        className="w-full resize-y rounded-xl border border-[#E1E6DC] bg-white p-4 text-sm leading-7 text-[#4B5545] outline-none transition placeholder:text-[#A0A99A] focus:border-[#82977B] focus:ring-4 focus:ring-[#A6B398]/10 disabled:bg-gray-100"
                      />

                      <p className="mt-2 px-2 text-right text-[10px] text-[#98A18E]">
                        Your feedback helps us improve.
                      </p>

                    </div>
                  )}

                </article>
              );
            })}

          </div>

          {/* Submission Error */}

          {submitError && (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-600"
            >
              <span className="mr-2">!</span>
              {submitError}
            </div>
          )}

          {/* Submission Success */}

          {submitSuccess && (
            <div
              role="status"
              className="mt-6 overflow-hidden rounded-[1.8rem] border border-[#D5E1D0] bg-[#EAF0E6] p-7"
            >

              <div className="flex items-center gap-4">

                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#285747] text-2xl text-white">
                  ✓
                </div>

                <div>
                  <h3 className="font-serif text-xl font-bold text-[#285747]">
                    Thank you for sharing!
                  </h3>

                  <p className="mt-1 text-sm text-[#647264]">
                    Your feedback has been submitted successfully.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* Submit Button */}

          <div className="mt-7 rounded-[1.8rem] bg-[#E7E9DE] p-5 sm:p-7">

            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

              <div>
                <h3 className="font-serif text-xl font-bold text-[#285747]">
                  Ready to share your feedback?
                </h3>

                <p className="mt-2 text-xs leading-5 text-[#788477]">
                  Make sure you've answered all required questions.
                </p>
              </div>

              <button
                type="button"
                disabled={!isOpen || submitting || Boolean(submitSuccess)}
                onClick={handleSubmit}
                className="inline-flex shrink-0 items-center justify-center gap-4 rounded-full bg-[#285747] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#285747]/15 transition duration-300 hover:-translate-y-1 hover:bg-[#1D4437] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {submitting
                  ? "Submitting..."
                  : submitSuccess
                  ? "Feedback Submitted ✓"
                  : "Submit Feedback →"}
              </button>

            </div>
          </div>

        </div>

        {/* Sidebar */}

        <aside className="space-y-5 lg:sticky lg:top-8">

          <div className="overflow-hidden rounded-[1.8rem] bg-[#285747] p-7 text-white">

            <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#C8D2B8]">
              A little reminder
            </span>

            <h3 className="mt-4 font-serif text-3xl font-bold leading-tight">
              Your Voice Matters.
            </h3>

            <p className="mt-4 text-sm leading-7 text-white/75">
              Honest feedback helps create a more meaningful learning
              experience for everyone.
            </p>

            <div className="mt-8 flex items-center justify-between border-t border-white/15 pt-5">

              <span className="text-xs text-white/70">
                OAK Course Feedback
              </span>

              <span className="text-2xl">✦</span>

            </div>
          </div>

          <div className="rounded-[1.8rem] border border-[#E7E9DE] bg-white p-6">

            <h3 className="font-serif text-xl font-bold text-[#285747]">
              Before You Submit
            </h3>

            <div className="mt-5 space-y-4">

              {[
                "Answer all required questions.",
                "Choose the rating that reflects your experience.",
                "Share constructive suggestions.",
              ].map((item, index) => (
                <div key={item} className="flex items-start gap-3">

                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E9EDE4] text-xs font-bold text-[#285747]">
                    {index + 1}
                  </span>

                  <p className="pt-1 text-xs leading-5 text-[#687466]">
                    {item}
                  </p>

                </div>
              ))}

            </div>
          </div>

          <div className="rounded-[1.8rem] border border-[#E7E9DE] bg-[#E7E9DE] p-6">

            <p className="font-serif text-lg font-bold italic text-[#285747]">
              "Better learning begins with listening."
            </p>

            <p className="mt-3 text-[10px] font-bold uppercase tracking-[2px] text-[#87917E]">
              The OAK Community
            </p>

          </div>

        </aside>

      </section>
    </main>
  );
}

export default SurveyDetails;
