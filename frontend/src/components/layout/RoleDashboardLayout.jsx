import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function RoleDashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logout(); } catch (error) { console.error("Logout request failed:", error); }
    finally { navigate("/login", { replace: true }); }
  }

  return (
    <div className="min-h-screen bg-[#F4F7F6] text-[#2B5748]">
      <header className="flex items-center justify-between border-b border-[#A6B398]/30 bg-white px-6 py-4 shadow-sm md:px-10">
        <div>
          <p className="font-serif text-2xl font-bold tracking-wide">OAK</p>
          <p className="text-[10px] font-medium tracking-[3px] text-[#4B5545]">COURSE FEEDBACK</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold">{user?.fullName || ""}</p>
            <p className="text-xs text-[#4B5545]">{user?.role || ""}</p>
          </div>
          <button onClick={handleLogout} disabled={loggingOut} className="rounded-full border border-[#A6B398]/50 px-4 py-2 text-sm font-semibold hover:bg-[#F4F7F6] disabled:opacity-60">
            {loggingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12 md:px-10">{children}</main>
    </div>
  );
}
