import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";

const API = "http://localhost:5000/users";

function ForgotPassword() {
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // STEP 1 - REQUEST RESET CODE
  const handleRequestCode = async (e) => {
    e.preventDefault();

    setIsPending(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to request password reset");
      }

      setMessage(data.message);
      setStep(2);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsPending(false);
    }
  };

  // STEP 2 - VERIFY CODE
  const handleVerifyCode = async (e) => {
    e.preventDefault();

    setIsPending(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`${API}/verify-reset-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid verification code");
      }

      setMessage(data.message);
      setStep(3);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsPending(false);
    }
  };

  // STEP 3 - RESET PASSWORD
  const handleResetPassword = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    setIsPending(true);

    try {
      const res = await fetch(`${API}/reset-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setMessage(data.message);

      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setError(error.message);
    } finally {
      setIsPending(false);
    }
  };

  const handleBackToLogin = () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid md:grid-cols-2">
        {/* Branding */}
        <div className="hidden md:flex bg-primary p-10 lg:p-14 flex-col justify-center items-center text-center">
          <img
            src="/logo.png"
            alt="Postora"
            className="w-64 lg:w-72 object-contain"
          />

          <h1 className="mt-8 text-3xl font-bold text-white">
            {step === 1 && "Reset your password"}
            {step === 2 && "Verify your account"}
            {step === 3 && "Create a new password"}
          </h1>

          <p className="mt-4 max-w-sm text-white/80 leading-relaxed">
            {step === 1 &&
              "Enter your email address and we will help you recover your Postora account."}

            {step === 2 &&
              "Enter the verification code generated for your account to continue."}

            {step === 3 && "Choose a new password for your Postora account."}
          </p>
        </div>

        {/* Form */}
        <div className="flex items-center p-6 sm:p-10 lg:p-14">
          <div className="w-full max-w-md mx-auto">
            {/* Mobile logo */}
            <div className="flex justify-center mb-8 md:hidden">
              <img
                src="/logo-1.png"
                alt="Postora"
                className="w-48 object-contain"
              />
            </div>

            {/* STEP 1 */}
            {step === 1 && (
              <>
                <div className="mb-8">
                  <Link
                    to="/login"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-primary"
                  >
                    <ArrowLeft size={17} />
                    Back to login
                  </Link>

                  <h2 className="text-3xl font-bold text-gray-900">
                    Forgot password?
                  </h2>

                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                    Enter the email address associated with your account and we
                    will send you a verification code.
                  </p>
                </div>

                <form onSubmit={handleRequestCode} className="space-y-5">
                  {/* Email */}
                  <div>
                    <label
                      htmlFor="forgot-password-email"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Email address
                    </label>

                    <div className="relative">
                      <Mail
                        size={19}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        id="forgot-password-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        autoComplete="email"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Sending..." : "Continue"}
                  </button>
                </form>
              </>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <>
                <div className="mb-8">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError("");
                      setMessage("");
                    }}
                    className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-primary"
                  >
                    <ArrowLeft size={17} />
                    Change email
                  </button>

                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <ShieldCheck size={25} className="text-primary" />
                  </div>

                  <h2 className="text-3xl font-bold text-gray-900">
                    Verification code sent
                  </h2>

                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                    For this demo, the verification code has been sent to the
                    Postora email.
                  </p>

                  <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                    Please contact Postora to receive your verification code.
                  </p>

                  <a
                    href="https://mail.google.com/mail/?view=cm&fs=1&to=postora.app@gmail.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm font-semibold text-primary hover:underline"
                  >
                    Contact Postora
                  </a>
                </div>

                <form onSubmit={handleVerifyCode} className="space-y-5">
                  {/* Code */}
                  <div>
                    <label
                      htmlFor="reset-code"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Verification code
                    </label>

                    <input
                      id="reset-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="Enter 6-digit code"
                      autoComplete="one-time-code"
                      required
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg tracking-[0.35em] text-gray-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Verifying..." : "Verify code"}
                  </button>
                </form>
              </>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <>
                <div className="mb-8">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Lock size={25} className="text-primary" />
                  </div>

                  <h2 className="text-3xl font-bold text-gray-900">
                    Create new password
                  </h2>

                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">
                    Create a new password for your Postora account.
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-5">
                  {/* New Password */}
                  <div>
                    <label
                      htmlFor="new-password"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      New password
                    </label>

                    <div className="relative">
                      <Lock
                        size={19}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm text-gray-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                      />

                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                        aria-label={
                          showNewPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showNewPassword ? (
                          <EyeOff size={19} />
                        ) : (
                          <Eye size={19} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="mb-2 block text-sm font-medium text-gray-700"
                    >
                      Confirm password
                    </label>

                    <div className="relative">
                      <Lock
                        size={19}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />

                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        required
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-11 text-sm text-gray-900 outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={19} />
                        ) : (
                          <Eye size={19} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}

                  {/* Success */}
                  {message && (
                    <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-600">
                      {message}
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Resetting..." : "Reset password"}
                  </button>
                </form>
              </>
            )}

            {/* Success after reset */}
            {step === 3 && message === "Password reset successfully" && (
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  Back to login
                </button>
              </div>
            )}

            {/* Success message for step 1 / 2 */}
            {step !== 3 && message && (
              <div className="mt-5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-600">
                {message}
              </div>
            )}

            {step === 1 && (
              <p className="mt-7 text-center text-sm text-gray-500">
                Remember your password?
                <Link
                  to="/login"
                  className="ml-1 font-semibold text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
