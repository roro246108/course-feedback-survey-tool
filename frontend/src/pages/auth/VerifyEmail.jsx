
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { authRequest } = useAuth();

  const token = searchParams.get("token");

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function verifyEmail() {
      if (!token) {
        setStatus("error");
        setMessage("The verification link is invalid or missing.");
        return;
      }

      try {
        const response = await authRequest("verify-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to verify your email."
          );
        }

        if (isMounted) {
          setStatus("success");
          setMessage(
            data.message || "Your email has been verified successfully."
          );
        }
      } catch (error) {
        if (isMounted) {
          setStatus("error");
          setMessage(error.message || "Something went wrong.");
        }
      }
    }

    verifyEmail();

    return () => {
      isMounted = false;
    };
  }, [token, authRequest]);

  return (
    <div className="min-h-screen bg-[#F4F7F6] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">

        <div className="w-16 h-16 rounded-2xl bg-[#2B5748] text-white flex items-center justify-center mx-auto mb-6 shadow-md">
          <span className="text-2xl font-bold">CF</span>
        </div>

        {status === "loading" && (
          <>
            <div className="w-10 h-10 border-4 border-[#A6B398] border-t-[#2B5748] rounded-full animate-spin mx-auto mb-5" />

            <h1 className="text-2xl font-bold text-[#2B5748]">
              Verifying Your Email
            </h1>

            <p className="text-gray-500 mt-3">
              Please wait while we verify your email address.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-5xl mb-5">✓</div>

            <h1 className="text-2xl font-bold text-[#2B5748]">
              Email Verified!
            </h1>

            <p className="text-gray-600 mt-3">
              {message}
            </p>

            <Link
              to="/login"
              className="inline-block mt-7 w-full bg-[#2B5748] hover:bg-[#4B5545] text-white font-semibold py-3 rounded-xl transition"
            >
              Go to Login
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-5xl mb-5">!</div>

            <h1 className="text-2xl font-bold text-red-600">
              Verification Failed
            </h1>

            <p className="text-gray-600 mt-3">
              {message}
            </p>

            <Link
              to="/login"
              className="inline-block mt-7 w-full bg-[#2B5748] hover:bg-[#4B5545] text-white font-semibold py-3 rounded-xl transition"
            >
              Back to Login
            </Link>
          </>
        )}

        <p className="text-xs text-gray-400 mt-7">
          Course Feedback Survey Tool
        </p>
      </div>
    </div>
  );
}

export default VerifyEmail;
