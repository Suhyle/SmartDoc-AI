import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiMenu,
  FiBell,
  FiUpload,
  FiLink,
  FiFileText,
  FiPlay,
  FiVideo,
  FiDownload,
  FiFolder,
  FiStar,
  FiMoreVertical,
  FiYoutube,
  FiX,
  FiLayers,
  FiArrowRight,
  FiCheckCircle,
  FiZap,
  FiShield,
  FiChevronRight,
  FiHome,
  FiUser,
  FiPlus
} from 'react-icons/fi'

import { supabase } from '../supabase'
import './Home.css'

export default function Home() {
  const navigate = useNavigate()

  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // YouTube input state
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)

  // PDF Category selection
  const [activeCategory, setActiveCategory] = useState('All')

  // Recorded video upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedVideoFile, setSelectedVideoFile] = useState(null)

  // Central + Action Menu state
  const [showAddMenu, setShowAddMenu] = useState(false)

  // Active Bottom Nav Tab
  const [activeTab, setActiveTab] = useState('home')

  // Documents/transcriptions data from Supabase
  const [recentTranscripts, setRecentTranscripts] = useState([])

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

        const adminRole =
          user.user_metadata?.role === 'admin' ||
          user.app_metadata?.role === 'admin' ||
          user.email?.endsWith('@admin.com')

        setIsAdmin(!!adminRole)
      }

      setLoading(false)
    }

    fetchUser()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const displayName =
          session?.user?.user_metadata?.full_name ||
          session?.user?.user_metadata?.name ||
          session?.user?.email?.split('@')[0] ||
          'there'

        if (displayName) {
          setUserName(displayName)
        }

        const adminRole =
          session?.user?.user_metadata?.role === 'admin' ||
          session?.user?.app_metadata?.role === 'admin'

        setIsAdmin(!!adminRole)
      }
    )

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [])

  // Exam categories
  const examCategories = [
    { name: 'PSC', icon: '🏛️', count: '24 PDFs', color: 'green' },
    { name: 'SSC', icon: '🎓', count: '18 PDFs', color: 'blue' },
    { name: 'Bank', icon: '🏦', count: '12 PDFs', color: 'amber' },
    { name: 'Railway', icon: '🚆', count: '8 PDFs', color: 'purple' },
    { name: 'UPSC', icon: '🏛️', count: '10 PDFs', color: 'red' },
    { name: 'Other', icon: '📁', count: '15 PDFs', color: 'slate' }
  ]

  // Sample transcript data for Home Page UI
  const sampleTranscripts = [
    {
      id: '1',
      title: 'Introduction to Artificial Intelligence',
      subtext: '2 hours ago',
      source: 'YouTube',
      duration: '12:45'
    },
    {
      id: '2',
      title: 'Machine Learning Basics',
      subtext: '1 day ago',
      source: 'YouTube',
      duration: '18:32'
    },
    {
      id: '3',
      title: 'Data Structures in C++ (Part 1)',
      subtext: '2 days ago',
      source: 'Uploaded',
      duration: '15:20'
    },
    {
      id: '4',
      title: 'DBMS Complete Course',
      subtext: '3 days ago',
      source: 'YouTube',
      duration: '22:10'
    },
    {
      id: '5',
      title: 'Operating Systems Full Lecture',
      subtext: '4 days ago',
      source: 'Uploaded',
      duration: '25:15'
    }
  ]

  // Sample PDF data for Home Page UI
  const samplePdfs = [
    {
      id: 'p1',
      name: 'SSC CGL Quantitative Aptitude Notes.pdf',
      category: 'SSC',
      size: '12.4 MB',
      date: '2 days ago'
    },
    {
      id: 'p2',
      name: 'Kerala PSC Current Affairs.pdf',
      category: 'PSC',
      size: '6.1 MB',
      date: '1 week ago'
    },
    {
      id: 'p3',
      name: 'Bank PO Reasoning Notes.pdf',
      category: 'Bank',
      size: '9.3 MB',
      date: '1 week ago'
    },
    {
      id: 'p4',
      name: 'General Science – PSC.pdf',
      category: 'PSC',
      size: '7.8 MB',
      date: '2 weeks ago'
    }
  ]

  const displayTranscripts =
    recentTranscripts.length > 0
      ? recentTranscripts
      : sampleTranscripts

  // Handle YouTube Transcribe Submission
  const handleTranscribeSubmit = (e) => {
    e.preventDefault()
    if (!youtubeUrl.trim()) return

    setIsTranscribing(true)

    setTimeout(() => {
      setIsTranscribing(false)
      navigate('/url-upload', { state: { url: youtubeUrl } })
    }, 700)
  }

  // Handle Recorded Video Upload
  const handleVideoUploadSubmit = (e) => {
    e.preventDefault()
    if (!selectedVideoFile) return

    setShowUploadModal(false)
    navigate('/upload', { state: { fileName: selectedVideoFile.name } })
  }

  // Focus YouTube input
  const focusYoutubeInput = () => {
    const element = document.querySelector('.sd-yt-input')
    if (element) element.focus()
  }

  return (
    <div className="sd-home-page">
      <div className="sd-home-container">

        {/* 1. HEADER (Profile Photo Removed) */}
        <header className="sd-header">
          <div className="sd-header-left">
            <button className="sd-icon-btn sd-menu-btn" aria-label="Menu">
              <FiMenu size={22} />
            </button>
            <div className="sd-brand-wrapper">
              <div className="sd-brand-logo">
                <span className="sd-logo-box">
                  <FiFileText size={18} className="sd-logo-icon" />
                </span>
                <span className="sd-brand-text">
                  SmartDoc <span className="sd-ai-tag">AI</span>
                </span>
              </div>
              <span className="sd-tagline">Transcribe. Learn. Succeed.</span>
            </div>
          </div>

          <div className="sd-header-right">
            {isAdmin && (
              <button className="sd-admin-badge" onClick={() => navigate('/admin')}>
                👑 Admin Panel
              </button>
            )}
            <button className="sd-icon-btn sd-notif-btn" aria-label="Notifications">
              <FiBell size={20} />
              <span className="sd-notif-dot">3</span>
            </button>
          </div>
        </header>

        {/* 2. GREETING */}
        <section className="sd-greeting-row">
          <div className="sd-greeting-text">
            <h1 className="sd-greeting-title">
              Hello, {loading ? '...' : userName}
              <span className="wave-emoji">👋</span>
            </h1>
            <p className="sd-greeting-subtitle">
              Turn videos into transcripts and smart study notes.
            </p>
          </div>

          <div className="sd-banner-card" onClick={() => navigate('/documents')}>
            <div className="sd-banner-icon">📄</div>
            <div className="sd-banner-info">
              <h4>Your learning, organized</h4>
              <p>Transcribe videos, generate notes and save as PDFs.</p>
            </div>
            <button className="sd-banner-arrow" aria-label="View Documents">
              <FiArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* 3. YOUTUBE TRANSCRIPT HERO CARD */}
        <section className="sd-yt-hero-card">
          <div className="sd-yt-card-header">
            <div className="sd-yt-red-box">
              <FiYoutube size={24} />
            </div>
            <div>
              <h2>YouTube Transcript</h2>
              <p>Paste a YouTube video link to get started</p>
            </div>
          </div>

          <form onSubmit={handleTranscribeSubmit} className="sd-yt-form">
            <div className="sd-yt-input-wrapper">
              <FiLink className="sd-input-link-icon" size={18} />
              <input
                type="url"
                className="sd-yt-input"
                placeholder="Paste YouTube URL here..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className={`sd-btn-transcribe ${isTranscribing ? 'loading' : ''}`}
              disabled={isTranscribing}
            >
              <FiStar size={16} />
              {isTranscribing ? 'Transcribing...' : 'Transcribe'}
            </button>
          </form>

          <div className="sd-yt-badges">
            <span className="sd-badge"><FiCheckCircle size={14} className="sd-icon-blue" /> Accurate Transcription</span>
            <span className="sd-badge"><FiZap size={14} className="sd-icon-purple" /> Fast Processing</span>
            <span className="sd-badge"><FiShield size={14} className="sd-icon-indigo" /> Secure & Private</span>
          </div>
        </section>

        {/* 4. YOUTUBE + RECORDED VIDEO CARDS */}
        <section className="sd-dual-features">
          <div className="sd-feature-card sd-card-yt">
            <div className="sd-feature-content">
              <div className="sd-feature-icon-wrapper red">
                <FiYoutube size={22} />
              </div>
              <h3>YouTube Videos</h3>
              <p>Transcribe any YouTube videos and get accurate transcripts.</p>
              <button className="sd-btn-card-action pink" onClick={focusYoutubeInput}>
                Start Now <FiArrowRight size={14} />
              </button>
            </div>
            <div className="sd-card-illustration yt-illus">
              <div className="mini-player"><FiPlay size={20} className="play-pink" /></div>
            </div>
          </div>

          <div className="sd-feature-card sd-card-recorded">
            <div className="sd-feature-content">
              <div className="sd-feature-icon-wrapper blue">
                <FiVideo size={22} />
              </div>
              <h3>Recorded Videos</h3>
              <p>Upload recorded videos that don't have transcripts and we'll transcribe them.</p>
              <div className="sd-card-footer-group">
                <button className="sd-btn-card-action blue" onClick={() => setShowUploadModal(true)}>
                  Upload Video <FiArrowRight size={14} />
                </button>
                <div className="sd-format-pills">
                  <span>MP4</span><span>MOV</span><span>AVI</span><span>MKV</span>
                </div>
              </div>
            </div>
            <div className="sd-card-illustration upload-illus">
              <div className="mini-cloud"><FiUpload size={22} className="cloud-blue" /></div>
            </div>
          </div>
        </section>

        {/* 5. RECENT TRANSCRIPTS + QUICK ACTIONS */}
        <div className="sd-middle-grid">
          <section className="sd-recent-transcripts-section">
            <div className="sd-section-header">
              <h2>Recent Transcripts</h2>
              <button className="sd-link-btn" onClick={() => navigate('/documents')}>View All</button>
            </div>
            <div className="sd-transcripts-card-list">
              {displayTranscripts.map((item) => (
                <div key={item.id} className="sd-transcript-row" onClick={() => navigate(`/documents/${item.id}`)}>
                  <div className="sd-thumb-box">
                    <div className="sd-play-overlay"><FiPlay size={14} /></div>
                  </div>
                  <div className="sd-transcript-details">
                    <h4 className="sd-transcript-title">{item.title}</h4>
                    <div className="sd-transcript-meta">
                      <span>{item.subtext}</span><span className="dot">•</span>
                      <span className={`source-tag ${item.source.toLowerCase()}`}>
                        {item.source === 'YouTube' ? <FiYoutube size={12} /> : <FiVideo size={12} />}
                        {item.source}
                      </span>
                    </div>
                  </div>
                  <span className="sd-duration-pill">{item.duration}</span>
                  <button className="sd-options-btn" onClick={(e) => e.stopPropagation()}><FiMoreVertical size={16} /></button>
                </div>
              ))}
              <button className="sd-btn-view-all-full" onClick={() => navigate('/documents')}>
                View All Transcripts <FiChevronRight size={16} />
              </button>
            </div>
          </section>

          <div className="sd-right-col">
            <section className="sd-quick-actions-section">
              <h3 className="sd-col-title">Quick Actions</h3>
              <div className="sd-quick-actions-grid">
                <div className="sd-quick-tile" onClick={focusYoutubeInput}>
                  <div className="sd-tile-icon red"><FiYoutube size={20} /></div>
                  <span>YouTube Transcript</span>
                </div>
                <div className="sd-quick-tile" onClick={() => navigate('/multiple-videos')}>
                  <div className="sd-tile-icon purple"><FiLayers size={20} /></div>
                  <span>Multiple Videos</span>
                </div>
                <div className="sd-quick-tile" onClick={() => setShowUploadModal(true)}>
                  <div className="sd-tile-icon blue"><FiUpload size={20} /></div>
                  <span>Upload Video</span>
                </div>
                <div className="sd-quick-tile" onClick={() => navigate('/documents')}>
                  <div className="sd-tile-icon green"><FiFileText size={20} /></div>
                  <span>My Transcripts</span>
                </div>
                <div className="sd-quick-tile" onClick={() => navigate('/favorites')}>
                  <div className="sd-tile-icon amber"><FiStar size={20} /></div>
                  <span>Favorites</span>
                </div>
                <div className="sd-quick-tile" onClick={() => navigate('/downloads')}>
                  <div className="sd-tile-icon violet"><FiFolder size={20} /></div>
                  <span>Downloaded PDFs</span>
                </div>
              </div>
            </section>

            <section className="sd-recent-pdfs-section">
              <div className="sd-section-header">
                <h2>Recently Generated PDFs</h2>
                <button className="sd-link-btn" onClick={() => navigate('/downloads')}>View All</button>
              </div>
              <div className="sd-pdf-list">
                {samplePdfs.map((pdf) => (
                  <div key={pdf.id} className="sd-pdf-row">
                    <div className="sd-pdf-red-icon"><FiFileText size={18} /></div>
                    <div className="sd-pdf-info">
                      <h4 className="sd-pdf-name">{pdf.name}</h4>
                      <p className="sd-pdf-sub">{pdf.category} • {pdf.size} • {pdf.date}</p>
                    </div>
                    <button className="sd-pdf-dl-btn" title="Download PDF" onClick={(e) => e.stopPropagation()}>
                      <FiDownload size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* 6. PDF CATEGORIES */}
        <section className="sd-categories-section">
          <div className="sd-section-header">
            <h2>PDF Categories <span className="sub-tag">(Saved & Organized)</span></h2>
            <button className="sd-link-btn" onClick={() => navigate('/downloads')}>View All</button>
          </div>
          <div className="sd-categories-grid">
            {examCategories.map((cat) => (
              <div
                key={cat.name}
                className={`sd-category-card ${cat.color}`}
                onClick={() => navigate('/downloads', { state: { category: cat.name } })}
              >
                <span className="sd-cat-emoji">{cat.icon}</span>
                <div className="sd-cat-text">
                  <h4>{cat.name}</h4>
                  <p>{cat.count}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* 7. RECORDED VIDEO UPLOAD MODAL */}
      {showUploadModal && (
        <div className="sd-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="sd-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sd-modal-header">
              <h3>Upload Recorded Video</h3>
              <button className="sd-modal-close" onClick={() => setShowUploadModal(false)}><FiX size={20} /></button>
            </div>
            <form onSubmit={handleVideoUploadSubmit} className="sd-modal-body">
              <div className="sd-dropzone">
                <FiUpload size={40} className="sd-drop-icon" />
                <p className="sd-drop-title">
                  Drag & Drop your video here or <label htmlFor="video-file-upload" className="sd-browse-link">Browse</label>
                </p>
                <input
                  type="file"
                  id="video-file-upload"
                  accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
                  onChange={(e) => setSelectedVideoFile(e.target.files?.[0] || null)}
                  className="sd-hidden-file"
                />
                <p className="sd-drop-hint">Supports: MP4, MOV, AVI • Max size: 2GB</p>
                {selectedVideoFile && <div className="sd-file-selected-badge">📄 {selectedVideoFile.name}</div>}
              </div>
              <div className="sd-modal-footer">
                <button type="button" className="sd-btn-cancel" onClick={() => setShowUploadModal(false)}>Cancel</button>
                <button type="submit" className="sd-btn-submit" disabled={!selectedVideoFile}>Upload & Transcribe</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. CENTRAL '+' CREATE MENU */}
      {showAddMenu && (
        <div className="sd-add-menu-overlay" onClick={() => setShowAddMenu(false)}>
          <div className="sd-add-popover" onClick={(e) => e.stopPropagation()}>
            <h4>Create New</h4>
            <button onClick={() => { setShowAddMenu(false); focusYoutubeInput(); }}>
              <FiYoutube size={18} className="red-icon" /> YouTube Video
            </button>
            <button onClick={() => { setShowAddMenu(false); navigate('/multiple-videos'); }}>
              <FiLayers size={18} className="purple-icon" /> Multiple YouTube Videos
            </button>
            <button onClick={() => { setShowAddMenu(false); setShowUploadModal(true); }}>
              <FiVideo size={18} className="blue-icon" /> Upload Recorded Video
            </button>
          </div>
        </div>
      )}

      {/* 9. EXACT PROTOTYPE BOTTOM NAVIGATION BAR */}
      <nav className="sd-bottom-nav">
        <button
          className={`sd-nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
        >
          <FiHome size={20} className="sd-nav-icon" />
          <span className="sd-nav-label">Home</span>
        </button>

        <button
          className={`sd-nav-item ${activeTab === 'transcripts' ? 'active' : ''}`}
          onClick={() => { setActiveTab('transcripts'); navigate('/documents'); }}
        >
          <FiFileText size={20} className="sd-nav-icon" />
          <span className="sd-nav-label">Transcripts</span>
        </button>

        <div className="sd-central-plus-wrapper">
          <button
            className="sd-central-plus-btn"
            aria-label="Add / New"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            <FiPlus size={24} />
          </button>
          <span className="sd-nav-label sd-plus-label">Add / New</span>
        </div>

        <button
          className={`sd-nav-item ${activeTab === 'downloads' ? 'active' : ''}`}
          onClick={() => { setActiveTab('downloads'); navigate('/downloads'); }}
        >
          <FiDownload size={20} className="sd-nav-icon" />
          <span className="sd-nav-label">Downloads</span>
        </button>

        <button
          className={`sd-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => { setActiveTab('profile'); navigate('/profile'); }}
        >
          <FiUser size={20} className="sd-nav-icon" />
          <span className="sd-nav-label">Profile</span>
        </button>
      </nav>
    </div>
  )
}