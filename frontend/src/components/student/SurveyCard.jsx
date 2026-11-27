
import { Link } from "react-router-dom";

import algorithmsImage from "../../assets/images/surveys/algorithms.jpg";
import dataStructuresImage from "../../assets/images/surveys/data-structures.jpg";
import softwareEngineeringImage from "../../assets/images/surveys/software-engineering.jpg";

function getCourseImage(courseName = "") {
  const name = courseName.toLowerCase();

  if (name.includes("data structure")) return dataStructuresImage;
  if (name.includes("software engineering")) return softwareEngineeringImage;
  if (name.includes("algorithm")) return algorithmsImage;

  return dataStructuresImage;
}

function getDeadline(closingDate) {
  const deadline = new Date(closingDate);

  if (Number.isNaN(deadline.getTime())) {
    return "Open survey";
  }

  const difference = deadline.getTime() - Date.now();

  if (difference <= 0) return "Deadline passed";

  const days = Math.ceil(difference / (1000 * 60 * 60 * 24));

  if (days === 1) return "Ends tomorrow";
  if (days < 7) return `Ends in ${days} days`;

  const weeks = Math.ceil(days / 7);

  return `Ends in ${weeks} week${weeks > 1 ? "s" : ""}`;
}

function SurveyCard({ survey, featured = false }) {
  const image = getCourseImage(survey.course_name);
  const deadline = getDeadline(survey.closing_date);

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-[2rem] border border-[#E7E9DE] bg-white shadow-[0_5px_20px_rgba(43,87,72,0.05)] transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_22px_45px_rgba(43,87,72,0.13)] ${
        featured ? "md:rounded-[2.4rem]" : ""
      }`}
    >
      {/* Image */}
      <div
        className={`relative overflow-hidden ${
          featured ? "h-64 sm:h-72" : "h-56"
        }`}
      >
        <img
          src={image}
          alt={`${survey.course_name} course`}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          loading="lazy"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-[#183D30]/50 via-transparent to-black/10" />

        {/* Course badge */}
        <div className="absolute left-4 top-4 rounded-full border border-white/40 bg-white/90 px-4 py-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#285747] shadow-sm backdrop-blur-md">
          Course Feedback
        </div>

        {/* Deadline */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-[#E8E3C9]/95 px-4 py-2.5 text-xs font-semibold text-[#285747] shadow-lg backdrop-blur-md">
          <span>◷</span>
          {deadline}
        </div>

        {/* Decorative icon */}
        <div className="absolute bottom-4 right-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/90 text-xl text-[#285747] shadow-lg transition duration-300 group-hover:rotate-45">
          ↗
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-6 sm:p-7">

        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[2px] text-[#9A9D78]">
            {survey.course_code || "YOUR COURSE"}
          </span>

          <span className="h-2 w-2 rounded-full bg-[#7E9A77]" />
        </div>

        <h3 className="mt-3 font-serif text-2xl font-bold leading-tight text-[#214E3D] transition-colors group-hover:text-[#78916D]">
          {survey.course_name}
        </h3>

        <p className="mt-3 min-h-[48px] text-sm leading-7 text-[#718071]">
          {survey.description ||
            `Share your feedback and experience about ${survey.course_name}.`}
        </p>

        <div className="mt-auto pt-6">
          <div className="mb-5 flex items-center gap-3 border-t border-[#E9ECE5] pt-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E7EBDD] text-sm font-bold text-[#285747]">
              {survey.instructor_name
                ? survey.instructor_name
                    .split(" ")
                    .slice(1, 3)
                    .map((part) => part[0])
                    .join("")
                : "IN"}
            </div>

            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[1px] text-[#A0A99A]">
                Course Instructor
              </p>
              <p className="truncate text-xs font-semibold text-[#526456]">
                {survey.instructor_name || "Instructor"}
              </p>
            </div>
          </div>

          <Link
            to={`/surveys/${survey.survey_id}`}
            className="flex w-full items-center justify-between rounded-full bg-[#285747] px-6 py-4 text-sm font-semibold text-white transition duration-300 hover:bg-[#1D4437] group-hover:shadow-lg group-hover:shadow-[#285747]/20"
          >
            <span>Take Survey</span>

            <span className="text-lg transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>
      </div>
    </article>
  );
}

export default SurveyCard;
