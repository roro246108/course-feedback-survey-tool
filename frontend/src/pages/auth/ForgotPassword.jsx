
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import loginImage from "../../assets/images/login.jpg";

function ForgotPassword() {
  const { authRequest } = useAuth();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await authRequest("forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to process your request."
        );
      }

      setSuccess(
        data.message ||
          "If an account exists with this email, password reset instructions will be sent."
      );

      setEmail("");
    } catch (err) {
      setError(
        err.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F4F7F6] px-5 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center">

        <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">

          {/* Form Section */}
          <section className="mx-auto w-full max-w-lg py-8 lg:py-0">

            {/* Logo */}
            <Link to="/login" className="mb-12 inline-flex items-center gap-3">
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
                Account Recovery
              </p>

              <h1 className="font-serif text-4xl font-bold leading-tight text-[#2B5748] md:text-5xl">
                Reset Your
                <br />
                Password<span className="text-[#A6B398]">.</span>
              </h1>

              <p className="mt-4 max-w-md text-base leading-7 text-[#4B5545]/75">
                Forgot your password? It happens. Enter your registered
                email address and we'll help you get back to your account.
              </p>
            </div>

            {/* Form Card */}
            <div className="rounded-3xl border border-[#A6B398]/20 bg-white p-6 shadow-sm md:p-8">

              <form onSubmit={handleSubmit} className="space-y-6">

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
                    placeholder="Enter your registered email"
                    autoComplete="email"
                    required
                    maxLength={255}
                    className="w-full rounded-xl border border-[#A6B398]/40 bg-[#F9FAF8] px-5 py-4 text-sm text-[#2B5748] outline-none transition duration-300 placeholder:text-[#A6B398] focus:border-[#2B5748] focus:bg-white focus:ring-4 focus:ring-[#2B5748]/10"
                  />
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

                {/* Success */}
                {success && (
                  <div
                    role="status"
                    className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-800"
                  >
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-3 rounded-xl bg-[#2B5748] px-6 py-4 text-sm font-bold text-white shadow-lg shadow-[#2B5748]/15 transition duration-300 hover:-translate-y-1 hover:bg-[#4B5545] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Sending..." : "Send Reset Instructions"}

                  {!loading && (
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  )}
                </button>

              </form>

              <div className="mt-7 border-t border-[#A6B398]/20 pt-6 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#2B5748] transition hover:text-[#A6B398]"
                >
                  <span>←</span>
                  Back to Login
                </Link>
              </div>

            </div>

            <p className="mt-7 text-center text-xs text-[#4B5545]/55">
              OAK · Course Feedback Survey Tool
            </p>

          </section>

          {/* Image Section */}
          <section className="group relative hidden h-[680px] overflow-hidden rounded-[2.5rem] shadow-2xl shadow-[#2B5748]/15 lg:block">

            <img
              src={loginImage}
              alt="Students studying in a university library"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#142E27]/90 via-[#142E27]/20 to-[#142E27]/10" />

            {/* Decorative Circles */}
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border border-white/25 transition-transform duration-1000 group-hover:scale-125" />

            <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full border border-white/20" />

            {/* Image Content */}
            <div className="absolute bottom-12 left-10 right-10">

              <span className="mb-5 inline-block rounded-full border border-white/30 bg-white/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[3px] text-white backdrop-blur-md">
                Your Account · Your Security
              </span>

              <h2 className="max-w-md font-serif text-4xl font-bold leading-tight text-white xl:text-5xl">
                A Fresh Start.
                <br />
                <span className="italic text-[#D6DCCB]">
                  A Secure Return.
                </span>
              </h2>

              <p className="mt-5 max-w-sm text-sm leading-7 text-white/80">
                Your learning journey matters. We're here to help you
                securely regain access and continue where you left off.
              </p>

              <div className="mt-8 h-1 w-16 rounded-full bg-[#DED4AF] transition-all duration-500 group-hover:w-28" />

            </div>

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
              A Fresh Start. A Secure Return.
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}

export default ForgotPassword;
