import RoleDashboardLayout from "../../components/layout/RoleDashboardLayout";

export default function AdminDashboard() {
  return (
    <RoleDashboardLayout>
      <p className="text-xs font-bold uppercase tracking-[2px] text-[#A6B398]">Administrator</p>
      <h1 className="mt-3 font-serif text-4xl font-bold">Admin Dashboard</h1>
      <section className="mt-8 rounded-2xl border border-[#A6B398]/30 bg-white p-7 shadow-sm">
        <h2 className="font-serif text-xl font-bold">Administration</h2>
        <p className="mt-2 text-sm leading-6 text-[#4B5545]">Your administrator account is signed in. Administrative user and survey management screens can be opened here as they are connected to their backend services.</p>
      </section>
    </RoleDashboardLayout>
  );
}
