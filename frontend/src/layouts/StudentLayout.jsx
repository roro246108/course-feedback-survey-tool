import StudentNavbar from "../components/student/StudentNavbar";

function StudentLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#F4F7F6]">
      <StudentNavbar />
      <main className="mx-auto w-full">
        {children}
      </main>
    </div>
  );
}

export default StudentLayout;