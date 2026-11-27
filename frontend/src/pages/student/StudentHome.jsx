
import HeroCarousel from "../../components/student/HeroCarousel";
import ImpactStats from "../../components/student/ImpactStats";
import EnrolledCourses from "../../components/student/EnrolledCourses";
import FeaturedSurveys from "../../components/student/FeaturedSurveys";
import RecentSubmissions from "../../components/student/RecentSubmissions";
import FooterBanner from "../../components/student/FooterBanner";


function StudentHome() {
  return (
    <>
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
