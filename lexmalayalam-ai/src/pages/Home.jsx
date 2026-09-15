import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { getMatchedNotifications } from '../utils/notificationEligibility'
import {
  FiMenu, FiBell, FiArrowRight, FiYoutube, FiLink, FiVideo, FiDownload, FiHome,
  FiFileText, FiPlus, FiUser, FiLayers, FiFolder, FiCheck, FiBriefcase, FiCompass,
  FiAward, FiBookOpen, FiX, FiUploadCloud, FiStar, FiTrendingUp, FiPlay,
  FiCalendar, FiBarChart2, FiChevronDown, FiClock
} from 'react-icons/fi'
import './Home.css'

// ── helpers ──────────────────────────────────────────────
const safeJson = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const getGreeting = () => {
  const h = new Date().getHours()
  return h < 12 ? ['Good Morning', '☀️'] : h < 17 ? ['Good Afternoon', '☀️'] : ['Good Evening', '🌙']
}
const EXAM_LABELS = { psc: 'PSC', ssc: 'SSC', upsc: 'UPSC', bank: 'Banking', banking: 'Banking', railway: 'Railway', railways: 'Railway' }
const normalizeExamKey = (name) => {
  const raw = String(name || '').trim().toLowerCase()
  if (raw.includes('upsc')) return 'upsc'
  if (raw.includes('psc')) return 'psc'
  if (raw.includes('ssc')) return 'ssc'
  if (raw.includes('bank')) return 'banking'
  if (raw.includes('railway')) return 'railway'
  return raw
}
const getExamMetadata = (name) => {
  const k = normalizeExamKey(name)
  const map = {
    psc: [<FiAward size={20} />, 'sd-accent-psc', 'State PSC & Govt Services'],
    ssc: [<FiBookOpen size={20} />, 'sd-accent-ssc', 'Staff Selection Commission'],
    upsc: [<FiCompass size={20} />, 'sd-accent-upsc', 'Civil Services Examination'],
    banking: [<FiBriefcase size={20} />, 'sd-accent-bank', 'IBPS, SBI & Banking Services'],
    railway: [<FiTrendingUp size={20} />, 'sd-accent-railway', 'RRB & Indian Railways'],
  }
  const m = map[k] || [<FiFolder size={20} />, 'sd-accent-other', 'Competitive Exam Track']
  return { icon: m[0], accentClass: m[1], subtitle: m[2] }
}

const parseYoutube = (url) => {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    const list = u.searchParams.get('list')
    let id = u.searchParams.get('v')
    if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0]
    const m = u.pathname.match(/^\/(?:live|shorts|embed)\/([^/?]+)/)
    if (m) id = m[1]
    return { id, list, isPlaylist: !id && u.pathname === '/playlist' && !!list }
  } catch { return { id: null, list: null } }
}
const getYoutubeThumbnail = (url) => {
  const { id } = parseYoutube(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}
const getYoutubeEmbedUrl = (url) => {
  if (!url) return null
  const { id, list, isPlaylist } = parseYoutube(url)
  if (isPlaylist) return `https://www.youtube.com/embed/videoseries?list=${list}`
  if (id && list) return `https://www.youtube.com/embed/${id}?list=${list}&autoplay=1`
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`
  return null
}

// ── data hooks ───────────────────────────────────────────
function useUser() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null)).catch(() => {})
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user || null))
    return () => subscription.unsubscribe()
  }, [])
  return user
}

// Same sources as Notifications.jsx: exam_notifications + user_qualifications + eligibility util
function useNotifications(user) {
  const [state, setState] = useState({ loading: true, items: [], newCount: 0 })
  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      try {
        const [{ data: rows, error }, { data: quals }] = await Promise.all([
          supabase.from('exam_notifications').select('*').eq('is_active', true).order('application_last_date', { ascending: true }),
          supabase.from('user_qualifications')
            .select('full_name, date_of_birth, age, category, highest_qualification, degree, specialization, year_of_passing')
            .eq('user_id', user.id),
        ])
        if (error) throw error
        const list = (quals || []).filter((q) => q?.highest_qualification)
        const profile = list.length ? {
          fullName: list[0].full_name || '', dateOfBirth: list[0].date_of_birth || '', age: list[0].age ?? null,
          category: list[0].category || '',
          qualifications: list.map((q) => ({ highestQualification: q.highest_qualification, degree: q.degree || '', specialization: q.specialization || '', yearOfPassing: q.year_of_passing ?? null })),
        } : null
        const relevant = profile ? getMatchedNotifications(rows || [], profile) : []
        const weekAgo = Date.now() - 7 * 864e5
        const fresh = relevant.filter((n) => Date.parse(n.created_at || n.updated_at || '') >= weekAgo)
        if (alive) setState({ loading: false, items: relevant, fresh, newCount: fresh.length })
      } catch (e) {
        console.error('Home notifications failed:', e)
        if (alive) setState({ loading: false, items: [], fresh: [], newCount: 0 })
      }
    })()
    return () => { alive = false }
  }, [user])
  return state
}

// Reads the StudyPlan page's localStorage structures
function useStudyPlan() {
  const selectedExamId = localStorage.getItem('smartdoc-study-plan:exam-id')
  const lastPlanExamId = localStorage.getItem('smartdoc-study-plan:last-exam-id')
  const examId = selectedExamId
  const savedExamPlan = examId
    ? safeJson(`smartdoc-study-plan:plan:${examId}`)
    : null
  const lastPlan = lastPlanExamId && String(lastPlanExamId) === String(examId)
    ? safeJson('smartdoc-study-plan:last')
    : null
  const plan = savedExamPlan?.weeks?.length
    ? savedExamPlan
    : examId && lastPlan?.weeks?.length
      ? lastPlan
      : null
  const done = (safeJson('smartdoc-study-plan:done') || {})[String(examId ?? 'no-exam')] || {}
  if (!plan?.weeks?.length) return { plan: null, today: [], progress: null, sectionStats: [] }
  const stats = {}
  let total = 0, completed = 0
  const today = []
  plan.weeks.forEach((w, wi) => (w.days || []).forEach((d, di) => (d.tasks || []).forEach((t, ti) => {
    const isDone = !!done[`${wi}-${di}-${ti}`]
    total += 1; if (isDone) completed += 1
    const s = (stats[t.section] ||= { name: t.section, total: 0, done: 0 })
    s.total += 1; if (isDone) s.done += 1
    if (d.date === todayISO()) today.push({ ...t, done: isDone, key: `${wi}-${di}-${ti}` })
  })))
  return {
    plan, today,
    progress: total ? Math.round((completed / total) * 100) : 0,
    sectionStats: Object.values(stats).filter((s) => s.name),
  }
}

function useRecommendations(user, examKeys) {
  const [state, setState] = useState({ items: [], loading: false, error: '' })
  const keyStr = examKeys.join('|')
  useEffect(() => {
    if (!user || !examKeys.length) return
    let alive = true
    setState((s) => ({ ...s, loading: true, error: '' }))
    supabase.from('exam_recommendations')
      .select('id, exam_id, exam_name, content_type, title, description, youtube_url, thumbnail_url, channel_name, is_active')
      .eq('is_active', true).order('id', { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) return setState({ items: [], loading: false, error: 'Unable to load recommendations right now.' })
        const items = (data || []).filter((r) => examKeys.includes(normalizeExamKey(r.exam_id || r.exam_name)))
        setState({ items, loading: false, error: '' })
      })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, keyStr])
  return state
}

// ── component ────────────────────────────────────────────
export default function Home() {
  useLocation()
  const navigate = useNavigate()
  const user = useUser()
  const selectedExams = useMemo(() => {
    const raw = user?.user_metadata?.selected_exams || []
    return (Array.isArray(raw) ? raw : [raw]).filter(Boolean)
  }, [user])
  const examNames = useMemo(() => selectedExams.map((e) => EXAM_LABELS[String(e).toLowerCase()] || String(e).toUpperCase()), [selectedExams])
  const examKeys = useMemo(() => examNames.map(normalizeExamKey), [examNames])

  const notif = useNotifications(user)
  const study = useStudyPlan()
  const recs = useRecommendations(user, examKeys)

  const [filter, setFilter] = useState('all')
  const [openTodayTopic, setOpenTodayTopic] = useState('')
  const [videoModal, setVideoModal] = useState(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedVideoFile, setSelectedVideoFile] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [youtubeUrl, setYoutubeUrl] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setVideoModal(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const fullName = user?.user_metadata?.full_name || 'User'
  const [greet, greetEmoji] = getGreeting()

  const focusYoutubeInput = () => {
    const el = document.getElementById('sd-yt-link-input')
    if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
  }
  const openVideoInApp = (url, title) => {
    const embedUrl = getYoutubeEmbedUrl(url)
    if (!embedUrl) return window.open(url, '_blank', 'noopener,noreferrer')
    try {
      const w = new Set(safeJson('smartdoc-home:watched') || []); w.add(url)
      localStorage.setItem('smartdoc-home:watched', JSON.stringify([...w]))
    } catch { /* ignore */ }
    setVideoModal({ embedUrl, title: title || 'YouTube Player', url })
  }

  // Rank: today's topic > today's section > selected exam
  const rankedRecs = useMemo(() => {
    const topics = study.today.map((t) => String(t.topic || '').toLowerCase()).filter(Boolean)
    const sects = study.today.map((t) => String(t.section || '').toLowerCase()).filter(Boolean)
    const score = (r) => {
      const text = `${r.title} ${r.description || ''}`.toLowerCase()
      if (topics.some((t) => text.includes(t))) return 3
      if (sects.some((s) => text.includes(s))) return 2
      return 1
    }
    return recs.items
      .filter((r) => filter === 'all' || normalizeExamKey(r.exam_id || r.exam_name) === filter)
      .map((r) => ({ ...r, _score: score(r) }))
      .sort((a, b) => b._score - a._score)
  }, [recs.items, study.today, filter])

  const latest = notif.fresh?.[0]
  const allResults = useMemo(() => {
    const saved = safeJson('smartdoc-quiz:results')
    return Array.isArray(saved) ? saved.filter((r) => r && r.total > 0) : []
  }, [])
  const quizResults = allResults.slice(-3).reverse()
  const watched = safeJson('smartdoc-home:watched') || []
  const fmtDate = (d) => { const x = new Date(d); return isNaN(x) ? '' : x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  const streak = (() => {
    const days = new Set(allResults.map((r) => String(r.date).slice(0, 10)))
    let n = 0; const d = new Date()
    if (!days.has(todayISO())) d.setDate(d.getDate() - 1)
    for (;;) {
      const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
      if (!days.has(iso)) break
      n += 1; d.setDate(d.getDate() - 1)
    }
    return n
  })()

  const sessionsDone = study.sectionStats.reduce((n, x) => n + x.done, 0)
  const achievements = [
    allResults.length > 0 && { i: '🏆', t: 'Quiz Master', d: `Completed ${allResults.length} quiz${allResults.length === 1 ? '' : 'zes'}` },
    streak >= 2 && { i: '🔥', t: 'Consistency Pro', d: `${streak} day streak` },
    watched.length > 0 && { i: '▶️', t: 'Videos Watched', d: `${watched.length} video${watched.length === 1 ? '' : 's'}` },
    sessionsDone > 0 && { i: '📖', t: 'Study Started', d: `${sessionsDone} sessions done` },
    study.progress === 100 && { i: '🎯', t: 'Goal Seeker', d: 'Study plan completed' },
  ].filter(Boolean)
  const quickCards = [
    { icon: <FiBell size={22} />, title: 'Notifications', desc: 'Exams matched to you', to: '/notifications', tone: 'red' },
    { icon: <FiAward size={22} />, title: 'Quiz', desc: 'Practice mock tests', to: '/quiz', tone: 'blue' },
    { icon: <FiCalendar size={22} />, title: 'Timetable', desc: 'Your study plan', to: '/study-plan', tone: 'purple' },
    { icon: <FiBarChart2 size={22} />, title: 'My Results', desc: 'Recent quiz scores', to: '#results', tone: 'green' },
  ]

  return (
    <div className="sd-home-page">
      <div className="sd-home-container">

        {/* HEADER */}
        <header className="sd-header">
          <div className="sd-header-left">
            <button className="sd-icon-btn" aria-label="Menu"><FiMenu size={20} /></button>
            <div className="sd-brand-wrapper">
              <div className="sd-brand-logo">
                <div className="sd-logo-box"><FiFileText size={18} /></div>
                <span className="sd-brand-text">SmartDoc <span className="sd-ai-tag">AI</span></span>
              </div>
              <span className="sd-tagline">Transcribe. Learn. Succeed.</span>
            </div>
          </div>
          <div className="sd-header-right">
            <button className="sd-icon-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}>
              <FiBell size={20} />
              {notif.newCount > 0 && <span className="sd-notif-dot">{notif.newCount}</span>}
            </button>
            <button className="sd-user-chip" onClick={() => navigate('/profile')} aria-label="Profile">
              <span>{fullName}</span><FiChevronDown size={14} />
            </button>
          </div>
        </header>

        {/* HERO */}
        <div className="sd-hero">
          <h1 className="sd-greeting-title">{greet}, {fullName}! <span className="wave-emoji">{greetEmoji}</span></h1>
          <p className="sd-greeting-motto">Stay consistent, Keep going!</p>
          {examNames.length > 0 && (
            <p className="sd-hero-prep">You're preparing for {examNames.map((n) => <span key={n} className="sd-hero-chip">{n}</span>)} exams.</p>
          )}
          <p className="sd-greeting-subtitle">Turn videos into transcripts and smart study notes.</p>
          <p className="sd-hero-quote">“Small steps every day lead to big results.”</p>
          <div className="sd-hero-art" aria-hidden="true">📚🚀</div>
        </div>

        {/* RECOMMENDED FOR YOU */}
        <section className="sd-selected-exams-section">
          <div className="sd-selected-exams-header">
            <div className="sd-selected-exams-title-group">
              <div className="sd-selected-exams-title"><FiStar className="sd-sparkle-icon" /><h2>Recommended for you</h2></div>
              <p className="sd-selected-exams-subtitle">Based on your selected exam preferences</p>
            </div>
            {examNames.length > 0 && <span className="sd-exam-count-badge">{examNames.length} {examNames.length === 1 ? 'Exam' : 'Exams'} Active</span>}
          </div>
          {examNames.length ? (
            <div className="sd-selected-exams-grid">
              {examNames.map((name, i) => {
                const meta = getExamMetadata(name)
                return (
                  <div key={`${name}-${i}`} className={`sd-selected-exam-card ${meta.accentClass}`}>
                    <div className="sd-selected-exam-card-top">
                      <div className="sd-selected-exam-icon-wrapper">{meta.icon}</div>
                      <div className="sd-selected-exam-badge"><FiCheck size={12} /><span>Selected</span></div>
                    </div>
                    <div className="sd-selected-exam-content">
                      <h3 className="sd-selected-exam-name">{name}</h3>
                      <p className="sd-selected-exam-sub">{meta.subtitle}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="sd-empty-box">
              <p>You haven't selected any exams yet.</p>
              <button className="sd-btn-card-action blue" onClick={() => navigate('/select-exam')}>Select exams <FiArrowRight size={14} /></button>
            </div>
          )}
        </section>

        {/* QUICK ACCESS */}
        <div className="sd-quick-access">
          {quickCards.map((c) => (
            <button key={c.title} className={`sd-qa-card ${c.tone}`}
              onClick={() => c.to.startsWith('#') ? document.getElementById('sd-results')?.scrollIntoView({ behavior: 'smooth' }) : navigate(c.to)}>
              <span className="sd-qa-icon">{c.icon}{c.to === '/notifications' && notif.newCount > 0 && <i className="sd-qa-badge">{notif.newCount}</i>}</span>
              <span className="sd-qa-text"><strong>{c.title}</strong><small>{c.desc}</small></span>
              <FiArrowRight size={16} />
            </button>
          ))}
        </div>

        {/* NOTIFICATION HIGHLIGHT */}
        <div className={`sd-alert-banner ${latest ? 'fresh' : ''}`} onClick={() => navigate('/notifications')} role="button" tabIndex={0}>
          <FiBell size={22} />
          <div className="sd-alert-text">
            <strong>{notif.loading ? 'Checking notifications…' : latest ? 'New Notification Arrived!' : 'No new notifications'}</strong>
            <span>{latest ? (latest.notification_title || latest.exam_name) : 'We\'ll alert you when an exam matching your profile is announced.'}</span>
          </div>
          {latest && <span className="sd-new-pill">New</span>}
          <span className="sd-alert-link">{latest ? 'Check details' : 'View all'} <FiArrowRight size={14} /></span>
        </div>

        {/* PREPARATION + TIMETABLE */}
        <div className="sd-two-col">
          <div className="sd-stack">
          <section className="sd-panel">
            <div className="sd-section-header"><h2>Your Preparation Overview</h2>
              <button className="sd-link-btn" onClick={() => navigate('/study-plan')}>View All</button></div>
            {study.progress === null ? (
              <p className="sd-muted">Start studying to see your progress. <button className="sd-link-btn" onClick={() => navigate('/study-plan')}>Create a study plan</button></p>
            ) : (
              <div className="sd-prep">
                <div className="sd-ring" style={{ '--pct': `${study.progress * 3.6}deg` }}><div><strong>{study.progress}%</strong><span>Overall Progress</span></div></div>
                <div className="sd-prep-bars">
                  {study.sectionStats.slice(0, 5).map((s) => {
                    const pct = Math.round((s.done / s.total) * 100)
                    return <div key={s.name} className="sd-prep-row"><span>{s.name}</span><div className="sd-bar"><i style={{ width: `${pct}%` }} /></div><b>{pct}%</b></div>
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="sd-panel">
            <div className="sd-section-header"><h2>Latest Notifications</h2>
              <button className="sd-link-btn" onClick={() => navigate('/notifications')}>View All</button></div>
            {notif.items.length ? notif.items.slice(0, 3).map((n) => (
              <div key={n.id} className="sd-tt-row sd-clickable" onClick={() => navigate('/notifications')}>
                <div><strong>{(notif.fresh || []).some((f) => f.id === n.id) && <span className="sd-new-pill sm">New</span>} {n.exam_name}</strong>
                  <small>{n.application_last_date ? `Last date: ${new Date(`${String(n.application_last_date).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'See notification'}</small></div>
                <FiArrowRight size={14} />
              </div>
            )) : <p className="sd-muted">{notif.loading ? 'Loading…' : 'No matching notifications yet.'}</p>}
          </section>
          </div>

          <section className="sd-panel sd-timeline">
            <div className="sd-section-header"><h2>Today's Timetable</h2>
              <button className="sd-link-btn" onClick={() => navigate('/study-plan')}>View Timetable</button></div>
            {study.today.length ? study.today.map((t, i) => {
              const firstOpen = study.today.findIndex((x) => !x.done)
              const status = t.done ? 'Completed' : i === firstOpen ? 'Up next' : 'Upcoming'
              const topicKey = `${t.key}-${t.topic}`
              const topicWords = String(t.topic || '').toLowerCase().match(/[a-z0-9]+/g) || []
              const searchableWords = topicWords.filter((word) => word.length > 2 && !['the', 'and', 'for', 'with', 'from'].includes(word))
              const topicVideos = recs.items.filter((video) => {
                const videoText = `${video.title || ''} ${video.description || ''}`.toLowerCase()
                return videoText.includes(String(t.topic || '').toLowerCase())
                  || (searchableWords.length > 0 && searchableWords.every((word) => videoText.includes(word)))
              }).slice(0, 3)
              const topicExpanded = openTodayTopic === topicKey
              return (
                <div key={t.key} className={`sd-today-item sd-tt-${status.replace(' ', '').toLowerCase()}`}>
                  <div className="sd-tt-row">
                    <span className="sd-tl-dot">{t.done ? <FiCheck size={12} /> : null}</span>
                    <div>
                      <button type="button" className="sd-topic-video-toggle" aria-expanded={topicExpanded} onClick={() => setOpenTodayTopic(topicExpanded ? '' : topicKey)}>
                        {t.topic} <small>{topicExpanded ? 'Hide videos' : 'See topic videos'}</small>
                      </button>
                      <small>{t.section} · {t.activity} · {t.studyHours}h</small>
                    </div>
                  <span className={`sd-status ${status.replace(' ', '').toLowerCase()}`}>{status}</span>
                  </div>
                  {topicExpanded && (
                    <div className="sd-topic-videos">
                      {topicVideos.length ? topicVideos.map((video) => (
                        <article className="sd-topic-video" key={video.id}>
                          <button type="button" className="sd-topic-video-play" onClick={() => video.youtube_url && openVideoInApp(video.youtube_url, video.title)} aria-label={`Play ${video.title}`}>
                            {video.thumbnail_url && <img src={video.thumbnail_url} alt="" loading="lazy" />}
                            <FiPlay size={15} fill="currentColor" />
                          </button>
                          <div><strong>{video.title}</strong><small>{video.channel_name || 'YouTube'}</small></div>
                          {video.youtube_url && <a href={video.youtube_url} target="_blank" rel="noreferrer">Open</a>}
                        </article>
                      )) : (
                        <p>{recs.loading ? 'Loading recommendations…' : 'No saved video recommendation matches this topic yet.'}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            }) : <p className="sd-muted">{study.plan ? 'No study sessions scheduled for today.' : 'No timetable selected. Choose or create one in Study Plan to see today’s tasks here.'}</p>}
          </section>
        </div>

        {/* RECOMMENDED VIDEOS */}
        <section className="sd-panel sd-videos">
          <div className="sd-section-header"><div><h2>Recommended Videos for You</h2>
            <p className="sd-muted">Based on your exam selection and timetable</p></div></div>
          {examKeys.length > 1 && (
            <div className="sd-chips">
              {['all', ...new Set(examKeys)].map((k) => (
                <button key={k} className={`sd-chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
                  {k === 'all' ? 'All' : EXAM_LABELS[k] || k.toUpperCase()}</button>
              ))}
            </div>
          )}
          {recs.loading ? <p className="sd-muted">Loading recommendations…</p>
            : recs.error ? <p className="sd-muted">{recs.error}</p>
            : rankedRecs.length ? (
              <div className="sd-video-scroll">
                {rankedRecs.map((r) => {
                  const thumb = r.thumbnail_url || getYoutubeThumbnail(r.youtube_url)
                  return (
                    <article key={r.id} className="sd-video-card">
                      <button className="sd-video-thumb" onClick={() => r.youtube_url && openVideoInApp(r.youtube_url, r.title)} aria-label={`Play ${r.title}`}>
                        {thumb && <img src={thumb} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
                        <span className="sd-play-button"><FiPlay size={18} fill="currentColor" /></span>
                      </button>
                      <div className="sd-video-info">
                        <span className="sd-video-tag">{r.exam_name}{r._score > 1 ? ' · Matches today' : ''}</span>
                        <h4>{r.title}</h4>
                        <small>{r.channel_name || 'YouTube'} · {String(r.content_type || '').toLowerCase() === 'playlist' ? 'Playlist' : 'Video'}</small>
                        {r.youtube_url && <button className="sd-link-btn" onClick={() => window.open(r.youtube_url, '_blank', 'noopener,noreferrer')}>Open in YouTube</button>}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : <p className="sd-muted">No active recommendations for your selection yet.</p>}
        </section>

        {/* RESULTS + ACHIEVEMENTS */}
        <div className="sd-two-col" id="sd-results">
          <section className="sd-panel">
            <div className="sd-section-header"><h2>Recent Quiz Results</h2>{allResults.length > 0 && <button className="sd-link-btn" onClick={() => navigate('/quiz')}>View All</button>}</div>
            {quizResults.length ? quizResults.map((q, i) => (
              <div key={i} className="sd-tt-row"><div><strong>{q.exam} – {q.topic}</strong><small>{fmtDate(q.date)}</small></div>
                <b className="sd-score">{q.score} / {q.total}</b>
                <span className="sd-mini-ring" style={{ '--pct': `${(q.score / q.total) * 360}deg` }}><i>{Math.round((q.score / q.total) * 100)}%</i></span></div>
            )) : (<><p className="sd-muted">No quiz attempts yet</p>
              <button className="sd-link-btn" onClick={() => navigate('/quiz')}>Take a Quiz →</button></>)}
          </section>
          <section className="sd-panel">
            <div className="sd-section-header"><h2>Your Achievements</h2></div>
            {achievements.length ? <div className="sd-ach-grid">{achievements.map((x) => <div key={x.t} className="sd-ach"><b>{x.i}</b><strong>{x.t}</strong><small>{x.d}</small></div>)}</div>
              : <p className="sd-muted">Complete study sessions and quizzes to earn achievements.</p>}
          </section>
        </div>

        {/* TRANSCRIPT WORKSPACE */}
        <div className="sd-yt-hero-card">
          <div className="sd-yt-card-header">
            <div className="sd-yt-red-box"><FiYoutube size={26} /></div>
            <div><h2>Transcript &amp; PDF workspace</h2><p>Enter a YouTube link, then continue to create and download its transcript PDF.</p></div>
          </div>
          <div className="sd-yt-form">
            <div className="sd-yt-input-wrapper">
              <FiLink size={18} className="sd-input-link-icon" />
              <input id="sd-yt-link-input" type="url" placeholder="Paste YouTube URL here..." value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)} className="sd-yt-input" />
            </div>
            <button
              className="sd-btn-transcribe"
              type="button"
              disabled={!youtubeUrl.trim()}
              onClick={() => navigate('/transcript-summary', { state: { youtubeUrl: youtubeUrl.trim() } })}
            >
              <FiFileText size={18} /> Continue to PDF making
            </button>
          </div>
        </div>

        {/* UPLOAD MODAL (preserved) */}
        {showUploadModal && (
          <div className="sd-modal-overlay" onClick={() => setShowUploadModal(false)}>
            <div className="sd-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="sd-modal-header"><h3>Upload Recorded Video</h3>
                <button className="sd-modal-close" onClick={() => setShowUploadModal(false)}><FiX size={20} /></button></div>
              <div className="sd-modal-body">
                <div className="sd-dropzone">
                  <FiUploadCloud size={36} className="sd-drop-icon" />
                  <p className="sd-drop-title">Drag & Drop video file here or{' '}
                    <label className="sd-browse-link">browse
                      <input type="file" accept="video/*" className="sd-hidden-file" onChange={(e) => setSelectedVideoFile(e.target.files?.[0] || null)} />
                    </label></p>
                  <p className="sd-drop-hint">Supports MP4, MOV, AVI, MKV (Max 500MB)</p>
                  {selectedVideoFile && <div className="sd-file-selected-badge">Selected: {selectedVideoFile.name}</div>}
                </div>
                <div className="sd-modal-footer">
                  <button className="sd-btn-cancel" onClick={() => setShowUploadModal(false)}>Cancel</button>
                  <button className="sd-btn-submit" disabled={!selectedVideoFile}
                    onClick={() => { setShowUploadModal(false); setSelectedVideoFile(null) }}>Upload & Transcribe</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ADD MENU (preserved) */}
        {showAddMenu && (
          <div className="sd-add-menu-overlay" onClick={() => setShowAddMenu(false)}>
            <div className="sd-add-popover" onClick={(e) => e.stopPropagation()}>
              <h4>Create New</h4>
              <button onClick={() => { setShowAddMenu(false); focusYoutubeInput() }}><FiYoutube size={18} className="red-icon" /> YouTube Video</button>
              <button onClick={() => { setShowAddMenu(false); navigate('/multiple-videos') }}><FiLayers size={18} className="purple-icon" /> Multiple YouTube Videos</button>
              <button onClick={() => { setShowAddMenu(false); setShowUploadModal(true) }}><FiVideo size={18} className="blue-icon" /> Upload Recorded Video</button>
            </div>
          </div>
        )}

        {/* BOTTOM NAV (preserved) */}
        <nav className="sd-bottom-nav">
          <button className={`sd-nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => { setActiveTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <FiHome size={20} className="sd-nav-icon" /><span className="sd-nav-label">Home</span></button>
          <button className="sd-nav-item" onClick={() => navigate('/transcript-summary')}>
            <FiFileText size={20} className="sd-nav-icon" /><span className="sd-nav-label">Transcripts</span></button>
          <div className="sd-central-plus-wrapper">
            <button className="sd-central-plus-btn" aria-label="Add / New" onClick={() => setShowAddMenu(!showAddMenu)}><FiPlus size={26} /></button>
            <span className="sd-nav-label sd-plus-label">Add / New</span>
          </div>
          <button className="sd-nav-item" onClick={() => navigate('/downloads')}>
            <FiDownload size={20} className="sd-nav-icon" /><span className="sd-nav-label">Downloads</span></button>
          <button className="sd-nav-item" onClick={() => navigate('/profile')}>
            <FiUser size={20} className="sd-nav-icon" /><span className="sd-nav-label">Profile</span></button>
        </nav>
      </div>

      {/* IN-APP PLAYER (preserved) */}
      {videoModal && (
        <div className="sd-video-modal-overlay" onClick={() => setVideoModal(null)}>
          <div className="sd-video-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="sd-video-modal-header">
              <div className="sd-video-modal-title"><div className="sd-yt-red-box" style={{ width: 32, height: 32 }}><FiYoutube size={18} /></div><h3>{videoModal.title}</h3></div>
              <button className="sd-modal-close" onClick={() => setVideoModal(null)} aria-label="Close player"><FiX size={22} /></button>
            </div>
            <div className="sd-video-iframe-wrapper">
              <iframe src={videoModal.embedUrl} title={videoModal.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen className="sd-video-iframe" />
            </div>
            <div className="sd-video-modal-footer">
              <p className="sd-video-modal-hint">▶ Playing inside SmartDoc AI</p>
              <button className="sd-video-open-yt-btn" onClick={() => window.open(videoModal.url, '_blank', 'noopener,noreferrer')}>
                <FiYoutube size={15} /> Open in YouTube</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}