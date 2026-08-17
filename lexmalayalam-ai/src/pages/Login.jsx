import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "./Login.css";

// =========================================================
// LOGIN PAGE
// =========================================================

export default function Login() {
  const navigate = useNavigate();

  // =======================================================
  // STATE
  // =======================================================

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // =======================================================
  // LOGIN
  // =======================================================

  const handleLogin = async (e) => {
    e.preventDefault();

    // Prevent double click
    if (isLoading) return;

    setIsLoading(true);

    try {
      // ===================================================
      // 1. LOGIN WITH SUPABASE
      // ===================================================

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

      // ===================================================
      // LOGIN ERROR
      // ===================================================

      if (error) {
        console.error("Login failed:", error);
        alert(error.message);
        return;
      }

      console.log("Login successful:", data);

      // ===================================================
      // 2. GET TEMPORARY SELECTED EXAMS
      // ===================================================
      //
      // SelectExam.jsx stores the selected exams temporarily
      // using:
      //
      // smartdoc_selected_exams
      //
      // Example:
      //
      // ["PSC", "UPSC"]
      //
      // This is only temporary storage.
      //
      // The permanent copy is saved in Supabase user metadata.
      // ===================================================

      const storedExams = localStorage.getItem(
        "smartdoc_selected_exams"
      );

      // ===================================================
      // 3. SAVE SELECTED EXAMS TO SUPABASE
      // ===================================================

      if (storedExams) {
        try {
          const selectedExams = JSON.parse(storedExams);

          console.log(
            "Selected exams received at Login:",
            selectedExams
          );

          // Make sure the data is a valid non-empty array
          if (
            Array.isArray(selectedExams) &&
            selectedExams.length > 0
          ) {
            // =================================================
            // SAVE TO SUPABASE USER METADATA
            // =================================================

            const {
              data: updatedUser,
              error: updateError,
            } = await supabase.auth.updateUser({
              data: {
                selected_exams: selectedExams,
              },
            });

            // =================================================
            // SUPABASE UPDATE ERROR
            // =================================================

            if (updateError) {
              console.error(
                "Failed to save selected exams:",
                updateError
              );

              /*
               * Login itself was successful.
               *
               * Therefore we do not block the user from
               * entering the application.
               */
              console.warn(
                "Login successful, but selected exams were not saved."
              );
            } else {
              console.log(
                "Selected exams saved successfully:",
                updatedUser?.user?.user_metadata?.selected_exams
              );

              // =================================================
              // REMOVE TEMPORARY STORAGE
              // =================================================

              localStorage.removeItem(
                "smartdoc_selected_exams"
              );
            }
          } else {
            console.warn(
              "Selected exam data is empty or invalid."
            );
          }
        } catch (parseError) {
          console.error(
            "Invalid selected exam data:",
            parseError
          );
        }
      } else {
        console.log(
          "No temporary selected exam data found."
        );
      }

      // ===================================================
      // 4. GO TO HOME
      // ===================================================

      navigate("/home");
    } catch (error) {
      // =====================================================
      // LOGIN EXCEPTION
      // =====================================================

      console.error("Login error:", error);

      alert(
        "Something went wrong. Please try again."
      );
    } finally {
      // =====================================================
      // STOP LOADING
      // =====================================================

      setIsLoading(false);
    }
  };

  // =========================================================
  // FORGOT PASSWORD
  // =========================================================

  const handleForgotPassword = () => {
    console.log("Forgot password clicked");

    /*
     * Password reset can be connected later.
     *
     * No device-specific API is used here.
     *
     * Compatible with:
     * - Computer browser
     * - Vercel
     * - Mobile browser
     * - Android APK
     */
  };

  // =========================================================
  // GOOGLE LOGIN
  // =========================================================

  const handleGoogleLogin = async () => {
    console.log("Google login clicked");

    /*
     * Google authentication can be connected later
     * using Supabase OAuth.
     *
     * Supabase OAuth keeps authentication compatible with:
     * - Web
     * - Vercel
     * - Mobile browser
     * - Android APK
     */
  };

  // =========================================================
  // MICROSOFT LOGIN
  // =========================================================

  const handleMicrosoftLogin = async () => {
    console.log("Microsoft login clicked");

    /*
     * Microsoft authentication can be connected later
     * using Supabase OAuth.
     */
  };

  // =========================================================
  // SIGN UP
  // =========================================================

  const handleSignUp = () => {
    navigate("/signup");
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="login-page">

      {/* =================================================
          DECORATIVE BACKGROUND
      ================================================= */}

      <div className="bg-shape bg-shape--one" />
      <div className="bg-shape bg-shape--two" />
      <div className="bg-shape bg-shape--three" />

      <span className="sparkle sparkle--a">
        ✦
      </span>

      <span className="sparkle sparkle--b">
        ✧
      </span>

      <span className="sparkle sparkle--c">
        ✦
      </span>

      <span className="sparkle sparkle--d">
        ✧
      </span>

      <span className="sparkle sparkle--e">
        ✦
      </span>

      {/* =================================================
          LOGIN CARD
      ================================================= */}

      <div className="login-card">

        {/* =================================================
            WELCOME HEADER
        ================================================= */}

        <header className="login-header">

          <h1 className="login-title">
            Welcome Back

            <span className="wave-emoji">
              👋
            </span>
          </h1>

          <p className="login-subtitle">
            Login to continue
          </p>

        </header>

        {/* =================================================
            SMARTDOC AI BRAND
        ================================================= */}

        <div className="brand-block">

          <div className="brand-icon-wrap">

            {/* CC BADGE */}

            <span
              className="brand-badge brand-badge--cc"
              aria-hidden="true"
            >
              CC
            </span>

            {/* MICROPHONE BADGE */}

            <span
              className="brand-badge brand-badge--mic"
              aria-hidden="true"
            >

              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6C4CF1"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >

                <rect
                  x="9"
                  y="2"
                  width="6"
                  height="12"
                  rx="3"
                />

                <path d="M5 10a7 7 0 0 0 14 0" />

                <path d="M12 19v3" />

              </svg>

            </span>

            {/* MAIN SMARTDOC ICON */}

            <div className="brand-icon">

              <span
                className="brand-icon-sparkle brand-icon-sparkle--top"
                aria-hidden="true"
              >
                ✦
              </span>

              <span
                className="brand-icon-sparkle brand-icon-sparkle--left"
                aria-hidden="true"
              >
                ✦
              </span>

              <div className="brand-doc-card">

                <div className="brand-doc-fold" />

                <div className="brand-doc-play">
                  <div className="brand-doc-play-triangle" />
                </div>

                <span className="brand-doc-line brand-doc-line--1" />
                <span className="brand-doc-line brand-doc-line--2" />

              </div>

            </div>

          </div>

          {/* BRAND NAME */}

          <h2 className="brand-title">

            <span className="brand-title-main">
              SmartDoc
            </span>{" "}

            <span className="brand-title-accent">
              AI
            </span>

          </h2>

          <p className="brand-subtitle">
            AI-Powered Exam Learning Assistant
          </p>

        </div>

        {/* =================================================
            LOGIN FORM
        ================================================= */}

        <form
          className="login-form"
          onSubmit={handleLogin}
        >

          {/* EMAIL */}

          <label className="input-field">

            <span
              className="input-icon"
              aria-hidden="true"
            >

              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
              >

                <path
                  d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />

                <path
                  d="M4 7l7.4 5.4a1 1 0 0 0 1.2 0L20 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />

              </svg>

            </span>

            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="username"
              required
            />

          </label>

          {/* PASSWORD */}

          <label className="input-field">

            <span
              className="input-icon"
              aria-hidden="true"
            >

              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
              >

                <rect
                  x="5"
                  y="10.5"
                  width="14"
                  height="9.5"
                  rx="2.2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />

                <path
                  d="M8 10.5V8a4 4 0 0 1 8 0v2.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />

              </svg>

            </span>

            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete="current-password"
              required
            />

            {/* SHOW / HIDE PASSWORD */}

            <button
              type="button"
              className="toggle-password"
              onClick={() =>
                setShowPassword(
                  (prev) => !prev
                )
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >

              {showPassword ? (

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                >

                  <path
                    d="M3 3l18 18"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />

                  <path
                    d="M10.6 5.2A10.6 10.6 0 0 1 12 5c6 0 9.5 5.5 9.5 7 0 .7-.86 2.2-2.4 3.66M6.7 6.7C4.4 8.2 2.5 10.6 2.5 12c0 1.5 3.5 7 9.5 7 1.3 0 2.5-.26 3.6-.7"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />

                  <path
                    d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />

                </svg>

              ) : (

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                >

                  <path
                    d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />

                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />

                </svg>

              )}

            </button>

          </label>

          {/* FORGOT PASSWORD */}

          <div className="forgot-row">

            <button
              type="button"
              className="forgot-link"
              onClick={handleForgotPassword}
            >
              Forgot Password?
            </button>

          </div>

          {/* LOGIN BUTTON */}

          <button
            type="submit"
            className="login-btn"
            disabled={isLoading}
          >

            {isLoading ? (
              <>
                <span className="login-spinner" />
                Logging in...
              </>
            ) : (
              <>
                Login
                <span aria-hidden="true">
                  →
                </span>
              </>
            )}

          </button>

        </form>

        {/* =================================================
            DIVIDER
        ================================================= */}

        <div className="divider">

          <span />

          <p>
            or continue with
          </p>

          <span />

        </div>

        {/* =================================================
            SOCIAL LOGIN
        ================================================= */}

        <div className="social-buttons">

          {/* GOOGLE */}

          <button
            type="button"
            className="social-btn"
            onClick={handleGoogleLogin}
          >

            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
            >

              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"
              />

              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
              />

              <path
                fill="#FBBC05"
                d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
              />

              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
              />

            </svg>

            Google

          </button>

          {/* MICROSOFT */}

          <button
            type="button"
            className="social-btn"
            onClick={handleMicrosoftLogin}
          >

            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
            >

              <rect
                x="0"
                y="0"
                width="8.5"
                height="8.5"
                fill="#F35325"
              />

              <rect
                x="9.5"
                y="0"
                width="8.5"
                height="8.5"
                fill="#81BC06"
              />

              <rect
                x="0"
                y="9.5"
                width="8.5"
                height="8.5"
                fill="#05A6F0"
              />

              <rect
                x="9.5"
                y="9.5"
                width="8.5"
                height="8.5"
                fill="#FFBA08"
              />

            </svg>

            Microsoft

          </button>

        </div>

        {/* =================================================
            SIGN UP
        ================================================= */}

        <p className="signup-text">

          Don&apos;t have an account?{" "}

          <button
            type="button"
            className="signup-link"
            onClick={handleSignUp}
          >
            Sign Up
          </button>

        </p>

      </div>

    </div>
  );
}