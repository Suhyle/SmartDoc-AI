import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import {
  FiArrowLeft, FiUser, FiMail, FiCalendar, FiBookOpen, FiSettings, FiShield,
  FiPlus, FiTrash2, FiSave, FiCheckCircle, FiInfo, FiDatabase, FiEdit2, FiX,
  FiAward, FiBriefcase, FiCompass, FiTrendingUp, FiGrid, FiAlertCircle
} from 'react-icons/fi'
import './Myprofile.css'

/* ── EXAM OPTIONS (same ids as SelectExam.jsx → stored in user_metadata.selected_exams, read by Home.jsx) ── */
const EXAM_OPTIONS = [
  { id: 'psc', label: 'PSC', icon: <FiAward size={16} />, tone: 'psc' },
  { id: 'ssc', label: 'SSC', icon: <FiBookOpen size={16} />, tone: 'ssc' },
  { id: 'upsc', label: 'UPSC', icon: <FiCompass size={16} />, tone: 'upsc' },
  { id: 'banking', label: 'Banking', icon: <FiBriefcase size={16} />, tone: 'bank' },
  { id: 'railway', label: 'Railway', icon: <FiTrendingUp size={16} />, tone: 'railway' },
  { id: 'other', label: 'Other', icon: <FiGrid size={16} />, tone: 'other' },
]
const normalizeExamId = (v) => {
  const r = String(v || '').trim().toLowerCase()
  if (r.includes('upsc')) return 'upsc'
  if (r.includes('psc')) return 'psc'
  if (r.includes('ssc')) return 'ssc'
  if (r.includes('bank') || ['ibps', 'sbi', 'rbi', 'nabard'].includes(r)) return 'banking'
  if (r.includes('rail') || r.includes('rrb')) return 'railway'
  return r || 'other'
}

const blankQualification = () => ({ highestQualification: '', degree: '', specialization: '', yearOfPassing: '' })
const CURRENT_YEAR = new Date().getFullYear()
const localToday = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 10)
}
const qualificationFromRow = (row) => ({
  highestQualification: row.highest_qualification || '',
  degree: row.degree || '',
  specialization: row.specialization || '',
  yearOfPassing: row.year_of_passing ?? '',
})

/* ── small reusable pieces ── */
function SectionCard({ id, icon, title, subtitle, action, children }) {
  return (
    <section className="mp-card" id={id}>
      <div className="mp-card-head">
        <span className="mp-card-icon">{icon}</span>
        <div className="mp-card-titles"><h2>{title}</h2><p>{subtitle}</p></div>
        {action}
      </div>
      {children}
    </section>
  )
}
function Field({ label, optional, hint, children, htmlFor }) {
  return (
    <div className="mp-field">
      <label htmlFor={htmlFor}>{label}{optional && <span className="mp-optional"> (Optional)</span>}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  )
}

export default function MyProfile() {
  const navigate = useNavigate()
  const [state, setState] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState('')
  const [user, setUser] = useState(null)
  const [hasRow, setHasRow] = useState(false)

  const [fullName, setFullName] = useState('')
  const [dob, setDob] = useState('')
  const [age, setAge] = useState('')
  const [category, setCategory] = useState('')
  const [qualifications, setQualifications] = useState([blankQualification()])
  const [exams, setExams] = useState([])
  const [pickingExams, setPickingExams] = useState(false)
  const [customExam, setCustomExam] = useState('')
  const [activeSection, setActiveSection] = useState('mp-info')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'ok' | 'err', text }
  const [savedSnapshot, setSavedSnapshot] = useState('')

  /* ── LOAD: auth user → user_profiles row → exam prefs from user_metadata ── */
  const load = useCallback(async () => {
    setState('loading')
    setLoadError('')
    try {
      const { data, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      const u = data?.user
      if (!u) { navigate('/login'); return }
      setUser(u)
      const meta = u.user_metadata || {}
      const metaExams = Array.isArray(meta.selected_exams) ? meta.selected_exams : (meta.selected_exams ? [meta.selected_exams] : [])

      const [{ data: profile, error: profErr }, { data: legacyRows, error: legacyErr }] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', u.id).maybeSingle(),
        supabase.from('user_qualifications')
          .select('full_name, date_of_birth, age, category, highest_qualification, degree, specialization, year_of_passing')
          .eq('user_id', u.id),
      ])
      if (profErr) throw profErr
      if (legacyErr) console.warn('Legacy qualification records could not be loaded:', legacyErr)

      setHasRow(!!profile)
      const legacy = Array.isArray(legacyRows) ? legacyRows : []
      const legacyFirst = legacy[0] || {}
      const name = profile?.full_name || legacyFirst.full_name || meta.full_name || ''
      const birthDate = profile?.date_of_birth || legacyFirst.date_of_birth || ''
      const profileQualifications = Array.isArray(profile?.qualifications)
        ? profile.qualifications.filter((q) => q && typeof q === 'object')
        : []
      const quals = profileQualifications.length
        ? profileQualifications.map((q) => ({ ...q, yearOfPassing: q.yearOfPassing ?? '' }))
        : legacy.filter((row) => row.highest_qualification).map(qualificationFromRow)
      const normalizedQualifications = quals.length ? quals : [blankQualification()]
      const values = {
        fullName: name,
        dob: birthDate ? String(birthDate).slice(0, 10) : '',
        age: profile?.age ?? legacyFirst.age ?? '',
        category: profile?.category || legacyFirst.category || '',
        qualifications: normalizedQualifications,
        exams: [...new Set(metaExams.map(normalizeExamId))],
      }
      setFullName(values.fullName)
      setDob(values.dob)
      setAge(values.age)
      setCategory(values.category)
      setQualifications(values.qualifications)
      setExams(values.exams)
      setSavedSnapshot(JSON.stringify(values))
      setMessage(null)
      setState('ready')
    } catch (err) {
      console.error('MyProfile load failed:', err)
      setLoadError('We could not load your profile. Please check your connection and try again.')
      setState('error')
    }
  }, [navigate])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const sections = ['mp-info', 'mp-qual', 'mp-exams']
      .map((id) => document.getElementById(id))
      .filter(Boolean)
    if (!sections.length || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (visible) setActiveSection(visible.target.id)
    }, { rootMargin: '-15% 0px -65% 0px', threshold: [0, 0.2, 0.5] })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [state])

  /* ── helpers ── */
  const updateQual = (i, key, value) => setQualifications((c) => c.map((q, idx) => (idx === i ? { ...q, [key]: value } : q)))
  const removeQual = (i) => setQualifications((c) => (c.length === 1 ? [blankQualification()] : c.filter((_, idx) => idx !== i)))
  const toggleExam = (id) => setExams((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  const addCustomExam = () => {
    const value = customExam.trim()
    if (!value) return
    const normalized = normalizeExamId(value)
    if (!exams.includes(normalized)) setExams((current) => [...current, normalized])
    setCustomExam('')
    setMessage(null)
  }
  const onDobChange = (value) => {
    setDob(value)
    if (!value) {
      setAge('')
      return
    }
    const d = new Date(`${value}T00:00:00`)
    if (!isNaN(d)) {
      const now = new Date()
      let a = now.getFullYear() - d.getFullYear()
      if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a -= 1
      if (a >= 0 && a < 120) setAge(a)
    }
  }

  const validate = () => {
    if (!fullName.trim()) return 'Full name is required.'
    if (dob && (isNaN(new Date(`${dob}T00:00:00`)) || dob > localToday())) return 'Enter a valid date of birth.'
    if (age !== '' && (!Number.isFinite(Number(age)) || Number(age) < 0 || Number(age) > 120)) return 'Enter a valid age.'
    for (const [i, q] of qualifications.entries()) {
      const any = q.highestQualification || q.degree || q.specialization || q.yearOfPassing
      if (any && !String(q.highestQualification).trim()) return `Qualification ${i + 1}: highest qualification is required.`
      if (q.yearOfPassing !== '' && q.yearOfPassing != null) {
        const y = Number(q.yearOfPassing)
        if (!Number.isInteger(y) || y < 1950 || y > CURRENT_YEAR + 6) return `Qualification ${i + 1}: enter a valid year of passing.`
      }
    }
    return ''
  }

  const cleanedQualifications = qualifications
    .filter((q) => String(q.highestQualification || '').trim())
    .map((q) => ({
      ...q,
      highestQualification: String(q.highestQualification).trim(),
      degree: String(q.degree || '').trim(),
      specialization: String(q.specialization || '').trim(),
      yearOfPassing: q.yearOfPassing === '' || q.yearOfPassing == null ? null : Number(q.yearOfPassing),
    }))

  const currentSnapshot = JSON.stringify({
    fullName,
    dob,
    age,
    category,
    qualifications,
    exams,
  })
  const hasUnsavedChanges = savedSnapshot !== '' && currentSnapshot !== savedSnapshot

  /* ── SAVE: canonical profile, auth metadata, then keep notification rows in sync ── */
  const handleSave = async () => {
    if (saving) return
    setMessage(null)
    const problem = validate()
    if (problem) { setMessage({ type: 'err', text: problem }); return }
    setSaving(true)
    try {
      const cleaned = cleanedQualifications
      const { error: profErr } = await supabase.from('user_profiles').upsert({
        id: user.id,
        full_name: fullName.trim(),
        date_of_birth: dob || null,
        age: age === '' ? null : Number(age),
        category: category.trim() || null,
        qualifications: cleaned,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })
      if (profErr) throw profErr

      const { data: updated, error: authErr } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), selected_exams: exams },
      })
      if (authErr) {
        setHasRow(true)
        throw new Error(`Your profile details were saved, but account preferences could not be updated: ${authErr.message}`)
      }

      const syncTimestamp = new Date().toISOString()
      if (cleaned.length) {
        const rows = cleaned.map((qualification) => ({
          user_id: user.id,
          full_name: fullName.trim(),
          date_of_birth: dob || null,
          age: age === '' ? null : Number(age),
          highest_qualification: qualification.highestQualification,
          degree: qualification.degree || null,
          specialization: qualification.specialization || null,
          year_of_passing: qualification.yearOfPassing,
          category: category.trim() || null,
          updated_at: syncTimestamp,
        }))
        const { error: insertError } = await supabase.from('user_qualifications').insert(rows)
        if (insertError) {
          setHasRow(true)
          throw new Error(`Your profile was saved, but notification qualification data could not be synchronized: ${insertError.message}`)
        }
        const { error: staleRowsError } = await supabase.from('user_qualifications')
          .delete().eq('user_id', user.id).neq('updated_at', syncTimestamp)
        if (staleRowsError) {
          setHasRow(true)
          throw new Error(`Your profile and qualifications were saved, but older notification qualification rows could not be cleaned up: ${staleRowsError.message}`)
        }
        const { error: nullTimestampRowsError } = await supabase.from('user_qualifications')
          .delete().eq('user_id', user.id).is('updated_at', null)
        if (nullTimestampRowsError) {
          setHasRow(true)
          throw new Error(`Your profile was saved, but legacy notification qualification rows could not be fully synchronized: ${nullTimestampRowsError.message}`)
        }
      } else {
        const { error: clearError } = await supabase.from('user_qualifications').delete().eq('user_id', user.id)
        if (clearError) {
          setHasRow(true)
          throw new Error(`Your profile was saved, but removed qualifications remain in the notification matcher: ${clearError.message}`)
        }
      }

      // keep the old registration-flow cache in step so nothing reads stale values
      try { localStorage.setItem('smartdoc_selected_exams', JSON.stringify(exams)) } catch { /* ignore */ }

      if (updated?.user) setUser(updated.user)
      setHasRow(true)
      const savedValues = {
        fullName: fullName.trim(),
        dob,
        age: age === '' ? '' : Number(age),
        category: category.trim(),
        qualifications: cleaned.length
          ? cleaned.map((q) => ({ ...q, yearOfPassing: q.yearOfPassing ?? '' }))
          : [blankQualification()],
        exams: [...exams],
      }
      setFullName(savedValues.fullName)
      setAge(savedValues.age)
      setCategory(savedValues.category)
      setQualifications(savedValues.qualifications.length ? savedValues.qualifications : [blankQualification()])
      setSavedSnapshot(JSON.stringify(savedValues))
      setMessage({ type: 'ok', text: 'Profile updated successfully.' })
    } catch (err) {
      console.error('MyProfile save failed:', err)
      setMessage({ type: 'err', text: err?.message || 'Unable to update your profile. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const discardChanges = () => {
    if (!savedSnapshot) return
    const saved = JSON.parse(savedSnapshot)
    setFullName(saved.fullName)
    setDob(saved.dob)
    setAge(saved.age)
    setCategory(saved.category)
    setQualifications(saved.qualifications.length ? saved.qualifications : [blankQualification()])
    setExams(saved.exams)
    setCustomExam('')
    setPickingExams(false)
    setMessage({ type: 'info', text: 'Unsaved changes were discarded.' })
  }

  const scrollTo = (id) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* ── RENDER ── */
  if (state === 'loading') return <div className="mp-page"><div className="mp-center" role="status">Loading your profile...</div></div>
  if (state === 'error') return (
    <div className="mp-page"><div className="mp-center">
      <FiAlertCircle size={28} /><p>{loadError}</p>
      <div className="mp-row"><button className="mp-btn ghost" onClick={() => navigate('/profile')}>Back</button><button className="mp-btn" onClick={load}>Try again</button></div>
    </div></div>
  )

  const verified = !!user?.email_confirmed_at
  const initial = (fullName || user?.email || 'U').trim().charAt(0).toUpperCase()

  return (
    <div className="mp-page">
      <div className="mp-container">
        <header className="mp-header">
          <button type="button" className="mp-back" onClick={() => navigate('/profile')} aria-label="Back to Profile"><FiArrowLeft size={22} /></button>
          <div><h1>My Profile</h1><p>View and update your personal information, exam preferences and other details.</p></div>
        </header>

        <div className="mp-layout">
          {/* SIDEBAR */}
          <aside className="mp-side">
            <nav className="mp-nav" aria-label="Profile sections">
              <button type="button" className={`mp-nav-item${activeSection === 'mp-info' ? ' active' : ''}`} onClick={() => scrollTo('mp-info')}><span><FiUser size={18} /></span><div><strong>Profile Information</strong><small>Personal details</small></div></button>
              <button type="button" className={`mp-nav-item${['mp-qual', 'mp-exams'].includes(activeSection) ? ' active' : ''}`} onClick={() => scrollTo('mp-qual')}><span><FiBookOpen size={18} /></span><div><strong>Qualification &amp; Exams</strong><small>Education details &amp; selected exams</small></div></button>
              <button type="button" className="mp-nav-item" onClick={() => navigate('/settings')}><span><FiSettings size={18} /></span><div><strong>Account Settings</strong><small>Language and app settings</small></div></button>
              <button type="button" className="mp-nav-item" disabled title="Coming soon"><span><FiShield size={18} /></span><div><strong>Privacy &amp; Security</strong><small>Not available yet</small></div></button>
            </nav>
            <div className="mp-note purple"><FiInfo size={18} /><div><strong>Some information is from your registration</strong>
              <p>Your account and qualification information was collected during registration. You can update supported details here, and changes will be saved to your account.</p></div></div>
            <div className="mp-note green"><FiDatabase size={18} /><div><strong>Connected with Supabase</strong>
              <p>Changes made here are saved to your SmartDoc AI account and used across the app.</p></div></div>
          </aside>

          {/* MAIN */}
          <main className="mp-main">
            {message && <div className={`mp-msg ${message.type}`} role={message.type === 'err' ? 'alert' : 'status'}>
              {message.type === 'ok' ? <FiCheckCircle size={18} /> : <FiAlertCircle size={18} />}<span>{message.text}</span></div>}
            {!hasRow && <div className="mp-msg info"><FiInfo size={18} /><span>No saved profile was found yet. Saving will create one for your account.</span></div>}

            <SectionCard id="mp-info" icon={<FiUser size={20} />} title="Profile Information" subtitle="Update your personal details"
              action={<button className="mp-btn" onClick={handleSave} disabled={saving}><FiSave size={16} /> {saving ? 'Saving...' : 'Save Changes'}</button>}>
              <div className="mp-info-grid">
                <div className="mp-avatar" aria-hidden="true">{initial}</div>
                <div className="mp-info-fields">
                  <Field label="Full Name" htmlFor="mp-name" hint="This was set during registration. You can update it anytime.">
                    <div className="mp-input"><FiUser size={16} /><input id="mp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" /></div>
                  </Field>
                  <Field label="Email Address" htmlFor="mp-email" hint="Email is managed by your account login and cannot be changed here.">
                    <div className="mp-input readonly"><FiMail size={16} /><input id="mp-email" value={user?.email || ''} readOnly />
                      {verified && <span className="mp-verified"><FiCheckCircle size={14} /> Verified</span>}</div>
                  </Field>
                </div>
              </div>
              <div className="mp-grid-3">
                <Field label="Date of Birth" optional htmlFor="mp-dob">
                  <div className="mp-input"><FiCalendar size={16} /><input id="mp-dob" type="date" max={localToday()} value={dob} onChange={(e) => onDobChange(e.target.value)} /></div>
                </Field>
                <Field label="Age" optional htmlFor="mp-age">
                  <div className="mp-input"><input id="mp-age" type="number" min="0" max="120" value={age} onChange={(e) => setAge(e.target.value)} /></div>
                </Field>
                <Field label="Category" optional htmlFor="mp-cat" hint="Used for eligibility matching.">
                  <div className="mp-input"><input id="mp-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. General, OBC, SC, ST" /></div>
                </Field>
              </div>
            </SectionCard>

            <SectionCard id="mp-qual" icon={<FiBookOpen size={20} />} title="Qualification & Education" subtitle="Update your educational details"
              action={<button type="button" className="mp-btn outline" onClick={() => setQualifications((c) => [...c, blankQualification()])}><FiPlus size={16} /> Add Another Qualification</button>}>
              {qualifications.map((q, i) => (
                <div className="mp-qual" key={i}>
                  <div className="mp-qual-head"><strong>Qualification {i + 1}</strong>
                    <button type="button" className="mp-icon-btn" onClick={() => removeQual(i)} aria-label={`Remove qualification ${i + 1}`}><FiTrash2 size={16} /></button></div>
                  <div className="mp-grid-4">
                    <Field label="Highest Qualification" htmlFor={`q-h-${i}`}><div className="mp-input"><input id={`q-h-${i}`} value={q.highestQualification || ''} onChange={(e) => updateQual(i, 'highestQualification', e.target.value)} placeholder="e.g. B.Sc" /></div></Field>
                    <Field label="Degree / Course" optional htmlFor={`q-d-${i}`}><div className="mp-input"><input id={`q-d-${i}`} value={q.degree || ''} onChange={(e) => updateQual(i, 'degree', e.target.value)} /></div></Field>
                    <Field label="Specialization" optional htmlFor={`q-s-${i}`}><div className="mp-input"><input id={`q-s-${i}`} value={q.specialization || ''} onChange={(e) => updateQual(i, 'specialization', e.target.value)} /></div></Field>
                    <Field label="Year of Passing" optional htmlFor={`q-y-${i}`}><div className="mp-input"><input id={`q-y-${i}`} type="number" min="1950" max={CURRENT_YEAR + 6} value={q.yearOfPassing ?? ''} onChange={(e) => updateQual(i, 'yearOfPassing', e.target.value)} /></div></Field>
                  </div>
                </div>
              ))}
              <p className="mp-hint">Helps us show relevant notifications and content. Remember to press Save Changes.</p>
            </SectionCard>

            <SectionCard id="mp-exams" icon={<FiBookOpen size={20} />} title="Exam Preferences" subtitle="Manage your selected exams"
              action={<button type="button" className="mp-btn outline" onClick={() => setPickingExams((v) => !v)}><FiEdit2 size={16} /> {pickingExams ? 'Done' : 'Update Exams'}</button>}>
              <div className="mp-chips">
                {exams.length ? exams.map((id) => {
                  const o = EXAM_OPTIONS.find((x) => x.id === id) || { label: id.toUpperCase(), icon: <FiGrid size={16} />, tone: 'other' }
                  return <span key={id} className={`mp-chip ${o.tone}`}>{o.icon}<b>{o.label}</b>
                    <button type="button" onClick={() => toggleExam(id)} aria-label={`Remove ${o.label}`}><FiX size={14} /></button></span>
                }) : <p className="mp-hint">No exams selected.</p>}
              </div>
              {pickingExams && (
                <div className="mp-exam-editor">
                  <div className="mp-picker" role="group" aria-label="Choose exam categories">
                    {EXAM_OPTIONS.map((o) => (
                      <label key={o.id} className={`mp-pick ${exams.includes(o.id) ? 'on' : ''}`}>
                        <input type="checkbox" checked={exams.includes(o.id)} onChange={() => toggleExam(o.id)} />{o.icon}<span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mp-custom-exam">
                    <label htmlFor="mp-custom-exam">Add an exam or organization not listed</label>
                    <div><input id="mp-custom-exam" value={customExam} onChange={(event) => setCustomExam(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomExam(); } }} placeholder="e.g. NABARD, ISRO, state-level exam" />
                      <button type="button" className="mp-btn outline" onClick={addCustomExam} disabled={!customExam.trim()}><FiPlus size={16} /> Add exam</button></div>
                  </div>
                </div>
              )}
              <p className="mp-hint">Changes to personal details, qualifications and selected exams are applied after saving.</p>
            </SectionCard>

            <div className="mp-save-row">
              {hasUnsavedChanges && <button type="button" className="mp-btn ghost" onClick={discardChanges} disabled={saving}>Discard changes</button>}
              <button type="button" className="mp-btn big" onClick={handleSave} disabled={saving || !hasUnsavedChanges}><FiSave size={18} /> {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'All Changes Saved'}</button>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}