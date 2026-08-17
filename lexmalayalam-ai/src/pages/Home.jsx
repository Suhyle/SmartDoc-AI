import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

import {
  FiMenu,
  FiBell,
  FiArrowRight,
  FiYoutube,
  FiLink,
  FiVideo,
  FiMoreVertical,
  FiDownload,
  FiHome,
  FiFileText,
  FiPlus,
  FiUser,
  FiLayers,
  FiFolder,
  FiCheck,
  FiBriefcase,
  FiCompass,
  FiAward,
  FiBookOpen,
  FiX,
  FiUploadCloud,
  FiStar,
  FiTrendingUp,
  FiPlay,
  FiList
} from 'react-icons/fi'

import './Home.css'


export default function Home() {

  const navigate = useNavigate()

  // ==========================================
  // STATE
  // ==========================================

  const [user, setUser] = useState(null)
  const [selectedExams, setSelectedExams] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationsError, setRecommendationsError] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedVideoFile, setSelectedVideoFile] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [youtubeUrl, setYoutubeUrl] = useState('')

  // ── In-App Video Player ──
  const [videoModal, setVideoModal] = useState(null)
  // videoModal = { embedUrl: string, title: string } | null


  // ==========================================
  // FETCH USER FROM SUPABASE
  // ==========================================

  useEffect(() => {

    const getUserData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        setUser(currentUser)
        const exams = currentUser.user_metadata?.selected_exams || []
        setSelectedExams(Array.isArray(exams) ? exams : [exams])
        console.log('Selected exams loaded in Home:', exams)
      }
    }

    getUserData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user)
          const exams = session.user.user_metadata?.selected_exams || []
          setSelectedExams(Array.isArray(exams) ? exams : [exams])
          console.log('Selected exams loaded from session:', exams)
        } else {
          setUser(null)
          setSelectedExams([])
        }
      }
    )

    return () => { subscription.unsubscribe() }

  }, [])


  // ==========================================
  // CLOSE VIDEO MODAL ON ESC KEY
  // ==========================================

  useEffect(() => {

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && videoModal) {
        setVideoModal(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }

  }, [videoModal])


  // ==========================================
  // MAP EXAM NAMES
  // ==========================================

  const selectedExamNames = selectedExams
    .filter(Boolean)
    .map((exam) => {
      const raw = String(exam).toLowerCase()
      if (raw === 'psc') return 'PSC'
      if (raw === 'ssc') return 'SSC'
      if (raw === 'upsc') return 'UPSC'
      if (raw === 'banking' || raw === 'bank') return 'Banking'
      if (raw === 'railway' || raw === 'railways') return 'Railway'
      return String(exam).toUpperCase()
    })


  // ==========================================
  // FOCUS YOUTUBE INPUT
  // ==========================================

  const focusYoutubeInput = () => {
    const el = document.getElementById('sd-yt-link-input')
    if (el) {
      el.focus()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }


  // ==========================================
  // EXAM VISUAL METADATA
  // ==========================================

  const getExamMetadata = (examName) => {
    const name = String(examName || '').trim().toUpperCase()

    if (name.includes('PSC')) return { icon: <FiAward size={20} />, accentClass: 'sd-accent-psc', subtitle: 'State PSC & Govt Services' }
    if (name.includes('SSC')) return { icon: <FiBookOpen size={20} />, accentClass: 'sd-accent-ssc', subtitle: 'Staff Selection Commission' }
    if (name.includes('UPSC')) return { icon: <FiCompass size={20} />, accentClass: 'sd-accent-upsc', subtitle: 'Civil Services Examination' }
    if (name.includes('BANK')) return { icon: <FiBriefcase size={20} />, accentClass: 'sd-accent-bank', subtitle: 'IBPS, SBI & Banking Services' }
    if (name.includes('RAILWAY')) return { icon: <FiTrendingUp size={20} />, accentClass: 'sd-accent-railway', subtitle: 'RRB & Indian Railways' }

    return { icon: <FiFolder size={20} />, accentClass: 'sd-accent-other', subtitle: 'Competitive Exam Track' }
  }


  // ==========================================
  // NORMALIZE EXAM KEY
  // ==========================================

  const normalizeExamKey = (examName) => {
    const raw = String(examName || '').trim().toLowerCase()
    if (raw === 'upsc' || raw.includes('upsc')) return 'upsc'
    if (raw === 'psc' || raw.includes('psc')) return 'psc'
    if (raw === 'ssc' || raw.includes('ssc')) return 'ssc'
    if (raw === 'bank' || raw === 'banking' || raw.includes('bank')) return 'banking'
    if (raw === 'railway' || raw === 'railways' || raw.includes('railway')) return 'railway'
    return raw
  }


  // ==========================================
  // GET YOUTUBE THUMBNAIL
  // ==========================================

  const getYoutubeThumbnail = (url) => {
    if (!url) return null
    try {
      const parsed = new URL(url)
      const videoId = parsed.searchParams.get('v')
      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      if (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') {
        const id = parsed.pathname.replace(/^\/+/, '').split('/')[0]
        if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
      }
      if (parsed.hostname === 'youtube.com' || parsed.hostname === 'www.youtube.com') {
        const parts = parsed.pathname.split('/')
        if (parts[1] === 'live' && parts[2]) return `https://img.youtube.com/vi/${parts[2]}/hqdefault.jpg`
      }
      return null
    } catch { return null }
  }


  // ==========================================
  // GET YOUTUBE EMBED URL
  // Converts any YouTube URL → embeddable iframe URL
  // ==========================================

  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null
    try {
      const parsed = new URL(url)

      // Playlist only: youtube.com/playlist?list=PLxxx
      if (
        (parsed.hostname === 'youtube.com' || parsed.hostname === 'www.youtube.com') &&
        parsed.pathname === '/playlist'
      ) {
        const listId = parsed.searchParams.get('list')
       if (listId) return `https://www.youtube.com/embed/videoseries?list=${listId}`
      }

      const videoId = parsed.searchParams.get('v')
      const listId = parsed.searchParams.get('list')

      if (videoId && listId) return `https://www.youtube.com/embed/${videoId}?list=${listId}&autoplay=1`
      if (videoId) return `https://www.youtube.com/embed/${videoId}?autoplay=1`

      // Short URL: youtu.be/ID
      if (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') {
        const id = parsed.pathname.replace(/^\/+/, '').split('/')[0]
        const list = parsed.searchParams.get('list')
        if (id && list) return `https://www.youtube.com/embed/${id}?list=${list}&autoplay=1`
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`
      }

      // Live: youtube.com/live/ID
      if (parsed.hostname === 'youtube.com' || parsed.hostname === 'www.youtube.com') {
        const parts = parsed.pathname.split('/')
        if (parts[1] === 'live' && parts[2]) return `https://www.youtube.com/embed/${parts[2]}?autoplay=1`
      }

      return null
    } catch { return null }
  }


  // ==========================================
  // OPEN VIDEO IN-APP
  // ==========================================

  const openVideoInApp = (url, title) => {
    const embedUrl = getYoutubeEmbedUrl(url)
    if (!embedUrl) {
      // Fallback: open Chrome if URL can't be embedded
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    setVideoModal({ embedUrl, title: title || 'YouTube Player' })
  }


  // ==========================================
  // SUPABASE RECOMMENDATIONS
  // ==========================================

  useEffect(() => {

    let cancelled = false

    const fetchRecommendations = async () => {

      if (!user || selectedExamNames.length === 0) return

      setRecommendationsLoading(true)
      setRecommendationsError('')

      const { data, error } = await supabase
        .from('exam_recommendations')
        .select(`
          id,
          exam_id,
          exam_name,
          content_type,
          title,
          description,
          youtube_url,
          thumbnail_url,
          channel_name,
          is_active
        `)
        .eq('is_active', true)
        .order('id', { ascending: true })

      if (cancelled) return

      if (error) {
        console.error('Error loading exam recommendations:', error)
        setRecommendations([])
        setRecommendationsError('Unable to load recommendations right now.')
        setRecommendationsLoading(false)
        return
      }

      const selectedKeys = selectedExamNames.map(normalizeExamKey)
      const filtered = (data || []).filter((item) => {
        const itemKey = normalizeExamKey(item.exam_id || item.exam_name)
        return selectedKeys.includes(itemKey)
      })

      setRecommendations(filtered)
      setRecommendationsLoading(false)
      console.log('Supabase recommendations loaded:', filtered)
    }

    fetchRecommendations()
    return () => { cancelled = true }

  }, [user, selectedExamNames.join('|')])


  // ==========================================
  // GET RECOMMENDATION BY EXAM
  // ==========================================

  const getRecommendation = (examName) => {
    const key = normalizeExamKey(examName)
    return recommendations.find(
      (item) => normalizeExamKey(item.exam_id || item.exam_name) === key
    ) || null
  }


  // ==========================================
  // SAMPLE DATA
  // ==========================================

  const sampleTranscripts = [
    { id: 1, title: 'Introduction to Artificial Intelligence', timeAgo: '2 hours ago', source: 'youtube', duration: '12:45' },
    { id: 2, title: 'Machine Learning Basics', timeAgo: '1 day ago', source: 'youtube', duration: '18:32' },
    { id: 3, title: 'Data Structures in C++ (Part 1)', timeAgo: '2 days ago', source: 'uploaded', duration: '15:20' },
    { id: 4, title: 'DBMS Complete Course', timeAgo: '3 days ago', source: 'youtube', duration: '22:10' },
    { id: 5, title: 'Operating Systems Full Lecture', timeAgo: '4 days ago', source: 'uploaded', duration: '25:15' }
  ]

  const samplePdfs = [
    { id: 1, name: 'SSC CGL Quantitative Aptitude Notes.pdf', category: 'SSC', size: '12.4 MB', date: '2 days ago' },
    { id: 2, name: 'Kerala PSC Current Affairs.pdf', category: 'PSC', size: '6.1 MB', date: '1 week ago' },
    { id: 3, name: 'Bank PO Reasoning Notes.pdf', category: 'Bank', size: '9.3 MB', date: '1 week ago' }
  ]
 //funtion for folder dynamiccally
  const pdfCategories = selectedExamNames.map((examName) => {
  const key = normalizeExamKey(examName)

  const categoryNames = {
    psc: 'PSC',
    ssc: 'SSC',
    upsc: 'UPSC',
    banking: 'Bank',
    railway: 'Railway',
  }

  const categoryEmojis = {
    psc: '🏛️',
    ssc: '🎓',
    upsc: '🏛️',
    banking: '🏦',
    railway: '🚆',
  }

  const displayName = categoryNames[key] || examName

  // Temporary count from existing sample PDF data
  const pdfCount = samplePdfs.filter(
    (pdf) => normalizeExamKey(pdf.category) === key
  ).length

  return {
    name: displayName,
    count: `${pdfCount} PDF${pdfCount === 1 ? '' : 's'}`,
    emoji: categoryEmojis[key] || '📁',
  }
})


  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="sd-home-page">
      <div className="sd-home-container">


        {/* ── 1. HEADER ── */}
        <header className="sd-header">
          <div className="sd-header-left">
            <button className="sd-icon-btn" aria-label="Menu">
              <FiMenu size={20} />
            </button>
            <div className="sd-brand-wrapper">
              <div className="sd-brand-logo">
                <div className="sd-logo-box"><FiFileText size={18} /></div>
                <span className="sd-brand-text">
                  SmartDoc <span className="sd-ai-tag">AI</span>
                </span>
              </div>
              <span className="sd-tagline">Transcribe. Learn. Succeed.</span>
            </div>
          </div>
          <div className="sd-header-right">
            <button className="sd-icon-btn" aria-label="Notifications">
              <FiBell size={20} />
              <span className="sd-notif-dot">3</span>
            </button>
            <button className="sd-icon-btn" aria-label="User Profile">
              <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--sd-primary)' }}>
                {(user?.user_metadata?.full_name || 'M').charAt(0).toUpperCase()}
              </span>
            </button>
          </div>
        </header>


        {/* ── 2. GREETING ── */}
        <div className="sd-greeting-row">
          <div>
            <h1 className="sd-greeting-title">
              Hello, {user?.user_metadata?.full_name || 'User'}{' '}
              <span className="wave-emoji">👋</span>
            </h1>
            <p className="sd-greeting-subtitle">
              Turn videos into transcripts and smart study notes.
            </p>
          </div>
          <div className="sd-banner-card" onClick={() => navigate('/documents')}>
            <div className="sd-banner-icon">📝</div>
            <div className="sd-banner-info">
              <h4>Your learning, organized</h4>
              <p>Transcribe videos, generate notes and save as PDFs.</p>
            </div>
            <button className="sd-banner-arrow" aria-label="Go">
              <FiArrowRight size={16} />
            </button>
          </div>
        </div>


        {/* ── 3. RECOMMENDED FOR YOU ── */}
        {selectedExamNames.length > 0 && (
          <section className="sd-selected-exams-section">

            <div className="sd-selected-exams-header">
              <div className="sd-selected-exams-title-group">
                <div className="sd-selected-exams-title">
                  <FiStar className="sd-sparkle-icon" />
                  <h2>Recommended for you</h2>
                </div>
                <p className="sd-selected-exams-subtitle">
                  Based on your selected exam preferences
                </p>
              </div>
              <span className="sd-exam-count-badge">
                {selectedExamNames.length}{' '}
                {selectedExamNames.length === 1 ? 'Exam' : 'Exams'} Active
              </span>
            </div>

            <div className="sd-selected-exams-grid">
              {selectedExamNames.map((examName, index) => {
                const meta = getExamMetadata(examName)
                return (
                  <div
                    key={`${examName}-${index}`}
                    className={`sd-selected-exam-card ${meta.accentClass}`}
                  >
                    <div className="sd-selected-exam-card-top">
                      <div className="sd-selected-exam-icon-wrapper">{meta.icon}</div>
                      <div className="sd-selected-exam-badge">
                        <FiCheck size={12} />
                        <span>Selected</span>
                      </div>
                    </div>
                    <div className="sd-selected-exam-content">
                      <h3 className="sd-selected-exam-name">{examName}</h3>
                      <p className="sd-selected-exam-sub">{meta.subtitle}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="sd-recommended-content-divider" />

            <div className="sd-youtube-recommendations">
              <div className="sd-youtube-recommendations-header">
                <div>
                  <div className="sd-youtube-recommendations-title">
                    <div className="sd-recommendation-title-icon">
                      <FiYoutube size={18} />
                    </div>
                    <h3>Recommended YouTube Content</h3>
                  </div>
                  <p>Curated learning content for each selected exam</p>
                </div>
              </div>

              <div className="sd-recommendation-list">
                {selectedExamNames.map((examName, index) => {
                  const meta = getExamMetadata(examName)
                  const recommendation = getRecommendation(examName)

                  return (
                    <article
                      key={`recommendation-${examName}-${index}`}
                      className={`sd-recommendation-card ${meta.accentClass}`}
                    >

                      {/* Exam identity */}
                      <div className="sd-recommendation-exam">
                        <div className="sd-recommendation-exam-icon">{meta.icon}</div>
                        <div>
                          <span>Recommended for</span>
                          <strong>{examName}</strong>
                        </div>
                      </div>

                      {/* Thumbnail */}
                      <div className="sd-recommendation-thumbnail">
                        {recommendationsLoading ? (
                          <div className="sd-recommendation-thumbnail-pattern">
                            <div className="sd-play-button">
                              <FiPlay size={20} fill="currentColor" />
                            </div>
                          </div>
                        ) : (() => {
                          const thumbnail =
                            recommendation?.thumbnail_url ||
                            getYoutubeThumbnail(recommendation?.youtube_url)

                          if (!thumbnail) {
                            return (
                              <div className="sd-recommendation-thumbnail-pattern">
                                <div className="sd-play-button">
                                  <FiPlay size={20} fill="currentColor" />
                                </div>
                              </div>
                            )
                          }

                          return (
                            <img
                              src={thumbnail}
                              alt={recommendation?.title || `${examName} recommendation`}
                              className="sd-recommendation-thumbnail-image"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                                const fallback = e.currentTarget.parentElement?.querySelector(
                                  '.sd-recommendation-thumbnail-pattern'
                                )
                                if (fallback) fallback.style.display = 'flex'
                              }}
                            />
                          )
                        })()}
                        <div className="sd-youtube-small-logo">
                          <FiYoutube size={15} />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="sd-recommendation-info">
                        {recommendationsLoading ? (
                          <>
                            <div className="sd-recommendation-type">
                              <span className="sd-recommendation-type-icon">
                                <FiList size={13} />
                              </span>
                              Loading
                            </div>
                            <h4>Loading {examName} recommendations...</h4>
                            <p>Fetching curated YouTube content for this exam.</p>
                          </>
                        ) : recommendation ? (
                          <>
                            <div className="sd-recommendation-type">
                              <span className="sd-recommendation-type-icon">
                                {String(recommendation.content_type || '').toLowerCase() === 'video'
                                  ? <FiPlay size={13} />
                                  : <FiList size={13} />
                                }
                              </span>
                              {String(recommendation.content_type || 'Content').replace(/^./, (c) => c.toUpperCase())}
                            </div>

                            <h4>{recommendation.title}</h4>

                            <p>
                              {recommendation.description ||
                                `Recommended learning content for ${examName}.`}
                            </p>

                            <div className="sd-recommendation-meta">
                              <span>
                                {recommendation.channel_name ||
                                  recommendation.exam_name ||
                                  `${examName} Learning`}
                              </span>
                              <span>•</span>
                              <span>
                                {String(recommendation.content_type || 'Content').toLowerCase() === 'playlist'
                                  ? 'Playlist'
                                  : 'Video'}
                              </span>
                            </div>

                            {/* ✅ Opens in-app player */}
                            <button
                              type="button"
                              className="sd-recommendation-watch-btn"
                              onClick={() => {
                                if (!recommendation.youtube_url) return
                                openVideoInApp(recommendation.youtube_url, recommendation.title)
                              }}
                            >
                              <FiPlay size={14} />
                              {String(recommendation.content_type || '').toLowerCase() === 'video'
                                ? 'Watch Video'
                                : 'Watch Playlist'}
                              <FiArrowRight size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="sd-recommendation-type">
                              <span className="sd-recommendation-type-icon">
                                <FiList size={13} />
                              </span>
                              Coming Soon
                            </div>
                            <h4>{examName} recommendations</h4>
                            <p>No active YouTube recommendation has been added for this exam yet.</p>
                            <div className="sd-recommendation-meta">
                              <span>{examName} Learning</span>
                            </div>
                            <button
                              type="button"
                              className="sd-recommendation-watch-btn"
                              disabled
                            >
                              <FiPlay size={14} />
                              No Content Yet
                            </button>
                          </>
                        )}
                      </div>

                    </article>
                  )
                })}
              </div>

              {recommendationsError && (
                <p style={{ marginTop: '12px', color: 'var(--sd-text-muted)', fontSize: '0.8rem' }}>
                  {recommendationsError}
                </p>
              )}

            </div>
          </section>
        )}


        {/* ── 4. YOUTUBE TRANSCRIPT ── */}
        <div className="sd-yt-hero-card">
          <div className="sd-yt-card-header">
            <div className="sd-yt-red-box"><FiYoutube size={26} /></div>
            <div>
              <h2>YouTube Transcript</h2>
              <p>Paste a YouTube video link to get started</p>
            </div>
          </div>
          <div className="sd-yt-form">
            <div className="sd-yt-input-wrapper">
              <FiLink size={18} className="sd-input-link-icon" />
              <input
                id="sd-yt-link-input"
                type="text"
                placeholder="Paste YouTube URL here..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="sd-yt-input"
              />
            </div>
            <button className="sd-btn-transcribe" type="button">
              <FiStar size={18} />
              Transcribe
            </button>
          </div>
          <div className="sd-yt-badges">
            <span className="sd-badge"><span className="sd-icon-indigo">✓</span> Accurate Transcription</span>
            <span className="sd-badge"><span className="sd-icon-purple">⚡</span> Fast Processing</span>
            <span className="sd-badge"><span className="sd-icon-blue">🛡️</span> Secure & Private</span>
          </div>
        </div>


        {/* ── 5. DUAL FEATURE CARDS ── */}
        <div className="sd-dual-features">

          <div className="sd-feature-card sd-card-yt">
            <div className="sd-feature-content">
              <div className="sd-feature-icon-wrapper red"><FiYoutube size={22} /></div>
              <h3>YouTube Videos</h3>
              <p>Transcribe any YouTube videos and get accurate transcripts.</p>
              <button className="sd-btn-card-action pink" onClick={focusYoutubeInput}>
                Start Now <FiArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="sd-feature-card sd-card-recorded">
            <div className="sd-feature-content">
              <div className="sd-feature-icon-wrapper blue"><FiVideo size={22} /></div>
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
          </div>

        </div>


        {/* ── 6. MIDDLE GRID ── */}
        <div className="sd-middle-grid">

          <div className="sd-left-col">
            <div className="sd-section-header">
              <h2>Recent Transcripts</h2>
              <button className="sd-link-btn" onClick={() => navigate('/documents')}>View All</button>
            </div>
            <div className="sd-transcripts-card-list">
              {sampleTranscripts.map((item) => (
                <div
                  key={item.id}
                  className="sd-transcript-row"
                  onClick={() => navigate('/documents')}
                >
                  <div className="sd-thumb-box">
                    <div className="sd-play-overlay">▶</div>
                  </div>
                  <div className="sd-transcript-details">
                    <h4 className="sd-transcript-title">{item.title}</h4>
                    <div className="sd-transcript-meta">
                      <span>{item.timeAgo}</span>
                      <span>•</span>
                      <span className={`source-tag ${item.source}`}>
                        {item.source === 'youtube' ? 'YouTube' : 'Uploaded'}
                      </span>
                    </div>
                  </div>
                  <span className="sd-duration-pill">{item.duration}</span>
                  <button
                    className="sd-options-btn"
                    aria-label="Options"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FiMoreVertical size={16} />
                  </button>
                </div>
              ))}
              <button className="sd-btn-view-all-full" onClick={() => navigate('/documents')}>
                View All Transcripts <FiArrowRight size={14} />
              </button>
            </div>
          </div>

          <div className="sd-right-col">

            <div>
              <h2 className="sd-col-title">Quick Actions</h2>
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
                  <div className="sd-tile-icon blue"><FiVideo size={20} /></div>
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
                  <div className="sd-tile-icon violet"><FiDownload size={20} /></div>
                  <span>Downloaded PDFs</span>
                </div>

              </div>
            </div>

            <div className="sd-recent-pdfs-section">
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
                    <button
                      className="sd-pdf-dl-btn"
                      aria-label="Download PDF"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FiDownload size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>


        {/* ── 7. PDF CATEGORIES ── */}
        <div className="sd-categories-section">
          <div className="sd-section-header">
            <div>
              <h2>PDF Categories</h2>
              <span className="sub-tag">(Saved & Organized)</span>
            </div>
            <button className="sd-link-btn" onClick={() => navigate('/downloads')}>View All</button>
          </div>
          <div className="sd-categories-grid">
            {pdfCategories.map((cat, idx) =>  (
              <div
                key={idx}
                className="sd-category-card"
                onClick={() => navigate('/downloads', { state: { category: cat.name } })}
              >
                <span className="sd-cat-emoji">{cat.emoji}</span>
                <div className="sd-cat-text">
                  <h4>{cat.name}</h4>
                  <p>{cat.count}</p>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* ── 8. UPLOAD VIDEO MODAL ── */}
        {showUploadModal && (
          <div className="sd-modal-overlay" onClick={() => setShowUploadModal(false)}>
            <div className="sd-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="sd-modal-header">
                <h3>Upload Recorded Video</h3>
                <button className="sd-modal-close" onClick={() => setShowUploadModal(false)}>
                  <FiX size={20} />
                </button>
              </div>
              <div className="sd-modal-body">
                <div className="sd-dropzone">
                  <FiUploadCloud size={36} className="sd-drop-icon" />
                  <p className="sd-drop-title">
                    Drag & Drop video file here or{' '}
                    <label className="sd-browse-link">
                      browse
                      <input
                        type="file"
                        accept="video/*"
                        className="sd-hidden-file"
                        onChange={(e) => setSelectedVideoFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </p>
                  <p className="sd-drop-hint">Supports MP4, MOV, AVI, MKV (Max 500MB)</p>
                  {selectedVideoFile && (
                    <div className="sd-file-selected-badge">Selected: {selectedVideoFile.name}</div>
                  )}
                </div>
                <div className="sd-modal-footer">
                  <button className="sd-btn-cancel" onClick={() => setShowUploadModal(false)}>
                    Cancel
                  </button>
                  <button
                    className="sd-btn-submit"
                    disabled={!selectedVideoFile}
                    onClick={() => { setShowUploadModal(false); setSelectedVideoFile(null) }}
                  >
                    Upload & Transcribe
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* ── 9. ADD MENU ── */}
        {showAddMenu && (
          <div className="sd-add-menu-overlay" onClick={() => setShowAddMenu(false)}>
            <div className="sd-add-popover" onClick={(e) => e.stopPropagation()}>
              <h4>Create New</h4>
              <button onClick={() => { setShowAddMenu(false); focusYoutubeInput() }}>
                <FiYoutube size={18} className="red-icon" /> YouTube Video
              </button>
              <button onClick={() => { setShowAddMenu(false); navigate('/multiple-videos') }}>
                <FiLayers size={18} className="purple-icon" /> Multiple YouTube Videos
              </button>
              <button onClick={() => { setShowAddMenu(false); setShowUploadModal(true) }}>
                <FiVideo size={18} className="blue-icon" /> Upload Recorded Video
              </button>
            </div>
          </div>
        )}


        {/* ── 10. BOTTOM NAVIGATION ── */}
        <nav className="sd-bottom-nav">

          <button
            className={`sd-nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          >
            <FiHome size={20} className="sd-nav-icon" />
            <span className="sd-nav-label">Home</span>
          </button>

          <button
            className={`sd-nav-item ${activeTab === 'transcripts' ? 'active' : ''}`}
            onClick={() => { setActiveTab('transcripts'); navigate('/transcript-summary') }}
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
            onClick={() => { setActiveTab('downloads'); navigate('/downloads') }}
          >
            <FiDownload size={20} className="sd-nav-icon" />
            <span className="sd-nav-label">Downloads</span>
          </button>

          <button
            className={`sd-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => { setActiveTab('profile'); navigate('/profile') }}
          >
            <FiUser size={20} className="sd-nav-icon" />
            <span className="sd-nav-label">Profile</span>
          </button>

        </nav>

      </div>


      {/* ══════════════════════════════════════════
          11. IN-APP YOUTUBE PLAYER MODAL  ✅ NEW
      ══════════════════════════════════════════ */}
      {videoModal && (
        <div
          className="sd-video-modal-overlay"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="sd-video-modal-card"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Header */}
            <div className="sd-video-modal-header">
              <div className="sd-video-modal-title">
                <div className="sd-yt-red-box" style={{ width: 32, height: 32 }}>
                  <FiYoutube size={18} />
                </div>
                <h3>{videoModal.title}</h3>
              </div>
              <button
                className="sd-modal-close"
                onClick={() => setVideoModal(null)}
                aria-label="Close player"
              >
                <FiX size={22} />
              </button>
            </div>

            {/* iframe Player */}
            <div className="sd-video-iframe-wrapper">
              <iframe
                src={videoModal.embedUrl}
                title={videoModal.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="sd-video-iframe"
              />
            </div>

            {/* Footer */}
            <div className="sd-video-modal-footer">
              <p className="sd-video-modal-hint">▶ Playing inside SmartDoc AI</p>
              <button
                className="sd-video-open-yt-btn"
                onClick={() =>
                  window.open(
                    videoModal.embedUrl
                      .replace('embed/videoseries', 'playlist')
                      .replace('/embed/', '/watch?v=')
                      .replace('?autoplay=1', '')
                      .replace('&autoplay=1', ''),
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              >
                <FiYoutube size={15} />
                Open in YouTube
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}