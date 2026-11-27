
import HeroCarousel from "../../components/student/HeroCarousel";
import ImpactStats from "../../components/student/ImpactStats";
import EnrolledCourses from "../../components/student/EnrolledCourses";
import FeaturedSurveys from "../../components/student/FeaturedSurveys";
import RecentSubmissions from "../../components/student/RecentSubmissions";
import FooterBanner from "../../components/student/FooterBanner";
import { useAuth } from "../../context/AuthContext";


function StudentHome() {
  const { user } = useAuth();

  return (
    <>
      <section className="mx-4 mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#A6B398]/25 bg-white/80 px-5 py-3 md:mx-8" aria-label="Student account">
        <p className="text-sm font-semibold text-[#2B5748]">Welcome, {user?.fullName || "Student"}</p>
        <p className="text-xs text-[#647264]">Student ID: {user?.userId || "—"}</p>
      </section>
      <div id="home">
        <HeroCarousel />
      </div>

      <ImpactStats />

      <EnrolledCourses />

      <div className="mx-4 mt-10 grid grid-cols-1 items-start gap-6 md:mx-8 lg:grid-cols-3">

        <div className="min-w-0 lg:col-span-2">
          <FeaturedSurveys />
        </div>

        <div className="min-w-0">
          <RecentSubmissions />
        </div>

      </div>

      <FooterBanner />
    </>
  );
}

export default StudentHome;
