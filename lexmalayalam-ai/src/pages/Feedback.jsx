import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  FiArrowLeft, FiStar, FiMessageCircle, FiAlertCircle, FiZap, FiHeart,
  FiBookOpen, FiFileText, FiImage, FiUpload, FiSend, FiX, FiCheck, FiCheckCircle
} from 'react-icons/fi'
import './Feedback.css'

/* Set to your table name (e.g. 'feedback') once it exists in Supabase.
   While null, nothing is sent anywhere: the payload is only logged. */
const FEEDBACK_TABLE = 'feedback'

const MAX_CHARS = 1000
const MAX_FILE_MB = 5
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const OTHER = 'Other (Please specify)'

const EXPERIENCES = [
  { value: 5, label: 'Excellent', emoji: '😊' },
  { value: 4, label: 'Good', emoji: '🙂' },
  { value: 3, label: 'Average', emoji: '😐' },
  { value: 2, label: 'Poor', emoji: '🙁' },
  { value: 1, label: 'Very Poor', emoji: '😞' }
]

const TYPES = [
  { value: 'problem', title: 'Report a Problem', desc: 'Something is not working as expected', icon: <FiAlertCircle size={22} /> },
  { value: 'feature', title: 'Suggest a Feature', desc: 'Share your ideas for new features', icon: <FiZap size={22} /> },
  { value: 'general', title: 'General Feedback', desc: 'Share your thoughts and suggestions', icon: <FiStar size={22} /> },
  { value: 'positive', title: 'Something I Like', desc: 'Tell us what you enjoy about the app', icon: <FiHeart size={22} /> }
]

const EXAMS = [
  'Kerala PSC', 'SSC', 'UPSC', 'Banking', 'Railway', 'State Exams', 'Defence',
  'Teaching Exams', 'Insurance', 'RBI', 'Other Government Exams', OTHER
]

export default function Feedback() {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [rating, setRating] = useState(0)
  const [feedbackType, setFeedbackType] = useState('')
  const [selectedExams, setSelectedExams] = useState([])
  const [noExam, setNoExam] = useState(false)
  const [otherExam, setOtherExam] = useState('')
  const [description, setDescription] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null))
  }, [])

  const userName = user?.user_metadata?.full_name || ''
  const userEmail = user?.email || ''
  const experience = EXPERIENCES.find((e) => e.value === rating)?.label || ''

  const clearError = (key) => setErrors((prev) => ({ ...prev, [key]: undefined }))

  const toggleExam = (name) => {
    if (noExam) return
    setSelectedExams((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
      if (!next.includes(OTHER)) setOtherExam('')
      return next
    })
    clearError('otherExam')
  }

  const toggleNoExam = () => {
    const next = !noExam
    setNoExam(next)
    if (next) { setSelectedExams([]); setOtherExam('') }
    clearError('otherExam')
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!FILE_TYPES.includes(file.type)) {
      setErrors((p) => ({ ...p, screenshot: 'Please choose a JPG, PNG or WebP image.' }))
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setErrors((p) => ({ ...p, screenshot: `Image must be ${MAX_FILE_MB} MB or smaller.` }))
      return
    }
    clearError('screenshot')
    setScreenshot(file)
  }

  const validate = () => {
    const e = {}
    if (!rating) e.rating = 'Please rate your experience.'
    if (!feedbackType) e.feedbackType = 'Please select a feedback type.'
    if (!description.trim()) e.description = 'Please describe your feedback.'
    if (selectedExams.includes(OTHER) && !otherExam.trim()) e.otherExam = 'Please enter the exam name.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  /* Connect point for the future Admin system. */
  const submitFeedback = async (payload) => {
    if (!FEEDBACK_TABLE) {
      console.info('[Feedback] Not sent: no feedback table configured yet.', payload)
      return
    }
    const { error } = await supabase.from(FEEDBACK_TABLE).insert([payload])
    if (error) throw error
  }

  const handleSubmit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setErrors({ submit: 'Please log in again to send feedback.' })
        return
      }
      await submitFeedback({
        user_id: authUser.id,
        user_name: authUser.user_metadata?.full_name || '',
        user_email: authUser.email,
        rating,
        experience,
        feedback_type: feedbackType,
        related_exams: noExam ? [] : selectedExams.filter((x) => x !== OTHER),
        other_exam: selectedExams.includes(OTHER) ? otherExam.trim() : null,
        description: description.trim(),
        screenshot_url: null, // TODO: upload `screenshot` to Supabase Storage, then store its URL
        status: 'new',
        created_at: new Date().toISOString()
      })
      setSuccess(true)
    } catch (err) {
      console.error(err)
      setErrors({ submit: 'Could not send feedback. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setRating(0); setFeedbackType(''); setSelectedExams([]); setNoExam(false)
    setOtherExam(''); setDescription(''); setScreenshot(null); setErrors({}); setSuccess(false)
  }

  if (success) {
    return (
      <div className="sd-fb-page">
        <div className="sd-fb-container sd-fb-success">
          <FiCheckCircle size={64} className="sd-fb-success-icon" />
          <h2>Thank you for your feedback! 💙</h2>
          <p>Your feedback has been received and will help us improve SmartDoc AI.</p>
          <button type="button" className="sd-fb-submit" onClick={() => navigate('/profile')}>
            Back to Profile
          </button>
          <button type="button" className="sd-fb-secondary" onClick={resetForm}>
            Submit Another Feedback
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sd-fb-page">
      <form className="sd-fb-container" onSubmit={handleSubmit} noValidate>

        <header className="sd-fb-header">
          <button type="button" className="sd-fb-back" aria-label="Back to profile" onClick={() => navigate('/profile')}>
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1>Send Feedback</h1>
            <p>Help us improve SmartDoc AI</p>
          </div>
        </header>

        <section className="sd-fb-hero">
          <div>
            <span className="sd-fb-pill">Your Feedback Matters 💙</span>
            <h2>Help us make SmartDoc AI better!</h2>
            <p>Share your thoughts, suggestions or report issues. Your feedback helps us improve and build features that you need.</p>
          </div>
          <FiMessageCircle size={84} className="sd-fb-hero-icon" aria-hidden="true" />
        </section>

        {/* RATING */}
        <section className="sd-fb-card">
          <h3>Overall Experience</h3>
          <p className="sd-fb-sub">How would you rate your overall experience with SmartDoc AI?</p>
          <div className="sd-fb-rating-row">
            <div className="sd-fb-stars" role="radiogroup" aria-label="Overall rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  className={`sd-fb-star ${n <= rating ? 'on' : ''}`}
                  onClick={() => { setRating(n); clearError('rating') }}
                >
                  <FiStar size={34} />
                </button>
              ))}
              <span className="sd-fb-hint">{rating ? `${rating} of 5: ${experience}` : 'Tap a star to rate'}</span>
            </div>
            <div className="sd-fb-faces" role="group" aria-label="Experience level">
              {EXPERIENCES.map((x) => (
                <button
                  key={x.value}
                  type="button"
                  aria-pressed={rating === x.value}
                  className={`sd-fb-face ${rating === x.value ? 'on' : ''}`}
                  onClick={() => { setRating(x.value); clearError('rating') }}
                >
                  <span className="sd-fb-emoji">{x.emoji}</span>
                  <span>{x.label}</span>
                </button>
              ))}
            </div>
          </div>
          {errors.rating && <p className="sd-fb-error" role="alert">{errors.rating}</p>}
        </section>

        {/* TYPE */}
        <section className="sd-fb-card">
          <h3>What type of feedback is this?</h3>
          <p className="sd-fb-sub">Select the option that best describes your feedback.</p>
          <div className="sd-fb-types" role="radiogroup" aria-label="Feedback type">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={feedbackType === t.value}
                className={`sd-fb-type ${feedbackType === t.value ? 'on' : ''}`}
                onClick={() => { setFeedbackType(t.value); clearError('feedbackType') }}
              >
                <span className="sd-fb-type-icon">{t.icon}</span>
                <strong>{t.title}</strong>
                <span>{t.desc}</span>
              </button>
            ))}
          </div>
          {errors.feedbackType && <p className="sd-fb-error" role="alert">{errors.feedbackType}</p>}
        </section>

        {/* EXAMS */}
        <section className="sd-fb-card">
          <div className="sd-fb-card-head">
            <div>
              <h3>Select Related Exams <small>(Optional)</small></h3>
              <p className="sd-fb-sub">Choose the exams related to your feedback. You can select multiple.</p>
            </div>
            <label className="sd-fb-check">
              <input type="checkbox" checked={noExam} onChange={toggleNoExam} />
              <span>Not related to any exam</span>
            </label>
          </div>
          <div className="sd-fb-chips">
            {EXAMS.map((name) => {
              const on = selectedExams.includes(name)
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={on}
                  disabled={noExam}
                  className={`sd-fb-chip ${on ? 'on' : ''}`}
                  onClick={() => toggleExam(name)}
                >
                  {on ? <FiCheck size={16} /> : <FiBookOpen size={16} />}
                  {name}
                </button>
              )
            })}
          </div>
          {selectedExams.includes(OTHER) && (
            <div className="sd-fb-other">
              <label htmlFor="sd-fb-other-exam">Which exam?</label>
              <input
                id="sd-fb-other-exam"
                type="text"
                maxLength={80}
                value={otherExam}
                placeholder="Enter the exam name"
                onChange={(e) => { setOtherExam(e.target.value); clearError('otherExam') }}
              />
              {errors.otherExam && <p className="sd-fb-error" role="alert">{errors.otherExam}</p>}
            </div>
          )}
        </section>

        {/* DESCRIPTION + SCREENSHOT */}
        <section className="sd-fb-card">
          <h3><FiFileText size={18} /> Your Feedback</h3>
          <p className="sd-fb-sub">Please describe your feedback in detail.</p>
          <textarea
            className="sd-fb-textarea"
            aria-label="Your feedback"
            maxLength={MAX_CHARS}
            value={description}
            placeholder="Write your feedback here..."
            onChange={(e) => { setDescription(e.target.value); clearError('description') }}
          />
          <div className="sd-fb-textarea-foot">
            <span className="sd-fb-guide">
              You can include: what feature or issue you mean, what you expected, what happened instead, and any suggestions.
            </span>
            <span className="sd-fb-count">{description.length} / {MAX_CHARS}</span>
          </div>
          {errors.description && <p className="sd-fb-error" role="alert">{errors.description}</p>}

          <div className="sd-fb-upload">
            <h3><FiImage size={18} /> Attach Screenshot <small>(Optional)</small></h3>
            <p className="sd-fb-sub">You can upload a screenshot to help us understand the issue better.</p>
            <div className="sd-fb-upload-row">
              <label className="sd-fb-file-btn">
                <FiUpload size={16} /> Choose File
                <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={handleFile} hidden />
              </label>
              {screenshot ? (
                <span className="sd-fb-file-name">
                  {screenshot.name}
                  <button type="button" aria-label="Remove screenshot" onClick={() => setScreenshot(null)}>
                    <FiX size={16} />
                  </button>
                </span>
              ) : (
                <span className="sd-fb-file-note">No file selected. JPG, PNG, WebP (max 5 MB)</span>
              )}
            </div>
            {errors.screenshot && <p className="sd-fb-error" role="alert">{errors.screenshot}</p>}
          </div>
        </section>

        {userEmail && (
          <p className="sd-fb-as">Submitting as {userName ? `${userName} · ` : ''}{userEmail}</p>
        )}
        {errors.submit && <p className="sd-fb-error sd-fb-error-center" role="alert">{errors.submit}</p>}

        <button type="submit" className="sd-fb-submit" disabled={submitting}>
          <FiSend size={18} />
          {submitting ? 'Sending...' : 'Submit Feedback'}
        </button>
      </form>
    </div>
  )
}