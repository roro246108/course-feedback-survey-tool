
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";

// Layouts
import StudentLayout from "./layouts/StudentLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import InstructorDashboard from "./pages/instructor/Dashboard";

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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />

          <Route
            path="/accept-invitation"
            element={<AcceptInvitation />}
          />

          <Route
            path="/verify-email"
            element={<VerifyEmail />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          <Route
            path="/reset-password"
            element={<ResetPassword />}
          />

          {/* Unauthorized Route */}
          <Route
            path="/unauthorized"
            element={<UnauthorizedPage />}
          />

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

          </Route>

          <Route element={<ProtectedRoute allowedRoles={["Instructor"]} />}>
            <Route path="/instructor" element={<InstructorDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["Admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Unknown Routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
