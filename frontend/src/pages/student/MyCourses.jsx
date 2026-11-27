import EnrolledCourses from "../../components/student/EnrolledCourses";

function MyCourses() {
  return (
    <main className="min-h-[60vh] pb-10">
      <div className="mx-4 mt-6 rounded-2xl border border-[#A6B398]/25 bg-white px-6 py-5 md:mx-8">
        <p className="text-[10px] font-bold uppercase tracking-[2px] text-[#89977F]">Student portal</p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-[#2B5748]">My Courses</h1>
        <p className="mt-2 text-sm text-[#647264]">Your enrolled courses and their current feedback opportunities.</p>
      </div>
      <EnrolledCourses />
    </main>
  );
}

export default MyCourses;
