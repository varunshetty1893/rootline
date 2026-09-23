import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  GitBranch,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  KeyRound,
  Send,
  Info,
} from "lucide-react";
import { api } from "./api.js";
import { Field } from "./RootlineRegister.jsx";

export default function RootlineForgotPassword() {
  const navigate = useNavigate();

  // Step state: 1 = Email, 2 = 6-digit OTP, 3 = New Password, 4 = Success
  const [step, setStep] = useState(1);

  // Form states
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState("");

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [serverOtp, setServerOtp] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // Resend countdown timer
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Refs for 6-digit inputs
  const otpInputRefs = useRef([]);

  // Timer for resend cooldown
  useEffect(() => {
    let timer;
    if (step === 2 && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Focus first OTP box when entering Step 2
  useEffect(() => {
    if (step === 2 && otpInputRefs.current[0]) {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 150);
    }
  }, [step]);

  // Handle Step 1: Submit Email
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError("");
    setNotFound(false);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.forgotPassword(cleanEmail);

      const generatedOtp = res?.otp_code || "";
      const wasEmailSent = Boolean(res?.email_sent);
      setServerOtp(generatedOtp);
      setEmailSent(wasEmailSent);

      // Transition to Step 2
      setStep(2);
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      const errMsg = err.message || "";
      if (
        errMsg.toLowerCase().includes("no rootline account") ||
        errMsg.toLowerCase().includes("not found") ||
        errMsg.toLowerCase().includes("never exist")
      ) {
        setNotFound(true);
        setError(
          "No Rootline account was found registered with this email address. Please check your spelling or register a new account."
        );
      } else {
        setError(errMsg || "Unable to process request. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle 6-digit OTP input change
  const handleOtpChange = (index, value) => {
    // Handle paste of complete 6-digit code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      if (digits.length > 0) {
        const newOtp = [...otpDigits];
        digits.forEach((d, i) => {
          if (i < 6) newOtp[i] = d;
        });
        setOtpDigits(newOtp);
        const nextIndex = Math.min(digits.length, 5);
        otpInputRefs.current[nextIndex]?.focus();

        if (digits.length === 6) {
          triggerOtpVerification(newOtp.join(""));
        }
      }
      return;
    }

    // Only allow numeric input
    const char = value.replace(/\D/g, "");
    const newOtp = [...otpDigits];
    newOtp[index] = char;
    setOtpDigits(newOtp);

    // Auto-advance to next box
    if (char && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-verify if all 6 digits are typed
    if (char && index === 5) {
      const completeCode = newOtp.join("");
      if (completeCode.length === 6) {
        triggerOtpVerification(completeCode);
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle Step 2: Verify 6-digit OTP
  const triggerOtpVerification = async (codeToVerify) => {
    const fullOtp = (codeToVerify || otpDigits.join("")).trim();
    if (fullOtp.length !== 6) {
      setError("Please enter all 6 digits of the verification code.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const res = await api.verifyOtp(email.trim().toLowerCase(), fullOtp);
      if (res?.reset_token) {
        setResetToken(res.reset_token);
        setStep(3);
      } else {
        throw new Error("Invalid verification response from server.");
      }
    } catch (err) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifySubmit = (e) => {
    e.preventDefault();
    triggerOtpVerification();
  };

  // Handle Step 3: Set New Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setSubmitting(true);
    try {
      await api.resetPassword(resetToken, newPassword);
      setStep(4);
      setTimeout(() => {
        navigate("/login");
      }, 2500);
    } catch (err) {
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F5F0] px-6 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <Link to="/" className="flex items-center gap-1.5 mb-6 w-fit">
          <GitBranch className="w-3.5 h-3.5 text-[#1C4B3C]" strokeWidth={2.5} />
          <p className="text-[11px] tracking-[0.2em] font-semibold text-[#1C4B3C]">
            ROOTLINE
          </p>
        </Link>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
              step >= 1
                ? "bg-[#1C4B3C] text-white"
                : "bg-[#E5E7EB] text-[#6B7280]"
            }`}
          >
            1
          </span>
          <div
            className={`h-0.5 flex-1 rounded ${
              step >= 2 ? "bg-[#1C4B3C]" : "bg-[#E5E7EB]"
            }`}
          />
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
              step >= 2
                ? "bg-[#1C4B3C] text-white"
                : "bg-[#E5E7EB] text-[#6B7280]"
            }`}
          >
            2
          </span>
          <div
            className={`h-0.5 flex-1 rounded ${
              step >= 3 ? "bg-[#1C4B3C]" : "bg-[#E5E7EB]"
            }`}
          />
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
              step >= 3
                ? "bg-[#1C4B3C] text-white"
                : "bg-[#E5E7EB] text-[#6B7280]"
            }`}
          >
            3
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1C1F1D] mb-1">
          {step === 1 && "Reset your password"}
          {step === 2 && "Enter verification code"}
          {step === 3 && "Create new password"}
          {step === 4 && "Password updated!"}
        </h1>

        <p className="text-sm text-[#6B7280] mb-6">
          {step === 1 &&
            "Enter your email address to receive a secure 6-digit verification code."}
          {step === 2 && (
            <>
              A 6-digit code was generated for{" "}
              <span className="font-semibold text-[#1C1F1D]">{email}</span>.
            </>
          )}
          {step === 3 &&
            "Choose a strong password with at least 8 characters to secure your account."}
          {step === 4 &&
            "Your password has been changed successfully. Redirecting you to sign in..."}
        </p>

        {/* Global Error Banner */}
        {error && (
          <div className="text-sm text-[#B42318] bg-[#FEF3F2] border border-[#FDA29B] rounded-lg px-4 py-3 mb-5 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#D92D20] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">{error}</p>
              {notFound && (
                <div className="mt-2 pt-2 border-t border-[#FDA29B]/60">
                  <Link
                    to="/register"
                    className="text-xs font-semibold text-[#1C4B3C] hover:underline inline-flex items-center gap-1"
                  >
                    Register a new account &rarr;
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: Enter Email */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <Field
              label="Email"
              icon={<Mail className="w-4 h-4 text-[#9CA3AF]" />}
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
                if (notFound) setNotFound(false);
              }}
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 transition-colors text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span>Generating code…</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send reset link</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: 6-Digit OTP Verification */}
        {step === 2 && (
          <form onSubmit={handleVerifySubmit} className="space-y-5">
            {/* Notice if host email transport is not configured */}
            {!emailSent && serverOtp && (
              <div className="bg-[#FEF6EE] border border-[#F9DBAF] rounded-lg p-3 text-xs text-[#B54708]">
                <div className="flex items-start gap-2 mb-1.5">
                  <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-[#92400E]">
                      Live Email Notice (Preview Environment)
                    </span>
                    <p className="text-[#B45309] mt-0.5">
                      No outbound SMTP server credentials are configured in this preview container, so no email reached your external inbox. Here is your generated 6-digit code:
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white px-3 py-2 rounded border border-[#F9DBAF] mt-2">
                  <span className="font-mono text-base font-bold tracking-widest text-[#1C4B3C]">
                    {serverOtp}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const digits = serverOtp.split("");
                      setOtpDigits(digits);
                      triggerOtpVerification(serverOtp);
                    }}
                    className="bg-[#1C4B3C] text-white px-2.5 py-1 rounded text-xs font-semibold hover:bg-[#163D31] transition-colors"
                  >
                    Auto-fill code
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-2">
                Enter 6-digit code
              </label>
              <div className="flex gap-2 justify-between">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    className="w-12 h-13 sm:w-13 sm:h-14 text-center text-xl font-bold font-mono rounded-lg border border-[#D1D5DB] bg-white text-[#1C1F1D] focus:outline-none focus:ring-2 focus:ring-[#1C4B3C] focus:border-transparent transition-all shadow-xs"
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
            </div>

            {/* Countdown and Resend */}
            <div className="flex items-center justify-between text-xs text-[#6B7280]">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Code expires in 10 minutes
              </span>
              {canResend ? (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={submitting}
                  className="text-[#1C4B3C] font-semibold hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Resend code
                </button>
              ) : (
                <span>Resend in {countdown}s</span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || otpDigits.join("").length !== 6}
              className="w-full bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 transition-colors text-white text-sm font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {submitting ? "Verifying code…" : "Verify code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError("");
                setOtpDigits(["", "", "", "", "", ""]);
              }}
              className="w-full text-center text-xs text-[#6B7280] hover:text-[#1C1F1D] py-1"
            >
              Use a different email
            </button>
          </form>
        )}

        {/* STEP 3: Enter New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <Field
              label="New password"
              icon={<Lock className="w-4 h-4 text-[#9CA3AF]" />}
              type={showPassword ? "text" : "password"}
              placeholder="Enter new password (min. 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-[#9CA3AF] hover:text-[#6B7280]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
            />

            <Field
              label="Confirm new password"
              icon={<Lock className="w-4 h-4 text-[#9CA3AF]" />}
              type={showPassword ? "text" : "password"}
              placeholder="Confirm your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-[#9CA3AF] hover:text-[#6B7280]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              }
            />

            <div className="text-xs text-[#6B7280] space-y-1 bg-white p-3 rounded-lg border border-[#E5E7EB]">
              <p className="font-medium text-[#374151]">Password requirements:</p>
              <p className={newPassword.length >= 8 ? "text-[#1C4B3C]" : ""}>
                &bull; Minimum 8 characters {newPassword.length >= 8 && "✓"}
              </p>
              <p
                className={
                  confirmPassword && newPassword === confirmPassword
                    ? "text-[#1C4B3C]"
                    : ""
                }
              >
                &bull; Passwords match{" "}
                {confirmPassword && newPassword === confirmPassword && "✓"}
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1C4B3C] hover:bg-[#163D31] disabled:opacity-60 transition-colors text-white text-sm font-semibold rounded-lg py-2.5"
            >
              {submitting ? "Updating password…" : "Update password"}
            </button>
          </form>
        )}

        {/* STEP 4: Success Confirmation */}
        {step === 4 && (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#EAF2EE] text-[#1C4B3C] flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium text-[#1C1F1D]">
              Password updated successfully!
            </p>
            <p className="text-xs text-[#6B7280]">
              Taking you to the login screen in a moment…
            </p>
            <Link
              to="/login"
              className="inline-block bg-[#1C4B3C] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#163D31] transition-colors"
            >
              Sign in now &rarr;
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-[#6B7280] mt-6">
          <Link to="/login" className="text-[#1C4B3C] font-semibold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
