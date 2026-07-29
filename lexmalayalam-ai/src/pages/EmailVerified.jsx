import {
  FiCheck,
  FiMail,
  FiSmartphone,
  FiInfo,
  FiFileText,
} from "react-icons/fi";
import "./EmailVerified.css";

export default function EmailVerified() {
  const handleReturnToApp = () => {
    alert(
      "Your account has been verified successfully.\n\nPlease return to the Smart Doc AI app and log in using your registered email address and password."
    );
  };

  return (
    <div className="verified-page">
      {/* ---------- Top Bar ---------- */}
      <header className="verified-topbar">
        <div className="verified-brand">
          <FiFileText className="verified-brand-icon" />
          <span className="verified-brand-name">
            Smart Doc <span>AI</span>
          </span>
        </div>

        <div className="verified-secure-badge">
          <FiCheck size={14} />
          Secure &amp; Private
        </div>
      </header>

      {/* ---------- Main Card ---------- */}
      <main className="verified-card">
        <div className="verified-success-icon">
          <span className="verified-spark verified-spark--a">✦</span>
          <span className="verified-spark verified-spark--b">✧</span>
          <span className="verified-spark verified-spark--c">✦</span>

          <div className="verified-check-circle">
            <FiCheck size={44} className="verified-check-mark" />
          </div>
        </div>

        <h1 className="verified-heading">
          Registration Successful!
        </h1>

        <p className="verified-subtitle">
          Your email has been verified successfully.
        </p>

        <div className="verified-divider">
          <span></span>

          <span className="verified-divider-icon">
            <FiCheck size={14} />
          </span>

          <span></span>
        </div>

        <p className="verified-description">
          Thank you for verifying your email address.
          <br />
          Your Smart Doc AI account is now active.
          <br />
          Please return to the Smart Doc AI app and log in using your
          registered email address and password.
        </p>

        {/* ---------- Info Card ---------- */}
        <div className="verified-info-card">
          <span className="verified-info-icon">
            <FiMail size={20} />
          </span>

          <div className="verified-info-text">
            <span className="verified-info-title">
              Email Verified
            </span>

            <span className="verified-info-subtitle">
              Your account is now active and ready to use.
            </span>
          </div>
        </div>

        {/* ---------- Button ---------- */}
        <button
          className="verified-cta-btn"
          onClick={handleReturnToApp}
        >
          <FiSmartphone size={18} />
          Return to App
        </button>

        <p className="verified-close-note">
          <FiInfo size={14} />
          You may now close this page safely.
        </p>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="verified-footer">
        <FiFileText className="verified-footer-icon" />

        <p className="verified-footer-brand">
          Smart Doc <span>AI</span>
        </p>

        <p className="verified-footer-tagline">
          Upload Documents. Get AI-Powered Summaries.
        </p>

        <p className="verified-footer-copy">
          © 2026 Smart Doc AI. All rights reserved.
        </p>
      </footer>
    </div>
  );
}