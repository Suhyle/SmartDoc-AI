import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  FiHome, FiUsers, FiMessageCircle, FiBell, FiBookOpen, FiPlay, FiBarChart2,
  FiSettings, FiLogOut, FiSearch, FiCheckCircle, FiAlertCircle, FiPlus, FiEdit2,
  FiTrash2, FiEye, FiX, FiRefreshCw, FiExternalLink
} from 'react-icons/fi'
import './AdminPanel.css'

export default function AdminPanel() {
  const navigate = useNavigate()

  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Supabase Data States
  const [usersList, setUsersList] = useState([])
  const [qualificationsList, setQualificationsList] = useState([])
  const [feedbackList, setFeedbackList] = useState([])
  const [notificationsList, setNotificationsList] = useState([])
  const [videosList, setVideosList] = useState([])

  // Loading & Action States
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [actionMessage, setActionMessage] = useState(null)

  // Modals
  const [selectedUserModal, setSelectedUserModal] = useState(null)
  const [selectedFeedbackModal, setSelectedFeedbackModal] = useState(null)
  const [notificationModal, setNotificationModal] = useState({ open: false, mode: 'add', item: null })
  const [videoModal, setVideoModal] = useState({ open: false, mode: 'add', item: null })

  // Filters
  const [feedbackFilterType, setFeedbackFilterType] = useState('all')
  const [feedbackFilterStatus, setFeedbackFilterStatus] = useState('all')
  const [notifFilterCategory, setNotifFilterCategory] = useState('all')
  const [videoFilterExam, setVideoFilterExam] = useState('all')

  // Auth & Profile Check
  const [adminUser, setAdminUser] = useState(null)

  // Load all Admin Data from Supabase
  const loadAdminData = async () => {
    setRefreshing(true)
    try {
      // 1. Get Auth User
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        setAdminUser(currentUser)
      }

      // 2. Parallel Fetch from Supabase Tables
      const [
        { data: profiles },
        { data: quals },
        { data: feedbacks },
        { data: notifs },
        { data: vids }
      ] = await Promise.all([
        supabase.from('user_profiles').select('*').order('updated_at', { ascending: false }),
        supabase.from('user_qualifications').select('*').order('updated_at', { ascending: false }),
        supabase.from('feedback').select('*').order('created_at', { ascending: false }),
        supabase.from('exam_notifications').select('*').order('created_at', { ascending: false }),
        supabase.from('exam_recommendations').select('*').order('id', { ascending: true })
      ])

      if (profiles) setUsersList(profiles)
      if (quals) setQualificationsList(quals)
      if (feedbacks) setFeedbackList(feedbacks)
      if (notifs) setNotificationsList(notifs)
      if (vids) setVideosList(vids)

    } catch (err) {
      console.error('Error fetching admin data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAdminData()
  }, [])

  // Admin Logout Handler
  const handleLogout = async () => {
    await supabase.auth.signOut()
    sessionStorage.removeItem('smartdoc_admin_session')
    navigate('/admin-login')
  }

  // Flash Message Helper
  const flash = (type, text) => {
    setActionMessage({ type, text })
    setTimeout(() => setActionMessage(null), 4000)
  }

  // Combined User Display Data (Merges user_profiles + user_qualifications)
  const combinedUsers = useMemo(() => {
    const map = new Map()

    // Add profiles first
    usersList.forEach((p) => {
      map.set(p.id, {
        id: p.id,
        name: p.full_name || 'Anonymous User',
        email: p.email || 'No email provided',
        dateOfBirth: p.date_of_birth || '',
        category: p.category || '',
        qualifications: p.qualifications || [],
        joined: p.updated_at ? new Date(p.updated_at).toLocaleDateString() : 'Recent',
        status: p.role === 'admin' ? 'Administrator' : 'Active'
      })
    })

    // Complement with qualifications if profile missing
    qualificationsList.forEach((q) => {
      if (!map.has(q.user_id)) {
        map.set(q.user_id, {
          id: q.user_id,
          name: q.full_name || 'Student User',
          email: 'Registered User',
          dateOfBirth: q.date_of_birth || '',
          category: q.category || '',
          qualifications: [{
            highestQualification: q.highest_qualification,
            degree: q.degree,
            specialization: q.specialization,
            yearOfPassing: q.year_of_passing
          }],
          joined: q.updated_at ? new Date(q.updated_at).toLocaleDateString() : 'Recent',
          status: 'Active'
        })
      }
    })

    return Array.from(map.values())
  }, [usersList, qualificationsList])

  // Unread feedback count
  const newFeedbackCount = useMemo(() => {
    return feedbackList.filter((f) => f.status === 'new').length
  }, [feedbackList])

  // Active Notifications Count
  const activeNotifCount = useMemo(() => {
    return notificationsList.filter((n) => n.is_active !== false).length
  }, [notificationsList])

  // Filtered Lists for Search / Category
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return combinedUsers
    const q = searchQuery.toLowerCase()
    return combinedUsers.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [combinedUsers, searchQuery])

  const filteredFeedbacks = useMemo(() => {
    return feedbackList.filter((f) => {
      const matchType = feedbackFilterType === 'all' || f.feedback_type === feedbackFilterType
      const matchStatus = feedbackFilterStatus === 'all' || f.status === feedbackFilterStatus
      const matchSearch = !searchQuery.trim() ||
        (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.user_name && f.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (f.user_email && f.user_email.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchType && matchStatus && matchSearch
    })
  }, [feedbackList, feedbackFilterType, feedbackFilterStatus, searchQuery])

  const filteredNotifications = useMemo(() => {
    return notificationsList.filter((n) => {
      const matchCat = notifFilterCategory === 'all' || n.category === notifFilterCategory
      const matchSearch = !searchQuery.trim() ||
        (n.notification_title && n.notification_title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (n.exam_name && n.exam_name.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchCat && matchSearch
    })
  }, [notificationsList, notifFilterCategory, searchQuery])

  const filteredVideos = useMemo(() => {
    return videosList.filter((v) => {
      const matchExam = videoFilterExam === 'all' || v.exam_name === videoFilterExam || v.exam_id === videoFilterExam
      const matchSearch = !searchQuery.trim() ||
        (v.title && v.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (v.channel_name && v.channel_name.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchExam && matchSearch
    })
  }, [videosList, videoFilterExam, searchQuery])

  // =========================================================
  // HANDLERS: FEEDBACK ACTIONS
  // =========================================================
  const handleUpdateFeedbackStatus = async (id, newStatus, note) => {
    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status: newStatus, admin_note: note || null, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      flash('success', `Feedback status updated to "${newStatus}".`)
      setSelectedFeedbackModal(null)
      loadAdminData()
    } catch (err) {
      console.error('Feedback update error:', err)
      flash('error', 'Could not update feedback status.')
    }
  }

  // =========================================================
  // HANDLERS: NOTIFICATION CRUD
  // =========================================================
  const handleToggleNotificationActive = async (id, currentActive) => {
    try {
      const { error } = await supabase
        .from('exam_notifications')
        .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      flash('success', `Notification ${!currentActive ? 'activated' : 'deactivated'}.`)
      loadAdminData()
    } catch (err) {
      console.error('Toggle notification error:', err)
      flash('error', 'Could not update notification status.')
    }
  }

  const handleDeleteNotification = async (id) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) return
    try {
      const { error } = await supabase.from('exam_notifications').delete().eq('id', id)
      if (error) throw error
      flash('success', 'Notification deleted successfully.')
      loadAdminData()
    } catch (err) {
      console.error('Delete notification error:', err)
      flash('error', 'Could not delete notification.')
    }
  }

  const handleSaveNotification = async (formData) => {
    try {
      if (notificationModal.mode === 'add') {
        const { error } = await supabase.from('exam_notifications').insert([{
          ...formData,
          is_active: true,
          created_at: new Date().toISOString()
        }])
        if (error) throw error
        flash('success', 'New notification added successfully!')
      } else {
        const { error } = await supabase.from('exam_notifications').update({
          ...formData,
          updated_at: new Date().toISOString()
        }).eq('id', notificationModal.item.id)
        if (error) throw error
        flash('success', 'Notification updated successfully!')
      }
      setNotificationModal({ open: false, mode: 'add', item: null })
      loadAdminData()
    } catch (err) {
      console.error('Save notification error:', err)
      flash('error', 'Failed to save notification.')
    }
  }

  // =========================================================
  // HANDLERS: RECOMMENDED VIDEO CRUD
  // =========================================================
  const handleToggleVideoActive = async (id, currentActive) => {
    try {
      const { error } = await supabase
        .from('exam_recommendations')
        .update({ is_active: !currentActive })
        .eq('id', id)

      if (error) throw error
      flash('success', `Video ${!currentActive ? 'activated' : 'deactivated'}.`)
      loadAdminData()
    } catch (err) {
      console.error('Toggle video error:', err)
      flash('error', 'Could not update video status.')
    }
  }

  const handleDeleteVideo = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recommended video?')) return
    try {
      const { error } = await supabase.from('exam_recommendations').delete().eq('id', id)
      if (error) throw error
      flash('success', 'Video deleted successfully.')
      loadAdminData()
    } catch (err) {
      console.error('Delete video error:', err)
      flash('error', 'Could not delete video.')
    }
  }

  const handleSaveVideo = async (formData) => {
    try {
      if (videoModal.mode === 'add') {
        const { error } = await supabase.from('exam_recommendations').insert([{
          ...formData,
          is_active: true
        }])
        if (error) throw error
        flash('success', 'Recommended video added successfully!')
      } else {
        const { error } = await supabase.from('exam_recommendations').update(formData).eq('id', videoModal.item.id)
        if (error) throw error
        flash('success', 'Recommended video updated successfully!')
      }
      setVideoModal({ open: false, mode: 'add', item: null })
      loadAdminData()
    } catch (err) {
      console.error('Save video error:', err)
      flash('error', 'Failed to save video.')
    }
  }

  return (
    <div className="sd-ap-page">

      {/* MOBILE BACKDROP */}
      {sidebarOpen && (
        <div className="sd-ap-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      {/* LEFT SIDEBAR */}
      <aside className={`sd-ap-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sd-ap-sidebar-header">
          <div className="sd-ap-logo-box">
            <FiBookOpen size={24} />
          </div>
          <div>
            <h2>SmartDoc AI</h2>
            <span>Admin Panel</span>
          </div>
        </div>

        <nav className="sd-ap-nav">
          <button
            type="button"
            className={`sd-ap-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false) }}
          >
            <FiHome size={18} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`sd-ap-nav-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => { setActiveTab('users'); setSidebarOpen(false) }}
          >
            <FiUsers size={18} />
            <span>Users</span>
          </button>

          <button
            type="button"
            className={`sd-ap-nav-btn ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => { setActiveTab('feedback'); setSidebarOpen(false) }}
          >
            <FiMessageCircle size={18} />
            <span>Feedback</span>
            {newFeedbackCount > 0 && (
              <span className="sd-ap-nav-badge">{newFeedbackCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`sd-ap-nav-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => { setActiveTab('notifications'); setSidebarOpen(false) }}
          >
            <FiBell size={18} />
            <span>Notifications</span>
          </button>

          <button
            type="button"
            className={`sd-ap-nav-btn ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => { setActiveTab('exams'); setSidebarOpen(false) }}
          >
            <FiBookOpen size={18} />
            <span>Exams</span>
          </button>

          <button
            type="button"
            className={`sd-ap-nav-btn ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => { setActiveTab('videos'); setSidebarOpen(false) }}
          >
            <FiPlay size={18} />
            <span>Recommended Videos</span>
          </button>

          <button
            type="button"
            className={`sd-ap-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => { setActiveTab('analytics'); setSidebarOpen(false) }}
          >
            <FiBarChart2 size={18} />
            <span>Analytics</span>
          </button>

          <button
            type="button"
            className={`sd-ap-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false) }}
          >
            <FiSettings size={18} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sd-ap-sidebar-footer">
          <button type="button" className="sd-ap-logout-btn" onClick={handleLogout}>
            <FiLogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="sd-ap-main-wrapper">

        {/* TOP HEADER */}
        <header className="sd-ap-top-header">
          <button
            type="button"
            className="sd-ap-menu-toggle"
            aria-label="Toggle menu"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            <span className="sd-ap-hamburger-line" />
            <span className="sd-ap-hamburger-line" />
            <span className="sd-ap-hamburger-line" />
          </button>

          <div className="sd-ap-header-title">
            <h1>SmartDoc AI</h1>
            <span>Admin Panel</span>
          </div>

          <div className="sd-ap-search-box">
            <FiSearch size={18} className="sd-ap-search-icon" />
            <input
              type="search"
              placeholder="Search users, feedback, notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sd-ap-header-actions">
            <button
              type="button"
              className="sd-ap-refresh-btn"
              title="Refresh Data"
              onClick={loadAdminData}
              disabled={refreshing}
            >
              <FiRefreshCw size={18} className={refreshing ? 'spinning' : ''} />
            </button>

            <button
              type="button"
              className="sd-ap-notif-bell"
              aria-label="Notifications"
              onClick={() => setActiveTab('feedback')}
            >
              <FiBell size={20} />
              {newFeedbackCount > 0 && <span className="sd-ap-bell-dot" />}
            </button>

            {/* ADMIN PROFILE BADGE */}
            <div className="sd-ap-profile-badge">
              <div className="sd-ap-avatar">M</div>
              <div className="sd-ap-profile-info">
                <strong>Muhammed Suhyle</strong>
                <span>Administrator</span>
              </div>
            </div>
          </div>
        </header>

        {/* ACTION FLASH MESSAGE */}
        {actionMessage && (
          <div className={`sd-ap-flash-banner ${actionMessage.type}`}>
            {actionMessage.type === 'success' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* CONTENT VIEW BY ACTIVE TAB */}
        <div className="sd-ap-content-body">

          {/* =========================================================
              1. DASHBOARD TAB
          ========================================================= */}
          {activeTab === 'dashboard' && (
            <div className="sd-ap-tab-pane">

              <div className="sd-ap-pane-head">
                <div>
                  <h2>Dashboard</h2>
                  <p>Overview of SmartDoc AI platform and recent activity</p>
                </div>
                <div className="sd-ap-date-pill">
                  <span>Today: {new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}</span>
                </div>
              </div>

              {/* STAT CARDS */}
              <div className="sd-ap-stats-grid">
                <div className="sd-ap-stat-card blue">
                  <div className="sd-ap-stat-icon"><FiUsers size={22} /></div>
                  <div className="sd-ap-stat-data">
                    <span className="sd-ap-stat-label">Total Users</span>
                    <strong className="sd-ap-stat-value">{combinedUsers.length || '—'}</strong>
                    <span className="sd-ap-stat-sub">Registered accounts</span>
                  </div>
                </div>

                <div className="sd-ap-stat-card rose">
                  <div className="sd-ap-stat-icon"><FiMessageCircle size={22} /></div>
                  <div className="sd-ap-stat-data">
                    <span className="sd-ap-stat-label">New Feedback</span>
                    <strong className="sd-ap-stat-value">{newFeedbackCount}</strong>
                    <span className="sd-ap-stat-sub">{feedbackList.length} total feedback</span>
                  </div>
                </div>

                <div className="sd-ap-stat-card purple">
                  <div className="sd-ap-stat-icon"><FiBell size={22} /></div>
                  <div className="sd-ap-stat-data">
                    <span className="sd-ap-stat-label">Active Notifications</span>
                    <strong className="sd-ap-stat-value">{activeNotifCount}</strong>
                    <span className="sd-ap-stat-sub">From all categories</span>
                  </div>
                </div>

                <div className="sd-ap-stat-card green">
                  <div className="sd-ap-stat-icon"><FiBookOpen size={22} /></div>
                  <div className="sd-ap-stat-data">
                    <span className="sd-ap-stat-label">Recommended Videos</span>
                    <strong className="sd-ap-stat-value">{videosList.length || '—'}</strong>
                    <span className="sd-ap-stat-sub">Across study topics</span>
                  </div>
                </div>
              </div>

              {/* VISUAL SUMMARIES */}
              <div className="sd-ap-grid-2">

                {/* RECENT FEEDBACK PREVIEW */}
                <div className="sd-ap-card-box">
                  <div className="sd-ap-card-head">
                    <h3><FiMessageCircle size={18} /> Recent Feedback</h3>
                    <button type="button" className="sd-ap-link-btn" onClick={() => setActiveTab('feedback')}>
                      View All
                    </button>
                  </div>
                  {feedbackList.length === 0 ? (
                    <p className="sd-ap-empty-note">No feedback submissions yet.</p>
                  ) : (
                    <ul className="sd-ap-mini-list">
                      {feedbackList.slice(0, 4).map((f) => (
                        <li key={f.id} className="sd-ap-mini-item" onClick={() => setSelectedFeedbackModal(f)}>
                          <div className="sd-ap-avatar mini">{f.user_name?.charAt(0) || 'F'}</div>
                          <div className="sd-ap-mini-text">
                            <strong>{f.user_name || 'Anonymous User'}</strong>
                            <p>{f.description}</p>
                          </div>
                          <span className={`sd-ap-status-tag ${f.status}`}>{f.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* RECENT USERS PREVIEW */}
                <div className="sd-ap-card-box">
                  <div className="sd-ap-card-head">
                    <h3><FiUsers size={18} /> Recent Registered Users</h3>
                    <button type="button" className="sd-ap-link-btn" onClick={() => setActiveTab('users')}>
                      View All
                    </button>
                  </div>
                  {combinedUsers.length === 0 ? (
                    <p className="sd-ap-empty-note">No registered users found.</p>
                  ) : (
                    <ul className="sd-ap-mini-list">
                      {combinedUsers.slice(0, 4).map((u) => (
                        <li key={u.id} className="sd-ap-mini-item" onClick={() => setSelectedUserModal(u)}>
                          <div className="sd-ap-avatar mini">{u.name?.charAt(0) || 'U'}</div>
                          <div className="sd-ap-mini-text">
                            <strong>{u.name}</strong>
                            <p>{u.email}</p>
                          </div>
                          <span className="sd-ap-status-tag active">{u.status}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

              </div>

              {/* QUICK MANAGEMENT CARDS */}
              <div className="sd-ap-quick-row">
                <div className="sd-ap-quick-card" onClick={() => setActiveTab('users')}>
                  <FiUsers size={24} className="blue" />
                  <div>
                    <strong>Manage Users</strong>
                    <p>View registered user accounts</p>
                  </div>
                </div>

                <div className="sd-ap-quick-card" onClick={() => setActiveTab('feedback')}>
                  <FiMessageCircle size={24} className="rose" />
                  <div>
                    <strong>Feedback Management</strong>
                    <p>Respond &amp; update user feedback</p>
                  </div>
                </div>

                <div className="sd-ap-quick-card" onClick={() => setActiveTab('notifications')}>
                  <FiBell size={24} className="purple" />
                  <div>
                    <strong>Exam Notifications</strong>
                    <p>Add &amp; edit exam notices</p>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* =========================================================
              2. USERS TAB
          ========================================================= */}
          {activeTab === 'users' && (
            <div className="sd-ap-tab-pane">
              <div className="sd-ap-pane-head">
                <div>
                  <h2>User Management</h2>
                  <p>View registered student accounts and qualification details</p>
                </div>
              </div>

              <div className="sd-ap-table-container">
                <table className="sd-ap-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Category</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="sd-ap-empty-td">No users found.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <div className="sd-ap-user-cell">
                              <div className="sd-ap-avatar mini">{u.name?.charAt(0) || 'U'}</div>
                              <strong>{u.name}</strong>
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>{u.category || 'General'}</td>
                          <td>{u.joined}</td>
                          <td><span className="sd-ap-status-tag active">{u.status}</span></td>
                          <td>
                            <button
                              type="button"
                              className="sd-ap-icon-action"
                              title="View Details"
                              onClick={() => setSelectedUserModal(u)}
                            >
                              <FiEye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================
              3. FEEDBACK TAB
          ========================================================= */}
          {activeTab === 'feedback' && (
            <div className="sd-ap-tab-pane">
              <div className="sd-ap-pane-head">
                <div>
                  <h2>Feedback Management</h2>
                  <p>Review user feedback, ratings, and issue reports</p>
                </div>

                <div className="sd-ap-filters-row">
                  <select
                    value={feedbackFilterType}
                    onChange={(e) => setFeedbackFilterType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="problem">Report a Problem</option>
                    <option value="feature">Suggest a Feature</option>
                    <option value="general">General Feedback</option>
                    <option value="positive">Something I Like</option>
                  </select>

                  <select
                    value={feedbackFilterStatus}
                    onChange={(e) => setFeedbackFilterStatus(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>

              <div className="sd-ap-table-container">
                <table className="sd-ap-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Rating</th>
                      <th>Type</th>
                      <th>Feedback Description</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFeedbacks.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="sd-ap-empty-td">No feedback submissions found.</td>
                      </tr>
                    ) : (
                      filteredFeedbacks.map((f) => (
                        <tr key={f.id}>
                          <td>
                            <strong>{f.user_name || 'User'}</strong>
                            <br />
                            <small className="sd-ap-sub-text">{f.user_email}</small>
                          </td>
                          <td>
                            <span className="sd-ap-rating-stars">
                              {'★'.repeat(f.rating || 5)}{'☆'.repeat(5 - (f.rating || 5))}
                            </span>
                          </td>
                          <td>
                            <span className="sd-ap-chip">{f.feedback_type || 'general'}</span>
                          </td>
                          <td className="sd-ap-desc-cell">{f.description}</td>
                          <td>
                            <span className={`sd-ap-status-tag ${f.status || 'new'}`}>
                              {f.status || 'new'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="sd-ap-icon-action"
                              title="Review / Respond"
                              onClick={() => setSelectedFeedbackModal(f)}
                            >
                              <FiEdit2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================
              4. NOTIFICATIONS TAB
          ========================================================= */}
          {activeTab === 'notifications' && (
            <div className="sd-ap-tab-pane">
              <div className="sd-ap-pane-head">
                <div>
                  <h2>Exam Notifications</h2>
                  <p>Manage official government exam notifications &amp; alerts</p>
                </div>

                <div className="sd-ap-actions-head">
                  <select
                    value={notifFilterCategory}
                    onChange={(e) => setNotifFilterCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    <option value="PSC">PSC</option>
                    <option value="SSC">SSC</option>
                    <option value="UPSC">UPSC</option>
                    <option value="Railway">Railway</option>
                    <option value="Banking">Banking</option>
                  </select>

                  <button
                    type="button"
                    className="sd-ap-primary-btn"
                    onClick={() => setNotificationModal({ open: true, mode: 'add', item: null })}
                  >
                    <FiPlus size={16} />
                    <span>Add Notification</span>
                  </button>
                </div>
              </div>

              <div className="sd-ap-table-container">
                <table className="sd-ap-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Exam / Title</th>
                      <th>Organization</th>
                      <th>Last Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNotifications.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="sd-ap-empty-td">No notifications found.</td>
                      </tr>
                    ) : (
                      filteredNotifications.map((n) => (
                        <tr key={n.id}>
                          <td><span className="sd-ap-chip purple">{n.category || 'PSC'}</span></td>
                          <td>
                            <strong>{n.exam_name || n.notification_title}</strong>
                            <br />
                            <small className="sd-ap-sub-text">{n.notification_title}</small>
                          </td>
                          <td>{n.organization || 'Government Body'}</td>
                          <td>{n.application_last_date || 'N/A'}</td>
                          <td>
                            <button
                              type="button"
                              className={`sd-ap-toggle-btn ${n.is_active !== false ? 'active' : ''}`}
                              onClick={() => handleToggleNotificationActive(n.id, n.is_active !== false)}
                            >
                              {n.is_active !== false ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td>
                            <div className="sd-ap-row-actions">
                              <button
                                type="button"
                                className="sd-ap-icon-action"
                                title="Edit"
                                onClick={() => setNotificationModal({ open: true, mode: 'edit', item: n })}
                              >
                                <FiEdit2 size={16} />
                              </button>
                              <button
                                type="button"
                                className="sd-ap-icon-action danger"
                                title="Delete"
                                onClick={() => handleDeleteNotification(n.id)}
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================
              5. EXAMS TAB
          ========================================================= */}
          {activeTab === 'exams' && (
            <div className="sd-ap-tab-pane">
              <div className="sd-ap-pane-head">
                <div>
                  <h2>Supported Exam Categories</h2>
                  <p>Overview of exam categories available in SmartDoc AI</p>
                </div>
              </div>

              <div className="sd-ap-grid-3">
                {['Kerala PSC', 'SSC', 'UPSC', 'Banking', 'Railway', 'RBI', 'Defence', 'Teaching', 'Insurance'].map((cat) => {
                  const count = notificationsList.filter((n) => (n.category || n.exam_name || '').toLowerCase().includes(cat.toLowerCase())).length
                  return (
                    <div key={cat} className="sd-ap-card-box">
                      <div className="sd-ap-exam-head">
                        <FiBookOpen size={22} className="purple" />
                        <div>
                          <h3>{cat}</h3>
                          <p>{count} active notifications</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="sd-ap-sec-btn"
                        onClick={() => { setNotifFilterCategory(cat.split(' ')[0]); setActiveTab('notifications') }}
                      >
                        View Category Notifications
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* =========================================================
              6. RECOMMENDED VIDEOS TAB
          ========================================================= */}
          {activeTab === 'videos' && (
            <div className="sd-ap-tab-pane">
              <div className="sd-ap-pane-head">
                <div>
                  <h2>Recommended YouTube Videos</h2>
                  <p>Manage video suggestions shown on Home page for study topics</p>
                </div>

                <button
                  type="button"
                  className="sd-ap-primary-btn"
                  onClick={() => setVideoModal({ open: true, mode: 'add', item: null })}
                >
                  <FiPlus size={16} />
                  <span>Add Recommended Video</span>
                </button>
              </div>

              <div className="sd-ap-table-container">
                <table className="sd-ap-table">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Title</th>
                      <th>Channel</th>
                      <th>YouTube URL</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVideos.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="sd-ap-empty-td">No recommended videos found.</td>
                      </tr>
                    ) : (
                      filteredVideos.map((v) => (
                        <tr key={v.id}>
                          <td><span className="sd-ap-chip blue">{v.exam_name || v.exam_id}</span></td>
                          <td><strong>{v.title}</strong></td>
                          <td>{v.channel_name || 'YouTube'}</td>
                          <td>
                            {v.youtube_url && (
                              <a href={v.youtube_url} target="_blank" rel="noreferrer" className="sd-ap-link-url">
                                Watch <FiExternalLink size={12} />
                              </a>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`sd-ap-toggle-btn ${v.is_active !== false ? 'active' : ''}`}
                              onClick={() => handleToggleVideoActive(v.id, v.is_active !== false)}
                            >
                              {v.is_active !== false ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td>
                            <div className="sd-ap-row-actions">
                              <button
                                type="button"
                                className="sd-ap-icon-action"
                                title="Edit"
                                onClick={() => setVideoModal({ open: true, mode: 'edit', item: v })}
                              >
                                <FiEdit2 size={16} />
                              </button>
                              <button
                                type="button"
                                className="sd-ap-icon-action danger"
                                title="Delete"
                                onClick={() => handleDeleteVideo(v.id)}
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================
              7. ANALYTICS TAB
          ========================================================= */}
          {activeTab === 'analytics' && (
            <div className="sd-ap-tab-pane">
              <div className="sd-ap-pane-head">
                <div>
                  <h2>Platform Analytics</h2>
                  <p>Real-time system insights and database distribution metrics</p>
                </div>
              </div>

              <div className="sd-ap-stats-grid">
                <div className="sd-ap-stat-card blue">
                  <div className="sd-ap-stat-data">
                    <span className="sd-ap-stat-label">Total Users</span>
                    <strong className="sd-ap-stat-value">{combinedUsers.length}</strong>
                  </div>
                </div>
                <div className="sd-ap-stat-card rose">
                  <div className="sd-ap-stat-data">
                    <span className="sd-ap-stat-label">Total Feedback</span>
                    <strong className="sd-ap-stat-value">{feedbackList.length}</strong>
                  </div>
                </div>
                <div className="sd-ap-stat-card purple">
                  <div className="sd-ap-stat-data">
                    <span className="sd-ap-stat-label">Total Notifications</span>
                    <strong className="sd-ap-stat-value">{notificationsList.length}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              8. SETTINGS TAB
          ========================================================= */}
          {activeTab === 'settings' && (
            <div className="sd-ap-tab-pane">
              <div className="sd-ap-pane-head">
                <div>
                  <h2>System Settings</h2>
                  <p>Administrator account information and environment details</p>
                </div>
              </div>

              <div className="sd-ap-card-box max-600">
                <h3>Administrator Account</h3>
                <div className="sd-ap-info-row">
                  <span>Name:</span> <strong>Muhammed Suhyle</strong>
                </div>
                <div className="sd-ap-info-row">
                  <span>Email:</span> <strong>{adminUser?.email || 'Administrator Email'}</strong>
                </div>
                <div className="sd-ap-info-row">
                  <span>Role:</span> <strong className="sd-ap-status-tag active">Administrator</strong>
                </div>
                <div className="sd-ap-info-row">
                  <span>Version:</span> <strong>SmartDoc AI v1.0.0</strong>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* =========================================================
          MODALS
      ========================================================= */}

      {/* USER DETAILS MODAL */}
      {selectedUserModal && (
        <div className="sd-ap-modal-backdrop" onClick={() => setSelectedUserModal(null)}>
          <div className="sd-ap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sd-ap-modal-head">
              <h3>User Details</h3>
              <button type="button" onClick={() => setSelectedUserModal(null)}><FiX size={20} /></button>
            </div>
            <div className="sd-ap-modal-body">
              <p><strong>Name:</strong> {selectedUserModal.name}</p>
              <p><strong>Email:</strong> {selectedUserModal.email}</p>
              <p><strong>Category:</strong> {selectedUserModal.category || 'General'}</p>
              <p><strong>Date of Birth:</strong> {selectedUserModal.dateOfBirth || 'Not provided'}</p>
              {selectedUserModal.qualifications && selectedUserModal.qualifications.length > 0 && (
                <div>
                  <strong>Qualifications:</strong>
                  <ul>
                    {selectedUserModal.qualifications.map((q, idx) => (
                      <li key={idx}>
                        {q.highestQualification || 'Qualification'} - {q.degree || ''} ({q.yearOfPassing || ''})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK RESPOND MODAL */}
      {selectedFeedbackModal && (
        <div className="sd-ap-modal-backdrop" onClick={() => setSelectedFeedbackModal(null)}>
          <div className="sd-ap-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sd-ap-modal-head">
              <h3>Review Feedback</h3>
              <button type="button" onClick={() => setSelectedFeedbackModal(null)}><FiX size={20} /></button>
            </div>
            <div className="sd-ap-modal-body">
              <p><strong>User:</strong> {selectedFeedbackModal.user_name} ({selectedFeedbackModal.user_email})</p>
              <p><strong>Rating:</strong> {selectedFeedbackModal.rating} Stars</p>
              <p><strong>Type:</strong> {selectedFeedbackModal.feedback_type}</p>
              <p><strong>Description:</strong> {selectedFeedbackModal.description}</p>
              
              <div className="sd-ap-form-group">
                <label>Change Status:</label>
                <div className="sd-ap-btn-row">
                  <button
                    type="button"
                    className={`sd-ap-sec-btn ${selectedFeedbackModal.status === 'new' ? 'active' : ''}`}
                    onClick={() => handleUpdateFeedbackStatus(selectedFeedbackModal.id, 'new', selectedFeedbackModal.admin_note)}
                  >
                    New
                  </button>
                  <button
                    type="button"
                    className={`sd-ap-sec-btn ${selectedFeedbackModal.status === 'reviewing' ? 'active' : ''}`}
                    onClick={() => handleUpdateFeedbackStatus(selectedFeedbackModal.id, 'reviewing', selectedFeedbackModal.admin_note)}
                  >
                    Reviewing
                  </button>
                  <button
                    type="button"
                    className={`sd-ap-primary-btn ${selectedFeedbackModal.status === 'resolved' ? 'active' : ''}`}
                    onClick={() => handleUpdateFeedbackStatus(selectedFeedbackModal.id, 'resolved', selectedFeedbackModal.admin_note)}
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
