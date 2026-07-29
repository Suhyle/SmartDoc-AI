import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiBell, FiUpload, FiLink, FiFileText } from 'react-icons/fi'
import { supabase } from '../supabase'
import BottomNav from '../components/BottomNav'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  // Will later hold documents fetched from Supabase (table: documents)
  const [recentDocuments, setRecentDocuments] = useState([])

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'there'
        setUserName(displayName)
      }
      setLoading(false)
    }

    fetchUser()

    // Keep name in sync if auth state changes (e.g. profile update)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const displayName =
        session?.user?.user_metadata?.full_name ||
        session?.user?.user_metadata?.name ||
        session?.user?.email?.split('@')[0] ||
        'there'
      if (displayName) setUserName(displayName)
    })

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  return (
    <div className="home-page">
      <div className="home-content">
        {/* ---------- Greeting Header ---------- */}
        <header className="home-header">
          <div>
            <h1 className="home-greeting">
              Hello, {loading ? '...' : userName} <span className="wave-emoji">👋</span>
            </h1>
            <p className="home-subtitle">What would you like to do today?</p>
          </div>

          <button className="notification-btn" aria-label="Notifications">
            <FiBell size={20} />
            <span className="notification-dot" />
          </button>
        </header>

        {/* ---------- Main Feature Cards ---------- */}
        <section className="feature-cards">
          <button className="feature-card" onClick={() => navigate('/upload')}>
            <span className="feature-icon feature-icon--upload">
              <FiUpload size={20} />
            </span>
            <span className="feature-text">
              <span className="feature-title">Upload PDF</span>
              <span className="feature-desc">Upload your PDF document</span>
            </span>
            <span className="feature-arrow">›</span>
          </button>

          <button className="feature-card" onClick={() => navigate('/url-upload')}>
            <span className="feature-icon feature-icon--link">
              <FiLink size={20} />
            </span>
            <span className="feature-text">
              <span className="feature-title">Paste Website URL</span>
              <span className="feature-desc">Import document from a website</span>
            </span>
            <span className="feature-arrow">›</span>
          </button>

          {/*
            Future feature cards can be added here, e.g.:
            - AI Summary
            - Malayalam Translation
            - Malayalam Voice Output
            - AI Chat with PDF
            The .feature-cards grid auto-wraps, so new cards drop in cleanly.
          */}
        </section>

        {/* ---------- Recent Documents ---------- */}
        <section className="recent-section">
          <div className="recent-header">
            <h2>Recent Documents</h2>
            <button className="view-all-btn" onClick={() => navigate('/documents')}>
              View All
            </button>
          </div>

          {recentDocuments.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">
                <FiFileText size={22} />
              </span>
              <p>No documents uploaded</p>
              <span className="empty-hint">Your uploaded PDFs will appear here</span>
            </div>
          ) : (
            <ul className="documents-list">
              {recentDocuments.map((doc) => (
                <li key={doc.id} className="document-item">
                  {doc.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <BottomNav />
    </div>
  )
}