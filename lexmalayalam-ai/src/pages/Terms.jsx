import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiArrowLeft, FiCheckCircle, FiCalendar, FiCheckSquare, FiFileText, FiUser, FiFile, FiCpu,
  FiBell, FiShare2, FiClock, FiAlertTriangle, FiRefreshCw, FiMessageCircle, FiShield,
  FiHelpCircle, FiInfo, FiChevronRight, FiLink
} from 'react-icons/fi'
import './Terms.css'

/* Set this to a real version/date once the terms are formally published. */
const LAST_UPDATED = 'To be published'

/* Each paragraph is a string. Sections 1-10 are plain text; section 11 has action buttons. */
const sections = [
  {
    icon: <FiCheckSquare size={26} />, tone: 'blue', title: 'Acceptance of Terms',
    body: ['By accessing or using SmartDoc AI, you agree to follow these Terms & Conditions. If you do not agree with any part of them, please do not use the application.']
  },
  {
    icon: <FiFileText size={26} />, tone: 'purple', title: 'Use of SmartDoc AI',
    body: [
      'SmartDoc AI is intended to help with learning and exam preparation.',
      'Please provide accurate information when it is asked for, use the app responsibly, and do not misuse it or try to disrupt the service.'
    ]
  },
  {
    icon: <FiUser size={26} />, tone: 'green', title: 'User Account',
    body: [
      'You may need an account to use certain features. Accounts are created and signed in through the app.',
      'You are responsible for giving accurate account information, keeping your sign-in details secure, and not sharing your account access in an unsafe way.'
    ]
  },
  {
    icon: <FiFile size={26} />, tone: 'rose', title: 'Documents and User Content',
    body: [
      'You may provide content such as documents, YouTube or video links, and study-related information. SmartDoc AI may process this content to provide the features you ask for, such as transcripts and summaries.',
      'Please only add content that you are allowed to use.'
    ]
  },
  {
    icon: <FiCpu size={26} />, tone: 'indigo', title: 'AI-Generated Content',
    body: [
      'Some features use AI to create summaries, transcripts, study help and other learning content. AI-generated information may not always be accurate or complete.',
      'Please check important information with reliable, official sources, especially for government exams, eligibility, exam dates, application deadlines and official notifications.',
      'SmartDoc AI is a study-assistance tool. It is not an official authority.'
    ]
  },
  {
    icon: <FiBell size={26} />, tone: 'amber', title: 'Exam and Notification Information',
    body: [
      'SmartDoc AI may show exam-related information and notifications to help you discover opportunities. Always confirm official details with the relevant organization or its official website.',
      'SmartDoc AI is not affiliated with Kerala PSC, SSC, UPSC, Railway, Banking organizations, RBI or any other government body.'
    ]
  },
  {
    icon: <FiShare2 size={26} />, tone: 'purple', title: 'Third-Party Services',
    body: [
      'SmartDoc AI relies on external services to provide some features, such as account sign-in (Supabase), video content and AI processing. These services have their own terms and policies, and your use of them is subject to those terms.'
    ]
  },
  {
    icon: <FiClock size={26} />, tone: 'blue', title: 'Service Availability',
    body: ['Some features may occasionally be unavailable, changed, updated or interrupted. We do not promise that the app will always be available.']
  },
  {
    icon: <FiAlertTriangle size={26} />, tone: 'rose', title: 'Disclaimer',
    body: [
      'SmartDoc AI is an educational assistance tool. We do not guarantee that AI-generated content or exam information is accurate, complete or up to date.',
      'Please verify official notifications, eligibility, dates, vacancies, application procedures and syllabus information yourself before making decisions.'
    ]
  },
  {
    icon: <FiRefreshCw size={26} />, tone: 'green', title: 'Changes to These Terms',
    body: ['These terms may be updated when the app, its services or its policies change. The latest version and date will be shown on this page once the terms are formally updated.']
  }
]

const related = [
  { title: 'Privacy & Security', desc: 'How your information is used', route: '/privacy', icon: <FiShield size={20} /> },
  { title: 'Help & Support', desc: 'Find answers to your questions', route: '/help', icon: <FiHelpCircle size={20} /> },
  { title: 'Send Feedback', desc: 'Share your suggestions', route: '/feedback', icon: <FiMessageCircle size={20} /> },
  { title: 'About SmartDoc AI', desc: 'Learn more about the app', route: '/about', icon: <FiInfo size={20} /> }
]

export default function TermsConditions() {
  const navigate = useNavigate()

  return (
    <div className="sd-tc-page">
      <div className="sd-tc-container">

        <header className="sd-tc-header">
          <button type="button" className="sd-tc-back" aria-label="Back to profile" onClick={() => navigate('/profile')}>
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1>Terms &amp; Conditions</h1>
            <p>Please review the terms that apply when using SmartDoc AI.</p>
          </div>
        </header>

        <section className="sd-tc-hero">
          <div className="sd-tc-hero-body">
            <span className="sd-tc-pill"><FiCheckCircle size={14} /> Important Information</span>
            <h2>Terms &amp; Conditions</h2>
            <p>
              These terms explain the rules for using SmartDoc AI. By using the application, you agree to follow
              them. They are written for this application and may be updated before they are formally published.
            </p>
            <span className="sd-tc-updated"><FiCalendar size={16} /> Last Updated: {LAST_UPDATED}</span>
          </div>
          <span className="sd-tc-hero-art" aria-hidden="true"><FiFileText size={64} /></span>
        </section>

        <div className="sd-tc-grid">
          {sections.map((s, i) => (
            <article key={s.title} className="sd-tc-card">
              <span className={`sd-tc-icon ${s.tone}`}>{s.icon}</span>
              <div className="sd-tc-text">
                <h3><span className="sd-tc-num">{i + 1}</span> {s.title}</h3>
                {s.body.map((p) => <p key={p}>{p}</p>)}
              </div>
            </article>
          ))}
        </div>

        <article className="sd-tc-card sd-tc-wide">
          <span className="sd-tc-icon blue"><FiMessageCircle size={26} /></span>
          <div className="sd-tc-text">
            <h3><span className="sd-tc-num">11</span> Questions or Support</h3>
            <p>If you have questions about these terms or need support, use the Help &amp; Support or Send Feedback options in the app.</p>
            <div className="sd-tc-actions">
              <button type="button" onClick={() => navigate('/help')}>Help &amp; Support <FiChevronRight size={16} /></button>
              <button type="button" onClick={() => navigate('/feedback')}>Send Feedback <FiChevronRight size={16} /></button>
            </div>
          </div>
        </article>

        <nav className="sd-tc-related" aria-labelledby="sd-tc-related-title">
          <div className="sd-tc-related-head">
            <span className="sd-tc-icon indigo small"><FiLink size={18} /></span>
            <div>
              <h3 id="sd-tc-related-title">Related</h3>
              <p>Explore more information and support options.</p>
            </div>
          </div>
          <ul>
            {related.map((r) => (
              <li key={r.title}>
                <button type="button" className="sd-tc-link" onClick={() => navigate(r.route)}>
                  <span className="sd-tc-link-icon">{r.icon}</span>
                  <span className="sd-tc-link-text"><strong>{r.title}</strong><span>{r.desc}</span></span>
                  <FiChevronRight size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </nav>

      </div>
    </div>
  )
}