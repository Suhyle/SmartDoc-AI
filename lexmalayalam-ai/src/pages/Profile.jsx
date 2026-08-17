import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

import {
  FiArrowLeft,
  FiMoreVertical,
  FiChevronRight,
  FiMessageCircle,
  FiUser,
  FiBell,
  FiFileText,
  FiSettings,
  FiGlobe,
  FiHelpCircle,
  FiInfo,
  FiShield,
  FiLogOut,
  FiHome,
  FiDownload,
  FiPlus
} from 'react-icons/fi'

import './Profile.css'


/* =========================================================
   REUSABLE: PROFILE MENU ITEM
========================================================= */

function ProfileMenuItem({ icon, title, subtitle, onClick, isLast }) {
  return (
    <button
      type="button"
      className={`sd-profile-menu-item ${isLast ? 'no-border' : ''}`}
      onClick={onClick}
    >
      <span className="sd-profile-menu-icon">{icon}</span>
      <span className="sd-profile-menu-text">
        <span className="sd-profile-menu-title">{title}</span>
        <span className="sd-profile-menu-subtitle">{subtitle}</span>
      </span>
      <FiChevronRight size={18} className="sd-profile-menu-arrow" />
    </button>
  )
}


/* =========================================================
   REUSABLE: PROFILE SECTION
========================================================= */

function ProfileSection({ title, children }) {
  return (
    <section className="sd-profile-section">
      <h3 className="sd-profile-section-title">{title}</h3>
      <div className="sd-profile-section-card">{children}</div>
    </section>
  )
}


/* =========================================================
   MAIN: PROFILE PAGE
========================================================= */

export default function Profile() {

  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [showMoreMenu, setShowMoreMenu] = useState(false)


  // ==========================================
  // FETCH USER FROM SUPABASE (same pattern as Home.jsx)
  // ==========================================

  useEffect(() => {

    const getUserData = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) setUser(currentUser)
    }

    getUserData()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null)
      }
    )

    return () => { subscription.unsubscribe() }

  }, [])


  // ==========================================
  // DERIVED USER DISPLAY DATA
  // ==========================================

  const fullName = user?.user_metadata?.full_name || 'User'
  const userEmail = user?.email || ''

  const getInitial = (name) => {
    return name?.trim()?.charAt(0)?.toUpperCase() || 'U'
  }

  const initial = getInitial(fullName)


  // ==========================================
  // LOGOUT (reuses existing Supabase auth, same as temp Profile.jsx)
  // ==========================================

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }


  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="sd-profile-page">
      <div className="sd-profile-container">


        {/* ── 1. HEADER ── */}
        <header className="sd-profile-header">
          <button
            className="sd-profile-icon-btn"
            aria-label="Back"
            onClick={() => navigate('/home')}
          >
            <FiArrowLeft size={20} />
          </button>

          <h1 className="sd-profile-header-title">Profile</h1>

          <div className="sd-profile-more-wrapper">
            <button
              className="sd-profile-icon-btn"
              aria-label="More options"
              onClick={() => setShowMoreMenu((prev) => !prev)}
            >
              <FiMoreVertical size={20} />
            </button>

            {showMoreMenu && (
              <>
                <div
                  className="sd-profile-more-backdrop"
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="sd-profile-more-menu">
                  <button onClick={() => { setShowMoreMenu(false); navigate('/profile/edit') }}>
                    Edit Profile
                  </button>
                  <button onClick={() => { setShowMoreMenu(false); handleLogout() }}>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </header>


        {/* ── 2. USER IDENTITY ── */}
        <div className="sd-profile-identity">
          <div className="sd-profile-avatar">
            <span>{initial}</span>
          </div>
          <h2 className="sd-profile-name">{fullName}</h2>
          {userEmail && <p className="sd-profile-email">{userEmail}</p>}
        </div>


        {/* ── 3. FEEDBACK CARD ── */}
        <button
          type="button"
          className="sd-profile-feedback-card"
          onClick={() => navigate('/feedback')}
        >
          <span className="sd-profile-feedback-icon">
            <FiMessageCircle size={20} />
          </span>
          <span className="sd-profile-feedback-text">
            <span className="sd-profile-feedback-title">We value your feedback!</span>
            <span className="sd-profile-feedback-subtitle">
              Help us improve SmartDoc AI by sharing your thoughts.
            </span>
          </span>
          <FiChevronRight size={18} className="sd-profile-feedback-arrow" />
        </button>


        {/* ── 4. ACCOUNT SECTION ── */}
        <ProfileSection title="ACCOUNT">
          <ProfileMenuItem
            icon={<FiUser size={18} />}
            title="My Profile"
            subtitle="View and edit your profile"
            onClick={() => navigate('/profile/edit')}
          />
          <ProfileMenuItem
            icon={<FiBell size={18} />}
            title="Notifications"
            subtitle="Manage notification preferences"
            onClick={() => navigate('/notifications')}
          />
          <ProfileMenuItem
            icon={<FiFileText size={18} />}
            title="My Documents"
            subtitle="View your uploaded documents"
            onClick={() => navigate('/documents')}
            isLast
          />
        </ProfileSection>


        {/* ── 5. PREFERENCES SECTION ── */}
        <ProfileSection title="PREFERENCES">
          <ProfileMenuItem
            icon={<FiSettings size={18} />}
            title="Settings"
            subtitle="Language, theme and app settings"
            onClick={() => navigate('/settings')}
          />
          <ProfileMenuItem
            icon={<FiGlobe size={18} />}
            title="Language"
            subtitle="English"
            onClick={() => navigate('/settings/language')}
            isLast
          />
        </ProfileSection>


        {/* ── 6. SUPPORT SECTION ── */}
        <ProfileSection title="SUPPORT">
          <ProfileMenuItem
            icon={<FiMessageCircle size={18} />}
            title="Send Feedback"
            subtitle="Help us improve SmartDoc AI"
            onClick={() => navigate('/feedback')}
          />
          <ProfileMenuItem
            icon={<FiHelpCircle size={18} />}
            title="Help & Support"
            subtitle="Get help with SmartDoc AI"
            onClick={() => navigate('/support')}
          />
          <ProfileMenuItem
            icon={<FiInfo size={18} />}
            title="About SmartDoc AI"
            subtitle="Version 1.0.0"
            onClick={() => navigate('/about')}
          />
          <ProfileMenuItem
            icon={<FiShield size={18} />}
            title="Privacy & Security"
            subtitle="Manage your privacy and security"
            onClick={() => navigate('/privacy')}
          />
          <ProfileMenuItem
            icon={<FiFileText size={18} />}
            title="Terms & Conditions"
            subtitle="Read our terms and conditions"
            onClick={() => navigate('/terms')}
            isLast
          />
        </ProfileSection>


        {/* ── 7. LOGOUT ── */}
        <button type="button" className="sd-profile-logout-btn" onClick={handleLogout}>
          <FiLogOut size={18} />
          <span>Logout</span>
        </button>


        {/* ── 8. VERSION FOOTER ── */}
        <p className="sd-profile-version">SmartDoc AI • Version 1.0.0</p>


        {/* ── 9. BOTTOM NAVIGATION ──
             Mirrors Home.jsx's inline bottom nav exactly (same classes/structure),
             since Home.jsx does not export a separate BottomNav component.
             If you have a real components/BottomNav.jsx, share it and this block
             can be replaced with a plain <BottomNav activeTab="profile" /> import. */}
        <nav className="sd-bottom-nav">

          <button className="sd-nav-item" onClick={() => navigate('/home')}>
            <FiHome size={20} className="sd-nav-icon" />
            <span className="sd-nav-label">Home</span>
          </button>

          <button className="sd-nav-item" onClick={() => navigate('/transcript-summary')}>
            <FiFileText size={20} className="sd-nav-icon" />
            <span className="sd-nav-label">Transcripts</span>
          </button>

          <div className="sd-central-plus-wrapper">
            <button
              className="sd-central-plus-btn"
              aria-label="Add / New"
              onClick={() => navigate('/home')}
            >
              <FiPlus size={24} />
            </button>
            <span className="sd-nav-label sd-plus-label">Add / New</span>
          </div>

          <button className="sd-nav-item" onClick={() => navigate('/downloads')}>
            <FiDownload size={20} className="sd-nav-icon" />
            <span className="sd-nav-label">Downloads</span>
          </button>

          <button className="sd-nav-item active" onClick={() => navigate('/profile')}>
            <FiUser size={20} className="sd-nav-icon" />
            <span className="sd-nav-label">Profile</span>
          </button>

        </nav>

      </div>
    </div>
  )
}