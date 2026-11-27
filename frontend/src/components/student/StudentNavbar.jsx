
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function TreeLogo() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="h-12 w-12 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M31 48V29M31 38L20 29M31 35L42 25"
        stroke="#2B5748"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M31 5C25 5 22 10 23 14C16 11 10 17 13 23C5 25 7 34 14 36C14 43 23 45 28 39C32 44 42 42 43 35C52 35 55 26 48 22C51 15 44 10 38 13C38 7 34 5 31 5Z"
        fill="#A6B398"
      />
      <path
        d="M31 5C25 5 22 10 23 14C16 11 10 17 13 23C5 25 7 34 14 36C18 39 24 37 28 32C34 36 42 32 43 25C51 26 53 18 46 14C43 10 39 10 35 13C35 8 34 5 31 5Z"
        fill="#2B5748"
        fillOpacity=".9"
      />
      <path
        d="M31 47L25 58H38L31 47Z"
        fill="#4B5545"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10Z" />
    </svg>
  );
}

function SurveyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <rect x="4" y="4" width="16" height="17" rx="2" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

function SubmissionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M7 3h8l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v5h5M9 13h7M9 17h7" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-1 .9-1.8 1.2-1.8 2.8M12 17h.01" />
    </svg>
  );
}

function StudentNavbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logout(); } catch (error) { console.error("Logout request failed:", error); }
    finally { navigate("/login", { replace: true }); }
  }

  const navItems = [
    {
      label: "Home",
      to: "/",
      icon: <HomeIcon />,
    },
    {
      label: "Surveys",
      to: "/surveys",
      icon: <SurveyIcon />,
    },
    {
      label: "My Submissions",
      to: "/my-submissions",
      icon: <SubmissionIcon />,
    },
    {
      label: "Help",
      to: "#help",
      icon: <HelpIcon />,
    },
  ];

  function isActive(path) {
    if (path === "/") {
      return location.pathname === "/";
    }

    return location.pathname === path;
  }

  return (
    <header className="relative z-50 w-full px-4 py-4 md:px-8">
      <div className="mx-auto flex max-w-[1550px] items-center justify-between gap-4">

        {/* Logo */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2"
        >
          <TreeLogo />

          <div className="leading-none">
            <h1 className="font-serif text-3xl font-bold tracking-wide text-[#2B5748]">
              OAK
            </h1>

            <p className="mt-1 text-[9px] font-medium tracking-[3px] text-[#4B5545]">
              COURSE FEEDBACK
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 rounded-full border border-white/70 bg-white/85 p-1.5 shadow-[0_5px_25px_rgba(43,87,72,0.10)] backdrop-blur-xl lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium transition-all duration-300 ${
                isActive(item.to)
                  ? "bg-[#A6B398]/50 text-[#2B5748]"
                  : "text-[#4B5545] hover:bg-[#DED4AF]/60 hover:text-[#2B5748]"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Notifications and Profile */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            aria-label="Notifications"
            className="relative rounded-full p-2.5 text-[#2B5748] transition hover:bg-[#DED4AF]/50"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#B85D5D] ring-2 ring-[#F4F7F6]" />
          </button>

          <div className="hidden h-9 w-px bg-[#BDCADD] sm:block" />

          <div className="flex items-center gap-2 rounded-full p-1.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2B5748] text-sm font-semibold text-white">
              {(user?.fullName || "Student").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
            </span>

            <span className="block text-left">
              <span className="block text-xs font-semibold text-[#2B5748]">
                {user?.fullName || "Student"}
              </span>

              <span className="block text-[10px] text-[#4B5545]">
                {user?.role || "Student"}
              </span>
            </span>

            <span className="hidden text-[#4B5545] sm:block">
              ⌄
            </span>
          </div>
          <button type="button" onClick={handleLogout} disabled={loggingOut} className="rounded-full border border-[#A6B398]/50 px-3 py-2 text-xs font-semibold text-[#2B5748] transition hover:bg-white disabled:opacity-60">
            {loggingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className="mt-3 flex items-center justify-center gap-1 overflow-x-auto rounded-2xl border border-white/70 bg-white/90 p-1.5 shadow-sm backdrop-blur-xl lg:hidden">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-medium transition-all ${
              isActive(item.to)
                ? "bg-[#A6B398]/50 text-[#2B5748]"
                : "text-[#4B5545]"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export default StudentNavbar;
