import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  FiArrowLeft, FiShield, FiLock, FiMail, FiKey, FiUser, FiAward, FiList, FiBookOpen,
  FiFileText, FiDownload, FiCpu, FiDatabase, FiCloud, FiPlay, FiChevronRight,
  FiCheckCircle, FiAlertCircle, FiFolder, FiUsers
} from 'react-icons/fi'
import './Privacy.css'

const yourInformation = [
  { icon: <FiUser size={18} />, tone: 'purple', title: 'Personal Information', desc: 'Your name and email address for your account.', route: '/profile/edit' },
  { icon: <FiAward size={18} />, tone: 'green', title: 'Qualification Information', desc: 'Qualification details you enter in the app.' },
  { icon: <FiList size={18} />, tone: 'rose', title: 'Selected Exams', desc: 'The exams you choose to follow.' },
  { icon: <FiBookOpen size={18} />, tone: 'blue', title: 'Study Data', desc: 'Your study plan and related study activity.', route: '/study-plan' }
]

const studyData = [
  { icon: <FiFileText size={18} />, tone: 'rose', title: 'Uploaded Documents', desc: 'PDFs and website links you add to the app.', route: '/documents' },
  { icon: <FiFileText size={18} />, tone: 'purple', title: 'Transcripts & Summaries', desc: 'Transcripts and summaries created from videos or documents.', route: '/transcript-summary' },
  { icon: <FiDownload size={18} />, tone: 'green', title: 'Downloads', desc: 'Files you download from the app.', route: '/downloads' }
]

const storageServices = [
  { icon: <FiCloud size={18} />, tone: 'blue', title: 'Supabase (Account Storage)', desc: 'Your sign-in and account information are handled securely through Supabase.' }
]

const thirdParty = [
  { icon: <FiDatabase size={18} />, tone: 'green', title: 'Supabase Auth', desc: 'Used for account sign-in and authentication data.' },
  { icon: <FiPlay size={18} />, tone: 'rose', title: 'YouTube API', desc: 'Used when you add a YouTube video link to generate a transcript.' },
  { icon: <FiCpu size={18} />, tone: 'blue', title: 'AI Services', desc: 'Used to generate transcripts, summaries, and learning content.' }
]

const policyLinks = [
  { title: 'Privacy Policy', desc: 'View privacy and security details', route: '/privacy', icon: <FiShield size={18} /> },
  { title: 'Terms & Conditions', desc: 'Read terms and conditions', route: '/terms', icon: <FiFileText size={18} /> }
]

function Row({ item, onOpen }) {
  const isClickable = Boolean(item.route)
  const content = (
    <>
      <div className="sd-pv-row-left">
        <span className={`sd-pv-ricon ${item.tone}`}>{item.icon}</span>
        <div className="sd-pv-rtext">
          <strong>{item.title}</strong>
          <span>{item.desc}</span>
        </div>
      </div>
      {isClickable && (
        <span className="sd-pv-arrow">
          <FiChevronRight size={18} />
        </span>
      )}
    </>
  )

  return (
    <li className="sd-pv-item">
      {isClickable ? (
        <button type="button" className="sd-pv-row-btn" onClick={() => onOpen(item.route)}>
          {content}
        </button>
      ) : (
        <div className="sd-pv-row-static">
          {content}
        </div>
      )}
    </li>
  )
}

export default function Privacy() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [verified, setVerified] = useState(null)

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      const u = data?.user
      if (error || !u) { setVerified('unknown'); return }
      setEmail(u.email || '')
      setVerified(Boolean(u.email_confirmed_at))
    }).catch(() => active && setVerified('unknown'))
    return () => { active = false }
  }, [])

  return (
    <div className="sd-pv-page">
      <div className="sd-pv-container">

        {/* HEADER */}
        <header className="sd-pv-header">
          <button type="button" className="sd-pv-back" aria-label="Back to profile" onClick={() => navigate('/profile')}>
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1>Privacy &amp; Security</h1>
            <p>Manage your privacy, account security and how your information is used.</p>
          </div>
        </header>

        {/* HERO BANNER */}
        <section className="sd-pv-hero">
          <div className="sd-pv-hero-body">
            <span className="sd-pv-pill"><FiShield size={14} /> Your Privacy Matters</span>
            <h2>Your Data, Our Priority</h2>
            <p>
              See what information SmartDoc AI uses for your account, study data and documents, and how
              your content is processed when you use its features.
            </p>
          </div>
          <span className="sd-pv-hero-art" aria-hidden="true"><FiLock size={52} /></span>
        </section>

        {/* SINGLE LARGE RECTANGLE CONTAINER BOX FOR ALL DETAILS */}
        <main className="sd-pv-main-box">

          {/* 1. ACCOUNT SECURITY */}
          <section className="sd-pv-section">
            <div className="sd-pv-shead">
              <span className="sd-pv-sicon indigo"><FiLock size={20} /></span>
              <div>
                <h3>Account Security</h3>
                <p>Keep your account credentials and verification status safe.</p>
              </div>
            </div>
            <ul className="sd-pv-list-group">
              <li className="sd-pv-item">
                <div className="sd-pv-row-static">
                  <div className="sd-pv-row-left">
                    <span className="sd-pv-ricon blue"><FiMail size={18} /></span>
                    <div className="sd-pv-rtext">
                      <strong>Email Verification</strong>
                      <span>{email || 'Your account email address'}</span>
                    </div>
                  </div>
                  {verified === true && <span className="sd-pv-badge ok"><FiCheckCircle size={14} /> Verified</span>}
                  {verified === false && <span className="sd-pv-badge warn"><FiAlertCircle size={14} /> Not verified</span>}
                  {verified === null && <span className="sd-pv-badge">Checking...</span>}
                </div>
              </li>
              <li className="sd-pv-item">
                <div className="sd-pv-row-static">
                  <div className="sd-pv-row-left">
                    <span className="sd-pv-ricon blue"><FiKey size={18} /></span>
                    <div className="sd-pv-rtext">
                      <strong>Password Protection</strong>
                      <span>Your password protects your SmartDoc AI account. Keep it private.</span>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </section>

          {/* 2. YOUR INFORMATION */}
          <section className="sd-pv-section">
            <div className="sd-pv-shead">
              <span className="sd-pv-sicon blue"><FiUsers size={20} /></span>
              <div>
                <h3>Your Information</h3>
                <p>Personal profile, qualification data, and exam preferences.</p>
              </div>
            </div>
            <ul className="sd-pv-list-group">
              {yourInformation.map((item) => (
                <Row key={item.title} item={item} onOpen={navigate} />
              ))}
            </ul>
          </section>

          {/* 3. DOCUMENTS & STUDY DATA */}
          <section className="sd-pv-section">
            <div className="sd-pv-shead">
              <span className="sd-pv-sicon green"><FiFolder size={20} /></span>
              <div>
                <h3>Documents &amp; Study Data</h3>
                <p>Content you upload, transcripts generated, and downloaded files.</p>
              </div>
            </div>
            <ul className="sd-pv-list-group">
              {studyData.map((item) => (
                <Row key={item.title} item={item} onOpen={navigate} />
              ))}
            </ul>
          </section>

          {/* 4. AI PROCESSING */}
          <section className="sd-pv-section">
            <div className="sd-pv-shead">
              <span className="sd-pv-sicon indigo"><FiCpu size={20} /></span>
              <div>
                <h3>AI Processing</h3>
                <p>How your content is handled by AI features and third-party models.</p>
              </div>
            </div>
            <div className="sd-pv-ai-card">
              <p className="sd-pv-ai-desc">
                Content you provide to SmartDoc AI, such as a YouTube link or a document, may be processed by the
                AI services used to provide the feature you requested.
              </p>
              <ul className="sd-pv-bullets">
                <li>Processing happens when you generate transcripts, summaries, or AI chat responses.</li>
                <li>Avoid adding sensitive content you do not want processed by third-party AI models.</li>
              </ul>
            </div>
          </section>

          {/* 5. DATA STORAGE & SERVICES */}
          <section className="sd-pv-section">
            <div className="sd-pv-shead">
              <span className="sd-pv-sicon purple"><FiCloud size={20} /></span>
              <div>
                <h3>Data Storage &amp; Third-Party Services</h3>
                <p>Where your data lives and external integrations powering SmartDoc AI.</p>
              </div>
            </div>
            <ul className="sd-pv-list-group">
              {storageServices.map((item) => (
                <Row key={item.title} item={item} onOpen={navigate} />
              ))}
              {thirdParty.map((item) => (
                <Row key={item.title} item={item} onOpen={navigate} />
              ))}
            </ul>
          </section>

          {/* 6. POLICIES & TERMS */}
          <section className="sd-pv-section last">
            <div className="sd-pv-shead">
              <span className="sd-pv-sicon rose"><FiShield size={20} /></span>
              <div>
                <h3>Legal Policies &amp; Terms</h3>
                <p>Official guidelines and privacy disclosures.</p>
              </div>
            </div>
            <ul className="sd-pv-list-group">
              {policyLinks.map((item) => (
                <Row key={item.title} item={{ ...item, tone: 'indigo' }} onOpen={navigate} />
              ))}
            </ul>
          </section>

        </main>

      </div>
    </div>
  )
}