
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

// Layouts
import StudentLayout from "./layouts/StudentLayout";
import AdminLayout from "./layouts/AdminLayout";
import RoleDashboardLayout from "./components/layout/RoleDashboardLayout";

// Authentication Pages
import Login from "./pages/auth/Login";
import AcceptInvitation from "./pages/auth/AcceptInvitation";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// Student Pages
import StudentHome from "./pages/student/StudentHome";
import AvailableSurveys from "./pages/student/AvailableSurveys";
import SurveyDetails from "./pages/student/SurveyDetails";
import MySubmissions from "./pages/student/MySubmissions";
import MyCourses from "./pages/student/MyCourses";

// Admin Pages - Dashboard & Survey Management
import AdminDashboard from "./pages/admin/Dashboard";
import CreateSurvey from "./pages/admin/CreateSurvey";
import ManageSurveys from "./pages/admin/ManageSurveys";
import EditSurvey from "./pages/admin/EditSurvey";
import ManageQuestions from "./pages/admin/ManageQuestions";
import StudentManagement from "./pages/admin/StudentManagement";


// Admin Pages - Analytics & Reporting (Merna)
import AnalyticsOverview from "./pages/instructor/AnalyticsOverview";
import SemesterComparison from "./pages/instructor/SemesterComparison";
import ExportReports from "./pages/instructor/ExportReports";


// Instructor Pages
import InstructorAnalyticsOverview from "./pages/instructor/AnalyticsOverview";

// Authentication Protection
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Unauthorized Page
function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7F6] px-4">
      <h1 className="text-4xl font-bold text-[#2B5748]">
        Access Denied
      </h1>

      <p className="mt-3 text-gray-600">
        You do not have permission to access this page.
      </p>

      <button
        onClick={() => (window.location.href = "/")}
        className="mt-6 rounded-lg bg-[#2B5748] px-6 py-3 text-white hover:bg-[#234638]"
      >
        Go Back
      </button>
    </div>
  );
}

function AdminModuleNotice({ moduleName }) {
  return (
    <section className="rounded-2xl border border-[#E5E8E3] bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-[#263D32]">{moduleName}</h1>
      <p className="mt-3 text-sm text-[#526052]">
        This section does not have a page or API implementation in the current project.
      </p>
    </section>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />

          <Route path="/accept-invitation" element={<AcceptInvitation />} />

          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Unauthorized Route */}
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected Student Routes */}
          <Route element={<ProtectedRoute allowedRoles={["Student"]} />}>
            <Route
              path="/"
              element={
                <StudentLayout>
                  <StudentHome />
                </StudentLayout>
              }
            />

            <Route
              path="/surveys"
              element={
                <StudentLayout>
                  <AvailableSurveys />
                </StudentLayout>
              }
            />

            <Route
              path="/surveys/:surveyId"
              element={
                <StudentLayout>
                  <SurveyDetails />
                </StudentLayout>
              }
            />

            <Route
              path="/my-submissions"
              element={
                <StudentLayout>
                  <MySubmissions />
                </StudentLayout>
              }
            />

            <Route
              path="/my-courses"
              element={
                <StudentLayout>
                  <MyCourses />
                </StudentLayout>
              }
            />
          </Route>

          {/* Protected Instructor Routes */}
          <Route element={<ProtectedRoute allowedRoles={["Admin", "Instructor"]} />}>
            <Route
              path="/instructor"
              element={<Navigate to="/instructor/reports" replace />}
            />
            <Route
              path="/instructor/reports"
              element={<RoleDashboardLayout><InstructorAnalyticsOverview /></RoleDashboardLayout>}
            />
            <Route
              path="/instructor/reports/semesters"
              element={<RoleDashboardLayout><SemesterComparison /></RoleDashboardLayout>}
            />
            <Route
              path="/instructor/reports/export"
              element={<RoleDashboardLayout><ExportReports /></RoleDashboardLayout>}
            />
          </Route>

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>

            {/* Admin Dashboard */}
            <Route
              path="/admin"
              element={
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <AdminLayout>
                  <AdminDashboard />
                </AdminLayout>
              }
            />


            <Route
              path="/admin/courses"
              element={
                <AdminLayout>
                  <AdminModuleNotice moduleName="Courses" />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/instructors"
              element={
                <AdminLayout>
                  <AdminModuleNotice moduleName="Instructors" />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/users"
              element={
                <AdminLayout>
                  <StudentManagement />
                </AdminLayout>
              }
            />

            {/* Survey Management */}

            <Route
              path="/admin/surveys/create"
              element={
                <AdminLayout>
                  <CreateSurvey />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/surveys"
              element={
                <AdminLayout>
                  <ManageSurveys />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/questions"
              element={
                <AdminLayout>
                  <ManageQuestions />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/surveys/:id/questions"
              element={
                <AdminLayout>
                  <ManageQuestions />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/surveys/:id/edit"
              element={
                <AdminLayout>
                  <EditSurvey />
                </AdminLayout>
              }
            />

            {/* Analytics & Reporting - Merna */}
            <Route
              path="/admin/reports"
              element={
                <AdminLayout>
                  <AnalyticsOverview />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/reports/semesters"
              element={
                <AdminLayout>
                  <SemesterComparison />
                </AdminLayout>
              }
            />

            <Route
              path="/admin/reports/export"
              element={
                <AdminLayout>
                  <ExportReports />
                </AdminLayout>
              }
            />

          </Route>

          {/* Unknown Routes */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
