import { BarChart3 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import AdminLayout from "../../layouts/AdminLayout";
import Sidebar from "../Sidebar";

const instructorNavigation = [
  {
    name: "Reports",
    path: "/instructor/reports",
    icon: BarChart3,
    children: [
      { name: "Analytics Overview", path: "/instructor/reports" },
      { name: "Semester Comparison", path: "/instructor/reports/semesters" },
      { name: "Export Reports", path: "/instructor/reports/export" },
    ],
  },
];

export default function RoleDashboardLayout({ children }) {
  const { user } = useAuth();

  if (user?.role === "Admin") {
    return <AdminLayout>{children}</AdminLayout>;
  }

  return (
    <div className="min-h-screen bg-[#F4F7F6]">
      <Sidebar items={instructorNavigation} collapsibleItems />
      <div className="ml-[260px] min-h-screen">
        <header className="relative z-20 flex h-20 items-center justify-between border-b border-[#E5E8E3] bg-white px-8">
          <div>
            <h2 className="text-lg font-semibold text-[#2B5748]">
              Welcome, {user?.fullName || "Instructor"}
            </h2>
            <p className="text-sm text-[#899187]">
              {user?.role || "Instructor"} · Course Feedback Survey Tool
            </p>
          </div>
        </header>
        <main className="w-full min-w-0 overflow-x-clip p-8">{children}</main>
      </div>
    </div>
  );
}
