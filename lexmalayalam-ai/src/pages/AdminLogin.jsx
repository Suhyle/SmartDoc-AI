import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  FiBookOpen, FiMail, FiLock, FiEye, FiEyeOff, FiShield, FiAlertCircle, FiArrowRight
} from 'react-icons/fi'
import './AdminLogin.css'

export default function AdminLogin() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleAdminLogin = async (e) => {
    e.preventDefault()

    // Prevent duplicate submissions while a login is already in progress
    if (loading) return

    setErrorMsg('')

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.')
      return
    }

    setLoading(true)

    try {
      // 1. Authenticate with Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (error) {
        throw new Error('Invalid email or password.')
      }

      const user = data?.user
      if (!user) {
        throw new Error('Unable to authenticate user.')
      }

      // 2. Authorize Administrator Role in user_profiles
      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('id', user.id)
        .single()

      const isAdmin = !profileErr && profile?.role === 'admin'

      if (!isAdmin) {
        // Sign out non-admin (or unresolvable) account to protect session
        await supabase.auth.signOut()
        throw new Error('Access denied. This account is not authorized as an administrator.')
      }

      // Store remember preference if needed
      if (!rememberMe) {
        sessionStorage.setItem('smartdoc_admin_session', 'true')
      }

      // Success -> navigate to Admin Panel
      navigate('/admin')
    } catch (err) {
      console.error('Admin login error:', err)
      setErrorMsg(err.message || 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sd-al-page">
      <div className="sd-al-wrapper">

        {/* BRANDING HEADER */}
        <div className="sd-al-brand">
          <div className="sd-al-logo-icon">
            <FiBookOpen size={36} />
          </div>
          <h1 className="sd-al-title">SmartDoc AI</h1>
          <p className="sd-al-subtitle">Administration Portal</p>
          <div className="sd-al-tagline">
            <span>Manage.</span> <span>Monitor.</span> <span>Improve.</span>
          </div>
          <p className="sd-al-desc">Control and manage SmartDoc AI platform from one place.</p>
        </div>

        {/* LOGIN CARD */}
        <form className="sd-al-card" onSubmit={handleAdminLogin} noValidate>
          <div className="sd-al-card-head">
            <h2>Administrator Login</h2>
            <p>Sign in to access the administration panel</p>
          </div>

          {errorMsg && (
            <div className="sd-al-error-banner" role="alert">
              <FiAlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* EMAIL FIELD */}
          <div className="sd-al-field">
            <label htmlFor="sd-al-email">Email</label>
            <div className="sd-al-input-wrap">
              <FiMail className="sd-al-input-icon" size={18} />
              <input
                id="sd-al-email"
                type="email"
                value={email}
                placeholder="Enter your email address"
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* PASSWORD FIELD */}
          <div className="sd-al-field">
            <label htmlFor="sd-al-password">Password</label>
            <div className="sd-al-input-wrap">
              <FiLock className="sd-al-input-icon" size={18} />
              <input
                id="sd-al-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                placeholder="Enter your password"
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="sd-al-eye-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
              </button>
            </div>
          </div>

          {/* OPTIONS ROW */}
          <div className="sd-al-options">
            <label className="sd-al-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <span className="sd-al-forgot" onClick={() => alert('Please contact system administrator to reset password.')}>
              Forgot password?
            </span>
          </div>

          {/* SUBMIT BUTTON */}
          <button type="submit" className="sd-al-submit-btn" disabled={loading}>
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <>
                <span>Sign In</span>
                <FiArrowRight size={18} />
              </>
            )}
          </button>

          {/* SECURITY WARNING BADGE */}
          <div className="sd-al-security-badge">
            <FiShield size={20} className="sd-al-shield-icon" />
            <div>
              <strong>Authorized Personnel Only</strong>
              <p>This is a restricted area for SmartDoc AI administrators. Unauthorized access is prohibited.</p>
            </div>
          </div>
        </form>

        {/* FOOTER */}
        <footer className="sd-al-footer">
          <p><strong>SmartDoc AI</strong> Administration Portal</p>
          <p>© 2026 SmartDoc AI. All rights reserved.</p>
        </footer>

      </div>
    </div>
  )
}
