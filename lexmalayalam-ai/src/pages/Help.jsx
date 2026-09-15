import React, { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiArrowLeft, FiSearch, FiChevronDown, FiChevronRight, FiHelpCircle, FiPlay,
  FiBookOpen, FiFileText, FiBell, FiAward, FiUser, FiSend, FiMail, FiX
} from 'react-icons/fi'
import './Help.css'

/* =========================================================
   FAQ DATA
   Every actionRoute below exists in App.jsx (plus /help and /feedback).
   Answers only describe what App.jsx / Profile.jsx confirm, plus the
   wording from your prototype. Lines marked VERIFY should be checked
   against the real feature pages (Home, StudyPlan, Quiz, Notifications,
   MyProfile, Downloads) before release.
========================================================= */

const faqData = [
  {
    id: 'get-started',
    category: 'getting-started',
    topics: ['account'],
    question: 'How do I get started with SmartDoc AI?',
    shortAnswer: 'Learn the basic steps to start using SmartDoc AI for your exam preparation.',
    keywords: 'signup register login select exam qualification home begin',
    intro: 'The app currently follows this first-use flow:',
    steps: [
      'Open the app and choose **Sign up** to create your account.',
      'Choose your exams on the **Select Exam** screen.',
      '**Log in** with your account.',
      'You arrive on **Home**, where you can add content and open the other sections.'
    ],
    note: 'Qualification details are collected in a Qualification form and can be updated later from **My Profile**.', // VERIFY
    actionLabel: 'Go to Home', actionRoute: '/home'
  },
  {
    id: 'youtube-transcript',
    category: 'features',
    topics: ['youtube'],
    question: 'How do I generate a transcript from a YouTube video?',
    shortAnswer: 'Step-by-step guide to create transcripts and summaries from YouTube videos.',
    keywords: 'youtube video link url transcript summary generate',
    intro: 'Transcripts and summaries live on the **Transcript & Summary** page.',
    steps: [ // VERIFY: exact buttons/labels used for adding a YouTube link
      'Tap **Transcripts** in the bottom bar.',
      'Add your YouTube video link and start processing.',
      'When processing finishes, read the transcript and summary on the same page.'
    ],
    actionLabel: 'Open YouTube Transcript', actionRoute: '/transcript-summary'
  },
  {
    id: 'recommended-videos',
    category: 'features',
    topics: ['youtube', 'study'],
    question: 'How does the Recommended Videos section work?',
    shortAnswer: 'Videos are suggested based on your selected exams and study plan topics.', // VERIFY
    keywords: 'recommended videos suggestions home exams study plan topics',
    intro: 'The **Recommended Videos** section on **Home** is built around the exams you selected and your study plan topics.',
    bullets: [
      'Change your exams from **My Profile** to change what is recommended.',
      'Recommendations are suggestions only; they do not replace your study plan.'
    ],
    actionLabel: 'Go to Home', actionRoute: '/home'
  },
  {
    id: 'study-plan',
    category: 'features',
    topics: ['study'],
    question: 'How do I create and manage a study plan?',
    shortAnswer: 'Learn how to set up a personalized timetable and track your progress.',
    keywords: 'study plan timetable schedule progress tasks planner',
    intro: 'The **Study Plan** page is where you set up a timetable and follow your progress.',
    steps: [ // VERIFY: creation flow, task handling and progress tracking
      'Open **Study Plan** from the link below.',
      'Set up your timetable.',
      'Come back to track your progress as you study.'
    ],
    actionLabel: 'Open Study Plan', actionRoute: '/study-plan'
  },
  {
    id: 'notifications',
    category: 'exams',
    topics: ['notifications'],
    question: 'How do exam notifications work?',
    shortAnswer: 'Notifications are shown based on your qualification and selected exam preferences.',
    keywords: 'exam notification reminder alert qualification find exam',
    intro: 'The **Notifications** page (also used to find exams) shows exam notifications that match your qualification and the exams you selected.',
    bullets: [
      'Open a notification to read its details.',
      'You can set reminders for exams you care about.', // VERIFY
      'It lists notifications available inside SmartDoc AI, not every government exam notice.'
    ],
    actionLabel: 'Open Notifications', actionRoute: '/notifications'
  },
  {
    id: 'quiz',
    category: 'features',
    topics: ['quiz'],
    question: 'How do I take a quiz and view my results?',
    shortAnswer: 'Learn how to attempt quizzes and check your performance.',
    keywords: 'quiz mock test practice questions score result performance',
    intro: 'Quizzes are on the **Quiz** page (mock tests).',
    steps: [ // VERIFY: selection, submit and result screens
      'Open **Quiz**.',
      'Pick a quiz and answer the questions.',
      'Submit to see how you performed.'
    ],
    actionLabel: 'Take a Quiz', actionRoute: '/quiz'
  },
  {
    id: 'edit-profile',
    category: 'account',
    topics: ['account'],
    question: 'How can I edit my profile or add a new qualification?',
    shortAnswer: 'Go to My Profile to update your personal details, qualifications and exam preferences.',
    keywords: 'edit profile qualification personal details name update account',
    intro: 'Open **My Profile** to update your details.',
    steps: [
      'Go to the **Profile** tab.',
      'Tap **My Profile** (or the three-dot menu, then **Edit Profile**).',
      'Update your personal details, qualifications or exam preferences.' // VERIFY
    ],
    actionLabel: 'Open My Profile', actionRoute: '/profile/edit'
  },
  {
    id: 'downloads',
    category: 'features',
    topics: ['documents'],
    question: 'Where can I find my downloaded documents?',
    shortAnswer: 'Access all your downloaded PDFs and documents in the Downloads section.',
    keywords: 'downloads pdf library saved files download document',
    intro: 'Open **Downloads** from the bottom bar to see your PDF library.',
    actionLabel: 'Open Downloads', actionRoute: '/downloads'
  },
  {
    id: 'upload-pdf',
    category: 'features',
    topics: ['documents'],
    question: 'How do I upload a PDF?',
    shortAnswer: 'Add your own PDF so SmartDoc AI can work with it.',
    keywords: 'upload pdf file document add new',
    intro: 'SmartDoc AI has an **Upload PDF** page. Open it, choose your file and follow the on-screen steps.', // VERIFY
    actionLabel: 'Open Upload', actionRoute: '/upload'
  },
  {
    id: 'website-url',
    category: 'features',
    topics: ['documents'],
    question: 'Can I add content from a website link?',
    shortAnswer: 'Use the Website URL upload to add a web page.',
    keywords: 'website url link web page upload article',
    intro: 'Yes. The **Website URL Upload** page lets you add a website link. Open it, paste the link and follow the on-screen steps.', // VERIFY
    actionLabel: 'Open URL Upload', actionRoute: '/url-upload'
  },
  {
    id: 'my-documents',
    category: 'features',
    topics: ['documents'],
    question: 'Where can I see the documents I uploaded?',
    shortAnswer: 'Your uploaded documents are listed under My Documents.',
    keywords: 'my documents uploaded files list',
    intro: 'Open **Profile**, then **My Documents** to view what you uploaded.',
    actionLabel: 'Open My Documents', actionRoute: '/documents'
  },
  {
    id: 'change-exams',
    category: 'exams',
    topics: ['account', 'notifications'],
    question: 'How do I change my selected exams?',
    shortAnswer: 'Update your exam preferences from My Profile.', // VERIFY
    keywords: 'change selected exams preferences select exam update',
    intro: 'Your exam preferences are part of **My Profile**. Update them there, and notifications and recommendations follow your new selection.', // VERIFY
    actionLabel: 'Open My Profile', actionRoute: '/profile/edit'
  },
  {
    id: 'language-settings',
    category: 'account',
    topics: ['account'],
    question: 'How do I change the language or theme?',
    shortAnswer: 'Language, theme and app settings are in Settings.',
    keywords: 'language theme settings app preferences',
    intro: 'Open **Profile**, then **Settings** for language, theme and app settings. Your current language is also shown under **Preferences** on the Profile page.',
    actionLabel: 'Open Settings', actionRoute: '/settings'
  },
  {
    id: 'send-feedback',
    category: 'account',
    topics: ['account'],
    question: 'How do I send feedback or report a problem?',
    shortAnswer: 'Use the feedback form to rate the app, report issues or suggest features.',
    keywords: 'feedback report problem bug suggest feature rating contact',
    intro: 'Open **Profile**, then **Send Feedback**. You can rate your experience, choose a feedback type, pick related exams and describe your feedback.',
    actionLabel: 'Send Feedback', actionRoute: '/feedback'
  }
]

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'getting-started', label: 'Getting Started' },
  { key: 'features', label: 'Features' },
  { key: 'account', label: 'Account' },
  { key: 'exams', label: 'Exams' }
]

const POPULAR = ['Study Plan', 'Notifications', 'YouTube Transcript', 'Quiz', 'My Profile']

const QUICK = [
  { key: 'youtube', title: 'YouTube & Transcripts', desc: 'Learn how to generate transcripts and summaries', icon: <FiPlay size={22} />, tone: 'purple' },
  { key: 'study', title: 'Study Plan & Timetable', desc: 'Create and manage your study plans', icon: <FiBookOpen size={22} />, tone: 'blue' },
  { key: 'documents', title: 'Documents & Downloads', desc: 'Access your saved documents and PDFs', icon: <FiFileText size={22} />, tone: 'green' },
  { key: 'notifications', title: 'Notifications', desc: 'Get exam notifications and set reminders', icon: <FiBell size={22} />, tone: 'amber' },
  { key: 'quiz', title: 'Quiz & Practice', desc: 'Take quizzes and track your progress', icon: <FiAward size={22} />, tone: 'rose' },
  { key: 'account', title: 'Account & Profile', desc: 'Manage your profile, qualifications and settings', icon: <FiUser size={22} />, tone: 'indigo' }
]

/* **bold** -> <strong> for UI names */
const fmt = (text) =>
  text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))

const plain = (f) =>
  [f.question, f.shortAnswer, f.keywords, f.intro, f.note, ...(f.steps || []), ...(f.bullets || [])]
    .filter(Boolean).join(' ').replace(/\*\*/g, '').toLowerCase()

export default function Help() {
  const navigate = useNavigate()
  const faqRef = useRef(null)

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [topic, setTopic] = useState('')
  const [openId, setOpenId] = useState(null)

  const searchable = useMemo(() => faqData.map((f) => ({ f, text: plain(f) })), [])

  const results = useMemo(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    return searchable
      .filter(({ f }) => (tab === 'all' || f.category === tab) && (!topic || f.topics.includes(topic)))
      .filter(({ text }) => tokens.every((t) => text.includes(t)))
      .map(({ f }) => f)
  }, [searchable, query, tab, topic])

  const scrollToFaq = () => faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const applySearch = (term) => {
    setQuery(term); setTab('all'); setTopic(''); setOpenId(null)
    scrollToFaq()
  }

  const applyTopic = (key) => {
    setTopic(key); setTab('all'); setQuery(''); setOpenId(null)
    scrollToFaq()
  }

  const clearFilters = () => { setQuery(''); setTab('all'); setTopic(''); setOpenId(null) }

  const topicTitle = QUICK.find((q) => q.key === topic)?.title

  return (
    <div className="sd-hp-page">
      <div className="sd-hp-container">

        <header className="sd-hp-header">
          <button type="button" className="sd-hp-back" aria-label="Back to profile" onClick={() => navigate('/profile')}>
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1>Help &amp; Support</h1>
            <p>Find answers and get help with SmartDoc AI</p>
          </div>
        </header>

        {/* HERO + SEARCH */}
        <section className="sd-hp-hero">
          <div className="sd-hp-hero-body">
            <span className="sd-hp-pill"><FiHelpCircle size={14} /> Need Help?</span>
            <h2>We&apos;re here to help!</h2>
            <p>Find answers to common questions, learn how to use SmartDoc AI, or contact us for support.</p>

            <form className="sd-hp-search" role="search" onSubmit={(e) => { e.preventDefault(); scrollToFaq() }}>
              <label htmlFor="sd-hp-search-input" className="sd-hp-sr">Search help articles</label>
              <FiSearch size={18} className="sd-hp-search-icon" aria-hidden="true" />
              <input
                id="sd-hp-search-input"
                type="search"
                value={query}
                placeholder="Search for help... (e.g. study plan, notifications, transcript)"
                onChange={(e) => { setQuery(e.target.value); setOpenId(null) }}
              />
              <button type="submit">Search</button>
            </form>

            <div className="sd-hp-popular">
              <span>Popular searches:</span>
              {POPULAR.map((p) => (
                <button key={p} type="button" onClick={() => applySearch(p)}>{p}</button>
              ))}
            </div>
          </div>
          <FiHelpCircle size={96} className="sd-hp-hero-icon" aria-hidden="true" />
        </section>

        {/* QUICK CATEGORIES */}
        <section className="sd-hp-card" aria-labelledby="sd-hp-quick-title">
          <h3 id="sd-hp-quick-title">Quick Help Categories</h3>
          <p className="sd-hp-sub">Choose a topic to find relevant help and guides.</p>
          <div className="sd-hp-quick">
            {QUICK.map((q) => (
              <button
                key={q.key}
                type="button"
                className={`sd-hp-quick-card ${q.tone} ${topic === q.key ? 'on' : ''}`}
                aria-pressed={topic === q.key}
                onClick={() => applyTopic(q.key)}
              >
                <span className="sd-hp-quick-icon">{q.icon}</span>
                <span className="sd-hp-quick-text"><strong>{q.title}</strong><span>{q.desc}</span></span>
                <FiChevronRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="sd-hp-card" ref={faqRef} aria-labelledby="sd-hp-faq-title">
          <div className="sd-hp-faq-head">
            <div>
              <h3 id="sd-hp-faq-title">Frequently Asked Questions</h3>
              <p className="sd-hp-sub">Find answers to common questions about SmartDoc AI.</p>
            </div>
            <div className="sd-hp-tabs" role="group" aria-label="FAQ categories">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={tab === t.key}
                  className={tab === t.key ? 'on' : ''}
                  onClick={() => { setTab(t.key); setOpenId(null) }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {(topic || query) && (
            <div className="sd-hp-active">
              <span>
                {topic && <>Topic: <strong>{topicTitle}</strong> </>}
                {query && <>Search: <strong>{query}</strong></>}
              </span>
              <button type="button" onClick={clearFilters}><FiX size={14} /> Clear</button>
            </div>
          )}

          <p className="sd-hp-sr" aria-live="polite">{results.length} help articles found</p>

          {results.length === 0 ? (
            <div className="sd-hp-empty">
              <FiSearch size={32} aria-hidden="true" />
              <h4>No help articles found.</h4>
              <p>Try another search or send us feedback.</p>
              <button type="button" className="sd-hp-primary" onClick={() => navigate('/feedback')}>
                <FiSend size={16} /> Send Feedback
              </button>
            </div>
          ) : (
            <ul className="sd-hp-list">
              {results.map((f) => {
                const open = openId === f.id
                return (
                  <li key={f.id} className={open ? 'open' : ''}>
                    <h4>
                      <button
                        type="button"
                        id={`sd-hp-btn-${f.id}`}
                        aria-expanded={open}
                        aria-controls={`sd-hp-panel-${f.id}`}
                        onClick={() => setOpenId(open ? null : f.id)}
                      >
                        <span className="sd-hp-q">
                          <strong>{f.question}</strong>
                          <span>{f.shortAnswer}</span>
                        </span>
                        <FiChevronDown size={20} className="sd-hp-chevron" aria-hidden="true" />
                      </button>
                    </h4>
                    {open && (
                      <div
                        className="sd-hp-answer"
                        id={`sd-hp-panel-${f.id}`}
                        role="region"
                        aria-labelledby={`sd-hp-btn-${f.id}`}
                      >
                        {f.intro && <p>{fmt(f.intro)}</p>}
                        {f.steps && <ol>{f.steps.map((s, i) => <li key={i}>{fmt(s)}</li>)}</ol>}
                        {f.bullets && <ul>{f.bullets.map((s, i) => <li key={i}>{fmt(s)}</li>)}</ul>}
                        {f.note && <p className="sd-hp-note">{fmt(f.note)}</p>}
                        {f.actionRoute && (
                          <button type="button" className="sd-hp-action" onClick={() => navigate(f.actionRoute)}>
                            {f.actionLabel} <FiChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* STILL NEED HELP + CONTACT */}
        <div className="sd-hp-bottom">
          <section className="sd-hp-still">
            <h3>Still need help?</h3>
            <p>Didn&apos;t find what you were looking for? Our team would love to hear from you.</p>
            <button type="button" className="sd-hp-primary" onClick={() => navigate('/feedback')}>
              <FiSend size={16} /> Send Feedback <FiChevronRight size={16} />
            </button>
          </section>

          <section className="sd-hp-contact">
            <h3><FiMail size={18} /> Contact Information</h3>
            {/* No support email exists in the project yet. Replace this line when one does. */}
            <p>Support contact will be available soon.</p>
            <p className="sd-hp-sub">In the meantime, you can share your thoughts with Send Feedback.</p>
          </section>
        </div>

      </div>
    </div>
  )
}