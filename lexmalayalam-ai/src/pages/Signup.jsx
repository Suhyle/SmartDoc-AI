import React, { useState } from 'react'
import './Signup.css'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const Signup = () => {
  const navigate = useNavigate()

  // =========================================================
  // FORM STATE
  // =========================================================

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Prevent multiple submissions
  const [isLoading, setIsLoading] = useState(false)


  // =========================================================
  // REGISTRATION
  // =========================================================

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Prevent double click / multiple requests
    if (isLoading) {
      return
    }

    // -------------------------------------------------------
    // Validate password
    // -------------------------------------------------------

    if (password !== confirmPassword) {
      alert('Passwords do not match')
      return
    }

    // -------------------------------------------------------
    // Validate terms
    // -------------------------------------------------------

    if (!agreedToTerms) {
      alert(
        'Please agree to the Terms & Privacy Policy before creating your account.'
      )
      return
    }

    // -------------------------------------------------------
    // Basic validation
    // -------------------------------------------------------

    if (!name.trim()) {
      alert('Please enter your full name.')
      return
    }

    if (!email.trim()) {
      alert('Please enter your email address.')
      return
    }

    if (!password) {
      alert('Please enter a password.')
      return
    }

    setIsLoading(true)

    try {
      // -----------------------------------------------------
      // Supabase Registration
      // -----------------------------------------------------

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,

        options: {
          emailRedirectTo:
            'https://smart-doc-ai-two.vercel.app/email-verified',

          data: {
            full_name: name.trim(),
          },
        },
      })

      // -----------------------------------------------------
      // Registration Error
      // -----------------------------------------------------

      if (error) {
        alert(error.message)
        return
      }

      console.log('Registration successful:', data)

      // -----------------------------------------------------
      // IMPORTANT FLOW
      //
      // Old:
      // Signup → Login
      //
      // New:
      // Signup → Select Exam → Login
      // -----------------------------------------------------

      alert(
        'Account created successfully! Check your email to verify your account.'
      )

      navigate('/select-exam')

    } catch (error) {
      console.error('Registration error:', error)

      alert(
        'Something went wrong while creating your account. Please try again.'
      )

    } finally {
      setIsLoading(false)
    }
  }


  // =========================================================
  // GOOGLE SIGNUP
  // =========================================================

  const handleGoogleSignup = () => {
    console.log('Google signup clicked')

    // OAuth functionality can be connected later.
    alert('Google sign-up will be connected soon.')
  }


  // =========================================================
  // MICROSOFT SIGNUP
  // =========================================================

  const handleMicrosoftSignup = () => {
    console.log('Microsoft signup clicked')

    // OAuth functionality can be connected later.
    alert('Microsoft sign-up will be connected soon.')
  }


  // =========================================================
  // LOGIN
  // =========================================================

  const handleLogin = () => {
    navigate('/login')
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="signup-container">

      {/* =====================================================
          BACKGROUND FLOATING DECORATION
      ===================================================== */}

      <div className="floating-shape shape-1"></div>
      <div className="floating-shape shape-2"></div>
      <div className="floating-shape shape-3"></div>

      <div className="sparkle sparkle-1">
        ✨
      </div>

      <div className="sparkle sparkle-2">
        ✦
      </div>

      <div className="sparkle sparkle-3">
        ✨
      </div>


      {/* =====================================================
          MAIN CARD
      ===================================================== */}

      <div className="signup-card">


        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="signup-header">

          <h1 className="signup-title">
            Create Account{' '}
            <span className="title-sparkle">
              ✨
            </span>
          </h1>

          <p className="signup-subtitle">
            Join Smart Doc AI
          </p>

        </div>


        {/* ===================================================
            ROBOT ILLUSTRATION
        =================================================== */}

        <div className="illustration-wrapper">

          <svg
            className="robot-illustration"
            viewBox="0 0 200 160"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >

            {/* Background Soft Glow */}

            <path
              d="M30 80C30 40 60 20 100 20C140 20 170 40 170 80C170 120 140 140 100 140C60 140 30 120 30 80Z"
              fill="url(#glowGradient)"
              opacity="0.6"
            />


            {/* Robot Head */}

            <rect
              x="65"
              y="45"
              width="70"
              height="50"
              rx="18"
              fill="#FFFFFF"
              stroke="#8B5CF6"
              strokeWidth="3"
            />

            <rect
              x="73"
              y="53"
              width="54"
              height="34"
              rx="12"
              fill="#2E1065"
            />


            {/* Robot Eyes */}

            <circle
              cx="88"
              cy="70"
              r="5"
              fill="#A855F7"
            />

            <circle
              cx="112"
              cy="70"
              r="5"
              fill="#A855F7"
            />

            <circle
              cx="89"
              cy="69"
              r="1.5"
              fill="#FFFFFF"
            />

            <circle
              cx="113"
              cy="69"
              r="1.5"
              fill="#FFFFFF"
            />


            {/* Robot Smile */}

            <path
              d="M94 77 Q100 82 106 77"
              stroke="#A855F7"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />


            {/* Ears / Antennas */}

            <rect
              x="57"
              y="62"
              width="8"
              height="16"
              rx="4"
              fill="#8B5CF6"
            />

            <rect
              x="135"
              y="62"
              width="8"
              height="16"
              rx="4"
              fill="#8B5CF6"
            />

            <path
              d="M100 45 V33"
              stroke="#8B5CF6"
              strokeWidth="3"
              strokeLinecap="round"
            />

            <circle
              cx="100"
              cy="30"
              r="4"
              fill="#A855F7"
            />


            {/* Robot Body */}

            <path
              d="M75 100 C75 92 82 88 100 88 C118 88 125 92 125 100 V125 C125 130 118 135 100 135 C82 135 75 130 75 125 Z"
              fill="#FFFFFF"
              stroke="#8B5CF6"
              strokeWidth="3"
            />

            <rect
              x="88"
              y="100"
              width="24"
              height="16"
              rx="6"
              fill="#F3E8FF"
            />


            {/* Document Clipboard */}

            <rect
              x="42"
              y="72"
              width="28"
              height="36"
              rx="5"
              fill="#6D28D9"
              transform="rotate(-12 42 72)"
            />

            <rect
              x="46"
              y="78"
              width="20"
              height="3"
              rx="1.5"
              fill="#E9D5FF"
              transform="rotate(-12 46 78)"
            />

            <rect
              x="46"
              y="84"
              width="16"
              height="3"
              rx="1.5"
              fill="#E9D5FF"
              transform="rotate(-12 46 84)"
            />

            <rect
              x="46"
              y="90"
              width="18"
              height="3"
              rx="1.5"
              fill="#E9D5FF"
              transform="rotate(-12 46 90)"
            />


            {/* Sparkles */}

            <path
              d="M35 45 L37 40 L42 38 L37 36 L35 31 L33 36 L28 38 L33 40 Z"
              fill="#C084FC"
              opacity="0.8"
            />

            <path
              d="M165 65 L166 61 L170 60 L166 59 L165 55 L164 59 L160 60 L164 61 Z"
              fill="#C084FC"
              opacity="0.8"
            />


            {/* Glow Gradient */}

            <defs>

              <linearGradient
                id="glowGradient"
                x1="30"
                y1="20"
                x2="170"
                y2="140"
                gradientUnits="userSpaceOnUse"
              >

                <stop
                  stopColor="#DDD6FE"
                />

                <stop
                  offset="1"
                  stopColor="#F3E8FF"
                  stopOpacity="0.2"
                />

              </linearGradient>

            </defs>

          </svg>

        </div>


        {/* ===================================================
            SIGNUP FORM
        =================================================== */}

        <form
          onSubmit={handleSubmit}
          className="signup-form"
        >


          {/* ===============================================
              FULL NAME
          =============================================== */}

          <div className="input-group">

            <span className="input-icon">

              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >

                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />

                <circle
                  cx="12"
                  cy="7"
                  r="4"
                />

              </svg>

            </span>


            <input
              type="text"
              className="form-input"
              placeholder="Full Name"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              required
            />

          </div>


          {/* ===============================================
              EMAIL
          =============================================== */}

          <div className="input-group">

            <span className="input-icon">

              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >

                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />

                <polyline points="22,6 12,13 2,6" />

              </svg>

            </span>


            <input
              type="email"
              className="form-input"
              placeholder="Email Address"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
            />

          </div>


          {/* ===============================================
              PASSWORD
          =============================================== */}

          <div className="input-group">

            <span className="input-icon">

              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >

                <rect
                  x="3"
                  y="11"
                  width="18"
                  height="11"
                  rx="2"
                  ry="2"
                />

                <path d="M7 11V7a5 5 0 0 1 10 0v4" />

              </svg>

            </span>


            <input
              type={
                showPassword
                  ? 'text'
                  : 'password'
              }
              className="form-input"
              placeholder="Password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
            />


            <button
              type="button"
              className="toggle-password"
              onClick={() =>
                setShowPassword(
                  !showPassword
                )
              }
              aria-label="Toggle password visibility"
            >

              {showPassword ? (

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >

                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />

                  <line
                    x1="1"
                    y1="1"
                    x2="23"
                    y2="23"
                  />

                </svg>

              ) : (

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >

                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />

                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                  />

                </svg>

              )}

            </button>

          </div>


          {/* ===============================================
              CONFIRM PASSWORD
          =============================================== */}

          <div className="input-group">

            <span className="input-icon">

              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >

                <rect
                  x="3"
                  y="11"
                  width="18"
                  height="11"
                  rx="2"
                  ry="2"
                />

                <path d="M7 11V7a5 5 0 0 1 10 0v4" />

              </svg>

            </span>


            <input
              type={
                showConfirmPassword
                  ? 'text'
                  : 'password'
              }
              className="form-input"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(
                  e.target.value
                )
              }
              required
            />


            <button
              type="button"
              className="toggle-password"
              onClick={() =>
                setShowConfirmPassword(
                  !showConfirmPassword
                )
              }
              aria-label="Toggle confirm password visibility"
            >

              {showConfirmPassword ? (

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >

                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />

                  <line
                    x1="1"
                    y1="1"
                    x2="23"
                    y2="23"
                  />

                </svg>

              ) : (

                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >

                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />

                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                  />

                </svg>

              )}

            </button>

          </div>


          {/* ===============================================
              TERMS
          =============================================== */}

          <div className="terms-container">

            <label className="checkbox-label">

              <input
                type="checkbox"
                className="custom-checkbox"
                checked={agreedToTerms}
                onChange={(e) =>
                  setAgreedToTerms(
                    e.target.checked
                  )
                }
              />

              <span className="checkbox-text">

                I agree to the{' '}

                <a
                  href="#"
                  className="purple-link"
                  onClick={(e) =>
                    e.preventDefault()
                  }
                >
                  Terms & Privacy Policy
                </a>

              </span>

            </label>

          </div>


          {/* ===============================================
              CREATE ACCOUNT
          =============================================== */}

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading}
          >

            {isLoading
              ? 'Creating Account...'
              : 'Create Account'}

          </button>

        </form>


        {/* ===================================================
            DIVIDER
        =================================================== */}

        <div className="divider">
          <span>
            or continue with
          </span>
        </div>


        {/* ===================================================
            OAUTH
        =================================================== */}

        <div className="oauth-container">

          {/* Google */}

          <button
            type="button"
            className="oauth-btn"
            onClick={handleGoogleSignup}
          >

            <svg
              className="oauth-icon"
              viewBox="0 0 24 24"
            >

              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />

              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />

              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />

              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />

            </svg>

            Google

          </button>


          {/* Microsoft */}

          <button
            type="button"
            className="oauth-btn"
            onClick={handleMicrosoftSignup}
          >

            <svg
              className="oauth-icon"
              viewBox="0 0 23 23"
            >

              <path
                fill="#f35325"
                d="M1 1h10v10H1z"
              />

              <path
                fill="#81bc06"
                d="M12 1h10v10H12z"
              />

              <path
                fill="#05a6f0"
                d="M1 12h10v10H1z"
              />

              <path
                fill="#ffba08"
                d="M12 12h10v10H12z"
              />

            </svg>

            Microsoft

          </button>

        </div>


        {/* ===================================================
            LOGIN FOOTER
        =================================================== */}

        <div className="signup-footer">

          <p>

            Already have an account?{' '}

            <button
              type="button"
              className="purple-link bold"
              onClick={handleLogin}
            >
              Login
            </button>

          </p>

        </div>

      </div>

    </div>
  )
}

export default Signup