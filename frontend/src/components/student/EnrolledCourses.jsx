import { useCallback, useEffect, useState } from "react";
import { getEnrolledCourses } from "../../services/availableSurveysService";
import { useAuth } from "../../context/AuthContext";

function EnrolledCourses() {
  const { apiFetch } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCourses = useCallback(async () => {
    try {
      setCourses(await getEnrolledCourses(apiFetch));
    } catch (requestError) {
      console.error("Error loading enrolled courses:", requestError);
      setError("Unable to load your enrolled courses.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return (
    <section className="mx-4 mt-10 md:mx-8" aria-labelledby="enrolled-courses-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#89977F]">
            Your classes
          </span>
          <h2 id="enrolled-courses-title" className="mt-1 font-serif text-2xl font-bold text-[#2B5748] md:text-3xl">
            My Enrolled Courses
          </h2>
        </div>
        {!loading && !error && (
          <span className="text-sm text-[#647264]">{courses.length} {courses.length === 1 ? "course" : "courses"}</span>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-[#E1E7DD] bg-white p-7 text-center text-sm text-[#647264]" role="status">
          Loading your courses...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl border border-red-100 bg-white p-7 text-center" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => { setError(""); setLoading(true); fetchCourses(); }} className="mt-3 rounded-full bg-[#285747] px-5 py-2 text-sm font-semibold text-white">
            Try again
          </button>
        </div>
      )}

      {!loading && !error && courses.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#C8D2C3] bg-white px-6 py-10 text-center">
          <h3 className="font-serif text-xl font-bold text-[#285747]">No enrolled courses yet</h3>
          <p className="mt-2 text-sm text-[#647264]">Courses you are enrolled in will appear here.</p>
        </div>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => {
            const availableCount = Number(course.available_survey_count) || 0;
            return (
              <article key={`${course.course_id}-${course.semester_name}-${course.academic_year}`} className="rounded-2xl border border-[#A6B398]/25 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#285747]">{course.course_name}</h3>
                    <p className="mt-1 text-xs font-semibold tracking-wide text-[#87977D]">{course.course_code}</p>
                  </div>
                  <span className="rounded-full bg-[#E9EDE4] px-3 py-1 text-xs font-semibold text-[#285747]">
                    {availableCount > 0
                      ? `${availableCount} ${availableCount === 1 ? "survey" : "surveys"} available`
                      : "No open surveys"}
                  </span>
                </div>
                <dl className="mt-5 space-y-3 border-t border-[#E9ECE5] pt-4 text-sm">
                  <div>
                    <dt className="text-xs text-[#89977F]">Instructor</dt>
                    <dd className="mt-0.5 font-medium text-[#526456]">{course.instructor_name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#89977F]">Semester</dt>
                    <dd className="mt-0.5 font-medium text-[#526456]">{course.semester_name} · {course.academic_year}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default EnrolledCourses;
