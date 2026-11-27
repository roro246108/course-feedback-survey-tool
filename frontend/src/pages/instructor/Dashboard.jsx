import RoleDashboardLayout from "../../components/layout/RoleDashboardLayout";

export default function InstructorDashboard() {
  return (
    <RoleDashboardLayout>
      <p className="text-xs font-bold uppercase tracking-[2px] text-[#A6B398]">Instructor</p>
      <h1 className="mt-3 font-serif text-4xl font-bold">Instructor Dashboard</h1>
      <section className="mt-8 rounded-2xl border border-[#A6B398]/30 bg-white p-7 shadow-sm">
        <h2 className="font-serif text-xl font-bold">Course feedback</h2>
        <p className="mt-2 text-sm leading-6 text-[#4B5545]">Your instructor account is signed in. Instructor survey and course management features will appear here when their backend endpoints are available.</p>
      </section>
    </RoleDashboardLayout>
  );
}
