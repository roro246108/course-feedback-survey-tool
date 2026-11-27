
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ allowedRoles }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  // Wait until authentication status is checked
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7F6]">
        <p className="font-medium text-[#2B5748]">
          Checking authentication...
        </p>
      </div>
    );
  }

  // Redirect unauthenticated users to Login
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    );
  }

  // Check whether the user's role is allowed
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const roleHome = { Student: "/", Instructor: "/instructor", Admin: "/admin" };
    return <Navigate to={roleHome[user.role] || "/unauthorized"} replace state={{ from: location }} />;
  }

  return <Outlet />;
}
