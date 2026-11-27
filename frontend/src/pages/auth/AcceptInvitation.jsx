
import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { authRequest } = useAuth();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!token) {
      setError("Invitation link is invalid or missing.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await authRequest("accept-invitation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            password,
            confirmPassword,
          }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to accept the invitation."
        );
      }

      setSuccess(
        data.message || "Your account has been created successfully."
      );

      setPassword("");
      setConfirmPassword("");

      // Give the user time to read the success message.
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7F6] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[#2B5748] text-white flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="text-2xl font-bold">CF</span>
          </div>

          <h1 className="text-3xl font-bold text-[#2B5748]">
            Create Your Password
          </h1>

          <p className="text-gray-500 mt-2">
            Complete your account setup to join Course Feedback.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">

          {!token ? (
            <div className="text-center">
              <p className="text-red-600 mb-5">
                Invitation link is invalid or missing.
              </p>

              <Link
                to="/login"
                className="text-[#2B5748] font-semibold hover:underline"
              >
                Go to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  New Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Create your password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    className="w-full px-4 py-3 pr-20 rounded-xl border border-gray-300 outline-none focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/20 transition"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#2B5748]"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  Use 8–128 characters with uppercase, lowercase, a number,
                  and a special character. No spaces.
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Confirm Password
                </label>

                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    className="w-full px-4 py-3 pr-20 rounded-xl border border-gray-300 outline-none focus:border-[#2B5748] focus:ring-2 focus:ring-[#2B5748]/20 transition"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[#2B5748]"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
                >
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div
                  role="status"
                  className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm"
                >
                  {success}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || Boolean(success)}
                className="w-full bg-[#2B5748] hover:bg-[#4B5545] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-sm"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>

            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#2B5748] hover:underline"
          >
            Sign In
          </Link>
        </p>

        <p className="text-center text-xs text-gray-400 mt-4">
          Course Feedback Survey Tool
        </p>
      </div>
    </div>
  );
}

export default AcceptInvitation;
