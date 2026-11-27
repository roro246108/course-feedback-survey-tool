import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import loginImage from "../../assets/images/login.jpg";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, authRequest } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState("");
  const [verificationError, setVerificationError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { user } = await login(email.trim(), password);

      const roleDestinations = {
        Student: "/",
        Instructor: "/instructor/reports",
        Admin: "/admin",
      };

      navigate(roleDestinations[user.role] || "/unauthorized", {
        replace: true,
        state: { from: location.state?.from },
      });
    } catch (err) {
      setError(err.message || "Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setResendingVerification(true);
    setVerificationNotice("");
    setVerificationError("");
    try {
      const response = await authRequest("resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || "Unable to resend the verification email.");
      }
      setVerificationNotice(
        result.message || "If an eligible account exists, a verification email has been sent."
      );
    } catch (requestError) {
      setVerificationError(
        requestError.message || "Unable to resend the verification email."
      );
    } finally {
      setResendingVerification(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F7F6] px-5 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center">

        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">

          {/* Login Section */}
          <section className="mx-auto w-full max-w-lg py-8 lg:py-0">

            {/* Logo */}
            <Link to="/" className="mb-12 inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2B5748] text-xl font-bold text-white shadow-md">
                O
              </div>

              <div>
                <p className="font-serif text-2xl font-bold text-[#2B5748]">
                  OAK
                </p>
                <p className="text-[9px] tracking-[3px] text-[#4B5545]">
                  COURSE FEEDBACK
                </p>
              </div>
            </Link>

            {/* Heading */}
            <div className="mb-9">
              <p className="mb-3 text-xs font-bold uppercase tracking-[3px] text-[#A6B398]">
                Welcome to OAK
              </p>

              <h1 className="font-serif text-4xl font-bold leading-tight text-[#2B5748] md:text-5xl">
                Welcome Back
                <span className="text-[#A6B398]">.</span>
              </h1>

              <p className="mt-4 text-base leading-7 text-[#4B5545]/75">
                Sign in to continue your learning experience and make your
                voice count.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-[#2B5748]"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-[#A6B398]/40 bg-white px-5 py-4 text-sm text-[#2B5748] outline-none transition duration-300 placeholder:text-[#A6B398] focus:border-[#2B5748] focus:ring-4 focus:ring-[#2B5748]/10"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-[#2B5748]"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-[#A6B398]/40 bg-white px-5 py-4 pr-20 text-sm text-[#2B5748] outline-none transition duration-300 placeholder:text-[#A6B398] focus:border-[#2B5748] focus:ring-4 focus:ring-[#2B5748]/10"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[#4B5545] transition hover:text-[#2B5748]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-[#2B5748] transition hover:text-[#A6B398]"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}
              {error.toLowerCase().includes("verify your email") && (
                <button
                  type="button"
                  disabled={resendingVerification || !email.trim()}
                  onClick={handleResendVerification}
                  className="w-full rounded-xl border border-[#A6B398]/50 px-4 py-3 text-sm font-semibold text-[#2B5748] disabled:opacity-60"
                >
                  {resendingVerification ? "Sending verification email..." : "Resend verification email"}
                </button>
              )}
              {verificationNotice && (
                <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                  {verificationNotice}
                </p>
              )}
              {verificationError && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {verificationError}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#2B5748] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-[#2B5748]/15 transition duration-300 hover:-translate-y-1 hover:bg-[#4B5545] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign In"}

                {!loading && (
                  <span className="transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                )}
              </button>

            </form>

            <p className="mt-8 text-center text-xs leading-6 text-[#4B5545]/65">
              Account access is provided through administrator invitations.
            </p>

          </section>

          {/* Image Section */}
          <section className="group relative hidden h-[680px] overflow-hidden rounded-[2.5rem] shadow-2xl shadow-[#2B5748]/15 lg:block">

            {/* Main Image */}
            <img
              src={loginImage}
              alt="Students studying in a university library"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
            />

            {/* Image Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#142E27]/90 via-[#142E27]/20 to-[#142E27]/10 transition duration-500 group-hover:from-[#142E27]/80" />

            {/* Decorative Circle */}
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/25 transition-transform duration-1000 group-hover:scale-125" />

            <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full border border-white/20" />

            {/* Floating Content */}
            <div className="absolute bottom-12 left-10 right-10">

              <span className="mb-5 inline-block rounded-full border border-white/30 bg-white/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[3px] text-white backdrop-blur-md">
                Learn · Share · Improve
              </span>

              <h2 className="max-w-md font-serif text-4xl font-bold leading-tight text-white xl:text-5xl">
                Your Voice.
                <br />
                Your Learning.
                <br />
                <span className="italic text-[#D6DCCB]">
                  Your Impact.
                </span>
              </h2>

              <p className="mt-5 max-w-sm text-sm leading-7 text-white/80">
                Every opinion matters. Share your experience and help create
                a better learning environment for everyone.
              </p>

              <div className="mt-8 h-1 w-16 rounded-full bg-[#DED4AF] transition-all duration-500 group-hover:w-28" />

            </div>

            {/* Top Label */}
            <div className="absolute right-8 top-8 rounded-full border border-white/25 bg-white/15 px-5 py-3 text-xs font-medium text-white backdrop-blur-lg">
              OAK Course Feedback
            </div>

          </section>

          {/* Mobile Image */}
          <div className="group relative h-64 overflow-hidden rounded-[2rem] shadow-xl lg:hidden">
            <img
              src={loginImage}
              alt="University library"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#142E27]/85 to-transparent" />

            <p className="absolute bottom-6 left-6 font-serif text-2xl font-bold text-white">
              Your Voice. Your Impact.
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}

export default Login;