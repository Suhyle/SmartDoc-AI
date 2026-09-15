import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiArrowLeft, FiTarget, FiEye, FiStar, FiPlay, FiFileText, FiList, FiBell, FiBookOpen,
  FiAward, FiDownload, FiMessageCircle, FiLayers, FiShield, FiSmartphone,
  FiCpu, FiInfo, FiHelpCircle, FiChevronRight, FiSettings
} from 'react-icons/fi'
import './About.css'

/* =========================================================
   CONTENT
   Only things confirmed by App.jsx / Profile.jsx or stated by you
   are listed. Nothing here is fetched; the page makes no API calls.
========================================================= */

const features = [
  { icon: <FiPlay size={22} />, tone: 'rose', title: 'YouTube Transcripts', desc: 'Turn YouTube videos into transcripts and summaries on the Transcript & Summary page.' },
  { icon: <FiFileText size={22} />, tone: 'blue', title: 'Documents & Web Links', desc: 'Upload a PDF or add a website link, then view them under My Documents.' },
  { icon: <FiList size={22} />, tone: 'green', title: 'Study Plan', desc: 'Set up a study plan and follow your progress.' },
  { icon: <FiBell size={22} />, tone: 'amber', title: 'Exam Notifications', desc: 'See exam notifications that match your qualification and selected exams.' },
  { icon: <FiBookOpen size={22} />, tone: 'purple', title: 'Quiz & Practice', desc: 'Practise with quizzes and mock tests.' },
  { icon: <FiAward size={22} />, tone: 'rose', title: 'Recommended Videos', desc: 'Get video suggestions on Home based on your exams and study topics.' }, // VERIFY against Home.jsx
  { icon: <FiDownload size={22} />, tone: 'blue', title: 'Downloads', desc: 'Find your PDFs and downloaded documents in one library.' },
  { icon: <FiMessageCircle size={22} />, tone: 'indigo', title: 'AI Chat', desc: 'Ask questions in the built-in chat.' } // VERIFY against Chat.jsx
]

const workflowSteps = [
  { title: 'Register & Set Up', desc: 'Create your account, choose your exams and add your qualification details.', tone: 'purple' },
  { title: 'Add Content', desc: 'Add a YouTube link, upload a PDF or add a website link.', tone: 'blue' },
  { title: 'Read & Learn', desc: 'Open transcripts and summaries, and find your files in Documents and Downloads.', tone: 'green' },
  { title: 'Plan & Practice', desc: 'Follow a study plan and practise with quizzes.', tone: 'amber' },
  { title: 'Stay Updated', desc: 'Check exam notifications for the exams you selected.', tone: 'indigo' }
]

const reasons = [
  { icon: <FiLayers size={22} />, tone: 'blue', title: 'All in One App', desc: 'Transcripts, documents, study plans, quizzes and notifications live together.' },
  { icon: <FiFileText size={22} />, tone: 'purple', title: 'Transcripts & Summaries', desc: 'Get the key points from videos and documents faster.' },
  { icon: <FiShield size={22} />, tone: 'green', title: 'Built Around Your Exams', desc: 'Notifications and suggestions follow the exams you choose.' },
  { icon: <FiSmartphone size={22} />, tone: 'rose', title: 'Web & Android', desc: 'Use SmartDoc AI in the browser or on Android.' }
]

/* Confirmed from the attached code: React + react-router-dom + react-icons, Vite
   (import.meta.env in supabase.js), Supabase (supabase.js). Capacitor is taken from
   your description. Add Gemini / Groq / Cerebras / YouTube API / PDF libraries here
   ONLY after confirming them in your backend code or package.json. */
const technologies = [
  { name: 'React' },
  { name: 'Vite' },
  { name: 'Supabase' },
  { name: 'Capacitor (Android)' }
]

/* Developer and last-updated date are not in the project files, so they are not shown. */
const appInfo = [
  ['App Name', 'SmartDoc AI'],
  ['Version', '1.0.0'],
  ['Platform', 'Web / Android (Capacitor)']
]

/* route: null = page does not exist yet in App.jsx, so the card is disabled. */
const footerLinks = [
  { title: 'Terms of Service', desc: 'Read terms & conditions', route: '/terms', icon: <FiFileText size={20} /> },
  { title: 'Privacy Policy', desc: 'View privacy & security details', route: '/privacy', icon: <FiShield size={20} /> },
  { title: 'Help & Support', desc: 'Find answers to your questions', route: '/help', icon: <FiHelpCircle size={20} /> },
  { title: 'Send Feedback', desc: 'Help us improve SmartDoc AI', route: '/feedback', icon: <FiMessageCircle size={20} /> }
]

export default function About() {
  const navigate = useNavigate()

  return (
    <div className="sd-ab-page">
      <div className="sd-ab-container">

        <header className="sd-ab-header">
          <button type="button" className="sd-ab-back" aria-label="Back to profile" onClick={() => navigate('/profile')}>
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1>About SmartDoc AI</h1>
            <p>Learn more about our app, mission and features.</p>
          </div>
        </header>

        {/* HERO */}
        <section className="sd-ab-hero">
          <div className="sd-ab-hero-body">
            <span className="sd-ab-pill">Smart Learning for a Brighter Future</span>
            <h2>SmartDoc AI</h2>
            <h3>Your AI-Powered Study Companion</h3>
            <p>
              SmartDoc AI helps you prepare for competitive exams. Turn YouTube videos and documents into
              transcripts and summaries, follow a study plan, practise with quizzes and keep track of exam
              notifications, all in one app.
            </p>
          </div>
          <div className="sd-ab-hero-art" aria-hidden="true">
            <span className="sd-ab-art-main"><FiCpu size={64} /></span>
            <span className="sd-ab-art-chip c1"><FiPlay size={22} /></span>
            <span className="sd-ab-art-chip c2"><FiFileText size={22} /></span>
            <span className="sd-ab-art-chip c3"><FiBookOpen size={22} /></span>
          </div>
        </section>

        {/* MISSION + VISION */}
        <div className="sd-ab-two">
          <section className="sd-ab-card sd-ab-mv">
            <span className="sd-ab-icon indigo"><FiTarget size={24} /></span>
            <div>
              <h3>Our Mission</h3>
              <p>To help students and exam aspirants study more efficiently by bringing transcripts, summaries, study plans, quizzes and exam notifications into one app.</p>
            </div>
          </section>
          <section className="sd-ab-card sd-ab-mv">
            <span className="sd-ab-icon purple"><FiEye size={24} /></span>
            <div>
              <h3>Our Vision</h3>
              <p>A simple, focused study companion that makes competitive exam preparation less overwhelming.</p>
            </div>
          </section>
        </div>

        {/* FEATURES */}
        <section className="sd-ab-card" aria-labelledby="sd-ab-feat">
          <h3 id="sd-ab-feat" className="sd-ab-title"><span className="sd-ab-icon indigo"><FiStar size={20} /></span> Key Features</h3>
          <p className="sd-ab-sub">Everything you need for your learning and exam preparation in one place.</p>
          <ul className="sd-ab-grid4">
            {features.map((f) => (
              <li key={f.title} className={`sd-ab-tile ${f.tone}`}>
                <span className="sd-ab-tile-icon">{f.icon}</span>
                <div><h4>{f.title}</h4><p>{f.desc}</p></div>
              </li>
            ))}
          </ul>
        </section>

        {/* HOW IT WORKS */}
        <section className="sd-ab-card" aria-labelledby="sd-ab-how">
          <h3 id="sd-ab-how" className="sd-ab-title"><span className="sd-ab-icon indigo"><FiSettings size={20} /></span> How It Works</h3>
          <p className="sd-ab-sub">A simple process to help you learn and prepare better.</p>
          <ol className="sd-ab-steps">
            {workflowSteps.map((s, i) => (
              <li key={s.title}>
                <span className={`sd-ab-num ${s.tone}`}>{i + 1}</span>
                <h4>{s.title}</h4>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* WHY */}
        <section className="sd-ab-card" aria-labelledby="sd-ab-why">
          <h3 id="sd-ab-why" className="sd-ab-title"><span className="sd-ab-icon indigo"><FiAward size={20} /></span> Why Choose SmartDoc AI?</h3>
          <p className="sd-ab-sub">Designed for students and exam aspirants.</p>
          <ul className="sd-ab-grid4">
            {reasons.map((r) => (
              <li key={r.title} className={`sd-ab-tile ${r.tone}`}>
                <span className="sd-ab-tile-icon">{r.icon}</span>
                <div><h4>{r.title}</h4><p>{r.desc}</p></div>
              </li>
            ))}
          </ul>
        </section>

        {/* TECH + APP INFO */}
        <div className="sd-ab-two sd-ab-two-uneven">
          <section className="sd-ab-card" aria-labelledby="sd-ab-tech">
            <h3 id="sd-ab-tech" className="sd-ab-title"><span className="sd-ab-icon indigo"><FiCpu size={20} /></span> Technology</h3>
            <p className="sd-ab-sub">Built using these technologies.</p>
            <ul className="sd-ab-badges">
              {technologies.map((t) => <li key={t.name}>{t.name}</li>)}
            </ul>
          </section>
          <section className="sd-ab-card" aria-labelledby="sd-ab-info">
            <h3 id="sd-ab-info" className="sd-ab-title"><span className="sd-ab-icon indigo"><FiInfo size={20} /></span> App Information</h3>
            <dl className="sd-ab-info">
              {appInfo.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
            </dl>
          </section>
        </div>

        {/* FOOTER LINKS */}
        <nav className="sd-ab-footer" aria-label="Related pages">
          {footerLinks.map((l) => (
            <button
              key={l.title}
              type="button"
              className="sd-ab-link"
              disabled={!l.route}
              onClick={() => l.route && navigate(l.route)}
            >
              <span className="sd-ab-link-icon">{l.icon}</span>
              <span className="sd-ab-link-text"><strong>{l.title}</strong><span>{l.desc}</span></span>
              {l.route && <FiChevronRight size={18} aria-hidden="true" />}
            </button>
          ))}
        </nav>

      </div>
    </div>
  )
}