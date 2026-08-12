import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Splash.css";

export default function Splash({
  duration = 2000,
  hideNavigation = false,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (hideNavigation) return;

    const timer = setTimeout(() => {
      navigate("/login");
    }, duration);

    return () => clearTimeout(timer);
  }, [navigate, duration, hideNavigation]);

  return (
    <div className="splash">
      {/* Background stars */}
      <span className="splash-star splash-star--a">✦</span>
      <span className="splash-star splash-star--b">✧</span>
      <span className="splash-star splash-star--c">✦</span>
      <span className="splash-star splash-star--d">✧</span>
      <span className="splash-star splash-star--e">✦</span>

      <div className="splash-content">
        {/* Main Hero Section with Badges and Logo */}
        <div className="splash-hero">
          <span className="hero-badge hero-badge--cc" aria-hidden="true">
            CC
          </span>
          <span className="hero-badge hero-badge--mic" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6C4CF1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <path d="M12 19v3" />
            </svg>
          </span>
          <span className="hero-badge hero-badge--doc" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6C4CF1"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
              <path d="M14 3v5h5" />
              <path d="M9 13h6" />
              <path d="M9 17h6" />
            </svg>
          </span>

          {/* CSS App Logo */}
          <div className="splash-logo">
            <span
              className="splash-logo-sparkle splash-logo-sparkle--top"
              aria-hidden="true"
            >
              ✦
            </span>
            <span
              className="splash-logo-sparkle splash-logo-sparkle--left"
              aria-hidden="true"
            >
              ✦
            </span>

            <div className="splash-doc-card">
              <div className="splash-doc-fold" />
              <div className="splash-doc-play">
                <div className="splash-doc-play-triangle" />
              </div>
              <span className="splash-doc-line splash-doc-line--1" />
              <span className="splash-doc-line splash-doc-line--2" />
            </div>
          </div>
        </div>

        <h1 className="splash-title">
          <span className="splash-title-main">SmartDoc</span>{" "}
          <span className="splash-title-accent">AI</span>
        </h1>

        <p className="splash-subtitle">
          AI-Powered Competitive Exam
          <br />
          <span>Video &amp; Transcript Assistant</span>
        </p>

        <div className="splash-divider">
          <span></span>
          <em>✦</em>
          <span></span>
        </div>

        <p className="splash-tagline">
          Summarize YouTube videos or your own lectures.
          <br />
          Understand more. Remember better. Score higher.
        </p>

        {/* Workflow Diagram */}
        <div className="splash-flow">
          <div className="flow-card">
            <div className="flow-card-head">
              <span className="flow-yt-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span>YouTube Video</span>
            </div>
            <div className="flow-card-body flow-card-body--video">
              <span className="flow-play-icon" aria-hidden="true"></span>
              <div className="flow-timeline">
                <span className="flow-timeline-fill"></span>
                <span className="flow-timeline-dot"></span>
              </div>
            </div>
          </div>

          <span className="flow-arrow" aria-hidden="true">
            ‑ ‑&gt;
          </span>

          <div className="flow-card">
            <div className="flow-card-head">
              <span className="flow-cc-icon" aria-hidden="true">
                CC
              </span>
              <span>Transcript</span>
            </div>
            <div className="flow-card-body flow-card-body--transcript">
              <span className="flow-line flow-line--1"></span>
              <span className="flow-line flow-line--2"></span>
              <span className="flow-line flow-line--3"></span>
              <span className="flow-line flow-line--4"></span>
              <span className="flow-ai-badge">AI</span>
            </div>
          </div>

          <span className="flow-arrow" aria-hidden="true">
            ‑ ‑&gt;
          </span>

          <div className="flow-card flow-card--summary">
            <div className="flow-card-head flow-card-head--summary">
              Smart Summary
            </div>
            <ul className="flow-summary-list">
              <li>
                <span className="flow-dot flow-dot--star">
                  <svg viewBox="0 0 24 24" fill="#6C4CF1">
                    <path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7-6.2-3.4L5.8 21.2 7 14.2l-5-4.9 7.1-.7z" />
                  </svg>
                </span>
                Key Points
              </li>
              <li>
                <span className="flow-dot">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M4 6h16" />
                    <path d="M4 12h16" />
                    <path d="M4 18h16" />
                  </svg>
                </span>
                Detailed Summary
              </li>
              <li>
                <span className="flow-dot">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                    <path d="M8 9h8" />
                    <path d="M8 13h8" />
                    <path d="M8 17h4" />
                  </svg>
                </span>
                Important Notes
              </li>
              <li>
                <span className="flow-dot flow-dot--check">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#6C4CF1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                Study Ready
              </li>
            </ul>
          </div>
        </div>

        {/* Feature Strip */}
        <div className="splash-features">
          <div className="feature-item">
            <span
              className="feature-icon feature-icon--red"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="#ef4444">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span>
              YouTube
              <br />
              Transcript
            </span>
          </div>

          <div className="feature-item">
            <span
              className="feature-icon feature-icon--blue"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#2563eb"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 16V4" />
                <path d="M6 10l6-6 6 6" />
                <path d="M4 20h16" />
              </svg>
            </span>
            <span>
              Upload Video
              <br />
              (Lectures)
            </span>
          </div>

          <div className="feature-item">
            <span
              className="feature-icon feature-icon--amber"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d97706"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                <path d="M14 3v5h5" />
                <path d="M9 13h6" />
                <path d="M9 17h6" />
              </svg>
            </span>
            <span>
              AI Summary
              <br />
              &amp; Notes
            </span>
          </div>

          <div className="feature-item">
            <span
              className="feature-icon feature-icon--pink"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" fill="#db2777">
                <path d="M6 3a1 1 0 0 0-1 1v17l7-4 7 4V4a1 1 0 0 0-1-1H6z" />
              </svg>
            </span>
            <span>
              Save &amp; Study
              <br />
              Anywhere
            </span>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="splash-progress" aria-hidden="true">
          <span className="progress-dot progress-dot--active"></span>
          <span className="progress-dot"></span>
          <span className="progress-dot"></span>
        </div>

        <p className="splash-footer">
          Smart Video. Smart Transcript. Smart Learning.
        </p>
      </div>
    </div>
  );
}