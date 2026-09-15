import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiAward,
  FiBook,
  FiBookOpen,
  FiCheckCircle,
  FiHelpCircle,
  FiInfo,
  FiLayers,
  FiPlus,
  FiStar,
  FiTarget,
  FiTool,
  FiTrash2,
} from 'react-icons/fi'

import { supabase } from '../supabase'
import { saveSignupDraft } from '../utils/signupDraft'
import './QualificationForm.css'

/* =========================================================
   CONSTANTS

   Every value collected here maps 1:1 onto a column that
   really exists in the `user_qualifications` table:

     highest_qualification  ->  highestQualification
     degree                 ->  degree
     specialization         ->  specialization
     year_of_passing        ->  yearOfPassing

   Anything not in that list cannot be stored, so it is not
   collected. The same shape is written into the
   `user_profiles.qualifications` JSONB column, which
   Myprofile.jsx reads, so the two pages stay in step.
========================================================= */

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1950
const MAX_YEAR = CURRENT_YEAR + 6 // allows "expected" completion years

// Same key the project already used.
const LOCAL_KEY = 'smartdoc_qualification'

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category' },
  { value: 'General', label: 'General' },
  { value: 'EWS', label: 'EWS' },
  { value: 'OBC', label: 'OBC' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' },
]

/**
 * Suggestion lists (rendered once as <datalist>). Users can still type
 * anything, these only speed up entry.
 */
const SUGGESTIONS = {
  'sd-specialization-12': ['Science', 'Commerce', 'Humanities', 'Vocational'],
  'sd-degree-diploma': [
    'Diploma in Computer Application',
    'Diploma in Engineering',
    'ITI',
    'Polytechnic Diploma',
  ],
  'sd-degree-bachelor': [
    'BA',
    'B.Sc',
    'B.Com',
    'BCA',
    'BBA',
    'B.Tech',
    'B.E',
    'B.Ed',
    'LLB',
    'MBBS',
  ],
  'sd-degree-master': [
    'MA',
    'M.Sc',
    'M.Com',
    'MCA',
    'MBA',
    'M.Tech',
    'M.Ed',
    'LLM',
  ],
  'sd-degree-other': ['Chartered Accountancy', 'ITI', 'B.Ed', 'Nursing'],
}

/**
 * Per-qualification field configuration. This is the single source of truth
 * for which fields are shown and which are required. `key` must always be one
 * of DATA_KEYS so the value can be persisted.
 */
const field = (key, label, extra = {}) => ({ key, label, ...extra })
const YEAR = (label = 'Year of passing') =>
  field('yearOfPassing', label, {
    required: true,
    kind: 'year',
    placeholder: `e.g. ${CURRENT_YEAR - 2}`,
  })

const QUAL_TYPES = [
  {
    value: '10th / SSLC',
    icon: FiBook,
    hint: 'Only the year of passing is needed for school level.',
    fields: [YEAR()],
  },
  {
    value: '12th / Higher Secondary',
    icon: FiBookOpen,
    hint: 'Add your stream (Science, Commerce, Humanities) to match more exams.',
    fields: [
      field('specialization', 'Stream', {
        placeholder: 'e.g. Science',
        list: 'sd-specialization-12',
      }),
      YEAR(),
    ],
  },
  {
    value: 'Diploma',
    icon: FiTool,
    hint: 'Course name and year are needed.',
    fields: [
      field('degree', 'Diploma / Course', {
        required: true,
        placeholder: 'e.g. Diploma in Computer Application',
        list: 'sd-degree-diploma',
      }),
      field('specialization', 'Specialization / Branch', {
        placeholder: 'e.g. Computer Application',
      }),
      YEAR(),
    ],
  },
  {
    value: "Bachelor's Degree",
    icon: FiAward,
    hint: 'Degree and year are needed. Specialization helps match exams.',
    fields: [
      field('degree', 'Degree / Course', {
        required: true,
        placeholder: 'e.g. BCA, B.Tech, B.Sc',
        list: 'sd-degree-bachelor',
      }),
      field('specialization', 'Specialization / Stream', {
        placeholder: 'e.g. Computer Science',
      }),
      YEAR(),
    ],
  },
  {
    value: "Master's Degree / PG",
    icon: FiStar,
    hint: 'Degree and year are needed. Specialization helps match exams.',
    fields: [
      field('degree', 'Degree / Course', {
        required: true,
        placeholder: 'e.g. MCA, M.Sc, MBA',
        list: 'sd-degree-master',
      }),
      field('specialization', 'Specialization / Stream', {
        placeholder: 'e.g. Computer Applications',
      }),
      YEAR(),
    ],
  },
  {
    value: 'M.Phil',
    icon: FiLayers,
    hint: 'Add your degree and specialization.',
    fields: [
      field('degree', 'Degree / Course', {
        required: true,
        placeholder: 'e.g. M.Phil in Physics',
      }),
      field('specialization', 'Specialization', { placeholder: 'e.g. Physics' }),
      YEAR(),
    ],
  },
  {
    value: 'Ph.D',
    icon: FiTarget,
    hint: 'Add your research area. Use the year you completed (or expect to complete) it.',
    fields: [
      field('degree', 'Research area / Subject', {
        required: true,
        placeholder: 'e.g. Computer Science',
      }),
      field('specialization', 'Specialization', {
        placeholder: 'e.g. Machine Learning',
      }),
      YEAR('Year of completion'),
    ],
  },
  {
    value: 'Other',
    icon: FiHelpCircle,
    hint: 'Name the qualification in the first box so we can store it correctly.',
    fields: [
      field('degree', 'Qualification name', {
        required: true,
        wide: true,
        placeholder: 'e.g. Chartered Accountancy, ITI, Nursing',
        list: 'sd-degree-other',
      }),
      field('specialization', 'Specialization', { placeholder: 'e.g. Taxation' }),
      YEAR(),
    ],
  },
]

const typeOf = (value) => QUAL_TYPES.find((type) => type.value === value)

/* =========================================================
   NORMALIZED QUALIFICATION OBJECT
   One consistent shape for every qualification type, and it
   matches the database columns exactly.
========================================================= */

const DATA_KEYS = ['degree', 'specialization', 'yearOfPassing']

const makeId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const blankQualification = (highestQualification = '', id = makeId()) => ({
  id,
  highestQualification,
  degree: '',
  specialization: '',
  yearOfPassing: '',
})

/** Keep only the fields allowed for the selected qualification type. */
const sanitizeQualification = (item) => {
  const def = typeOf(item.highestQualification)
  const clean = blankQualification(item.highestQualification || '', item.id || makeId())
  if (!def) return clean
  for (const f of def.fields) {
    clean[f.key] = String(item[f.key] ?? '').trim()
  }
  return clean
}

const summarize = (item) =>
  [item.degree, item.specialization, item.yearOfPassing].filter(Boolean).join(' · ')

/* =========================================================
   DATE / AGE HELPERS
========================================================= */

const localToday = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10)
}

const calculateAge = (dob) => {
  if (!dob) return ''
  const parsed = new Date(`${dob}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return ''

  const today = new Date()
  let years = today.getFullYear() - parsed.getFullYear()
  const birthday = new Date(today.getFullYear(), parsed.getMonth(), parsed.getDate())
  if (today < birthday) years -= 1

  return years >= 0 && years <= 120 ? years : ''
}

/* =========================================================
   STORAGE HELPERS

   This form is the onboarding step, so it always starts blank and
   never reads saved qualifications back. Editing existing details is
   done on /profile/edit instead.
========================================================= */

const writeLocal = (data) => {
  // Mirror into the shared signup draft key so the post-verification sign-in
  // flush can attach these details to the account.
  saveSignupDraft({
    fullName: data?.fullName || '',
    dateOfBirth: data?.dateOfBirth || '',
    age: data?.age ?? '',
    category: data?.category || '',
    qualifications: data?.qualifications || [],
  })
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
    return true
  } catch (error) {
    console.warn('Could not write local qualification copy:', error)
    return false
  }
}

/**
 * The Notifications page reads one row per qualification from
 * `user_qualifications`, so keep that table in step with the profile.
 */
const syncUserQualifications = async (userId, profile, list) => {
  if (list.length === 0) {
    const { error: clearError } = await supabase
      .from('user_qualifications')
      .delete()
      .eq('user_id', userId)
    if (clearError) throw clearError
    return
  }

  const timestamp = new Date().toISOString()

  const rows = list.map((item) => ({
    user_id: userId,
    full_name: profile.full_name,
    date_of_birth: profile.date_of_birth,
    age: profile.age,
    category: profile.category,
    highest_qualification: item.highestQualification,
    degree: item.degree || '',
    specialization: item.specialization || '',
    year_of_passing: item.yearOfPassing ? Number(item.yearOfPassing) : null,
    updated_at: timestamp,
  }))

  // Insert first so a rejected insert can never leave the user with zero rows.
  const { error: insertError } = await supabase
    .from('user_qualifications')
    .insert(rows)
  if (insertError) throw insertError

  const { error: staleError } = await supabase
    .from('user_qualifications')
    .delete()
    .eq('user_id', userId)
    .neq('updated_at', timestamp)
  if (staleError) throw staleError
}

/* =========================================================
   COMPONENT
========================================================= */

export default function QualificationForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state || {}

  const [fullName, setFullName] = useState(routeState.fullName || '')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [age, setAge] = useState('')
  const [category, setCategory] = useState('')
  const [qualifications, setQualifications] = useState([blankQualification()])

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [invalidId, setInvalidId] = useState(null)
  const [lastAddedId, setLastAddedId] = useState(null)

  const messageRef = useRef(null)
  const navTimer = useRef(null)

  useEffect(() => () => clearTimeout(navTimer.current), [])

  /* ---------------------------------------------------------
     SCROLL / FOCUS HELPERS
  --------------------------------------------------------- */

  useEffect(() => {
    if (!lastAddedId) return
    const card = document.getElementById(`qual-${lastAddedId}`)
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' })
      card.querySelector('select')?.focus({ preventScroll: true })
    }
  }, [lastAddedId])

  useEffect(() => {
    if (message && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [message])

  /* ---------------------------------------------------------
     QUALIFICATION HANDLERS
  --------------------------------------------------------- */

  const updateField = useCallback((id, key, value) => {
    setInvalidId(null)
    setQualifications((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    )
  }, [])

  // Changing the type resets every type-specific field so stale values
  // (e.g. a BCA degree on a 10th card) can never be saved. Year is kept.
  const changeType = useCallback((id, nextType) => {
    setInvalidId(null)
    setQualifications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...blankQualification(nextType, id),
              yearOfPassing: item.yearOfPassing,
            }
          : item
      )
    )
  }, [])

  const addQualification = useCallback(() => {
    const next = blankQualification()
    setQualifications((current) => [...current, next])
    setLastAddedId(next.id)
  }, [])

  const removeQualification = useCallback((id) => {
    setInvalidId(null)
    setQualifications((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id)
    )
  }, [])

  /* ---------------------------------------------------------
     AGE
  --------------------------------------------------------- */

  const onDateOfBirthChange = (value) => {
    setDateOfBirth(value)
    setAge(calculateAge(value))
  }

  /* ---------------------------------------------------------
     VALIDATION (depends on the qualification type)
  --------------------------------------------------------- */

  const validate = () => {
    if (!fullName.trim()) return { text: 'Enter your full name.' }

    if (dateOfBirth) {
      const dob = new Date(`${dateOfBirth}T00:00:00`)
      if (Number.isNaN(dob.getTime()) || dateOfBirth > localToday()) {
        return { text: 'Date of birth must be a valid date that is not in the future.' }
      }
    }

    if (age !== '') {
      const numericAge = Number(age)
      if (!Number.isFinite(numericAge) || numericAge < 0 || numericAge > 120) {
        return { text: 'Enter an age between 0 and 120.' }
      }
    }

    const dobYear = dateOfBirth ? Number(dateOfBirth.slice(0, 4)) : null

    for (const [index, item] of qualifications.entries()) {
      const name = `Qualification ${index + 1}`
      const def = typeOf(item.highestQualification)
      const fail = (text) => ({ text: `${name}: ${text}`, cardId: item.id })

      if (!def) {
        const touched = DATA_KEYS.some((key) => String(item[key] || '').trim())
        // A completely empty card is ignored on save; a half-filled one is not.
        if (touched) return fail('select the qualification type.')
        continue
      }

      for (const f of def.fields) {
        if (f.required && !String(item[f.key] || '').trim()) {
          return fail(`${f.label.toLowerCase()} is required.`)
        }
      }

      if (item.yearOfPassing !== '') {
        const year = Number(item.yearOfPassing)
        if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
          return fail(`enter a year between ${MIN_YEAR} and ${MAX_YEAR}.`)
        }
        if (dobYear && year < dobYear) {
          return fail('the year cannot be earlier than your birth year.')
        }
      }
    }

    return null
  }

  const cleanedList = () =>
    qualifications
      .filter((item) => typeOf(item.highestQualification))
      .map(sanitizeQualification)

  /* ---------------------------------------------------------
     SAVE
  --------------------------------------------------------- */

  const goNext = () => navigate('/select-exam')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    setMessage(null)
    setInvalidId(null)

    const problem = validate()
    if (problem) {
      setInvalidId(problem.cardId || null)
      setMessage({ type: 'error', text: problem.text })
      if (problem.cardId) {
        document
          .getElementById(`qual-${problem.cardId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    const list = cleanedList()
    const numericAge = age === '' ? null : Number(age)

    const profile = {
      full_name: fullName.trim(),
      date_of_birth: dateOfBirth || null,
      age: numericAge,
      category: category || null,
    }

    setSaving(true)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser().then(
      (result) => result,
      () => ({ data: { user: null }, error: null })
    )

    // Because the form always starts blank, an accidental submit with no
    // qualifications would wipe data that is already saved. Checked before
    // anything is written, including the local draft.
    if (user && list.length === 0) {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('qualifications')
        .eq('id', user.id)
        .maybeSingle()

      const saved = existing?.qualifications
      if (Array.isArray(saved) && saved.length > 0) {
        setMessage({
          type: 'error',
          text: 'Add at least one qualification before saving. Your saved qualifications have been left unchanged. You can edit them any time from Profile > Edit Profile.',
        })
        setSaving(false)
        return
      }
    }

    // 1. Local copy so nothing is lost if the network fails.
    const localOk = writeLocal({
      fullName: fullName.trim(),
      dateOfBirth,
      age: numericAge === null ? '' : numericAge,
      category,
      qualifications: list,
      savedAt: new Date().toISOString(),
    })

    try {
      if (authError) throw authError

      if (!user) {
        setMessage({
          type: localOk ? 'ok' : 'error',
          text: localOk
            ? 'Saved on this device. Sign in to sync these details with your account.'
            : 'We could not save your details. Check that browser storage is enabled.',
        })
        if (localOk) navTimer.current = setTimeout(goNext, 700)
        return
      }

      // 2. Profile (JSONB qualifications).
      const { error: profileError } = await supabase.from('user_profiles').upsert(
        {
          id: user.id,
          ...profile,
          qualifications: list,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (profileError) throw profileError

      // 3. Per-row table used by exam matching on the Notifications page.
      try {
        await syncUserQualifications(user.id, profile, list)
      } catch (syncError) {
        console.error('user_qualifications sync failed:', syncError)
        setMessage({
          type: 'warning',
          text: `Your profile was saved, but exam matching could not be updated (${
            syncError?.message || 'unknown error'
          }). Your details are also stored on this device.`,
          canContinue: true,
        })
        return
      }

      setMessage({ type: 'ok', text: 'Qualification details saved.' })
      navTimer.current = setTimeout(goNext, 600)
    } catch (error) {
      console.error('QualificationForm save failed:', error)
      setMessage({
        type: localOk ? 'warning' : 'error',
        text: localOk
          ? `We could not save to your account (${
              error?.message || 'network error'
            }). Your details are saved on this device.`
          : error?.message || 'Could not save your qualification details.',
        canContinue: localOk,
      })
    } finally {
      setSaving(false)
    }
  }

  const skipToExams = () => {
    writeLocal({
      fullName: fullName.trim(),
      dateOfBirth,
      age: age === '' ? '' : Number(age),
      category,
      qualifications: cleanedList(),
      savedAt: new Date().toISOString(),
    })
    goNext()
  }

  const completedCount = useMemo(
    () => qualifications.filter((item) => typeOf(item.highestQualification)).length,
    [qualifications]
  )

  /* ---------------------------------------------------------
     UI
  --------------------------------------------------------- */

  return (
    <div className="qf-page">
      <div className="qf-wrap">
        <button
          type="button"
          className="qf-back"
          onClick={() => navigate(routeState.from === 'login' ? '/login' : '/signup')}
        >
          <FiArrowLeft size={18} />
          Back
        </button>

        <header className="qf-header">
          <span className="qf-step">Step 1 of 2</span>
          <h1>Tell us about your qualifications</h1>
          <p>
            Add every qualification you hold. SmartDoc AI compares them with each
            exam notification to show the exams you are eligible for.
          </p>
        </header>

        <form className="qf-card" onSubmit={handleSubmit} noValidate>
          {/* Shared suggestion lists */}
          {Object.entries(SUGGESTIONS).map(([id, options]) => (
            <datalist id={id} key={id}>
              {options.map((option) => (
                <option value={option} key={option} />
              ))}
            </datalist>
          ))}

          {/* PERSONAL DETAILS */}
          <section className="qf-section">
            <h2>Personal details</h2>

            <div className="qf-grid">
              <label className="qf-field qf-field--wide">
                <span>
                  Full name <em className="qf-req">*</em>
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                />
              </label>

              <label className="qf-field">
                <span>Date of birth</span>
                <input
                  type="date"
                  value={dateOfBirth}
                  max={localToday()}
                  onChange={(event) => onDateOfBirthChange(event.target.value)}
                />
              </label>

              <label className="qf-field">
                <span>Age</span>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  placeholder="Calculated from date of birth"
                />
              </label>

              <label className="qf-field qf-field--wide">
                <span>Category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value || 'none'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* QUALIFICATIONS */}
          <section className="qf-section">
            <div className="qf-section-head">
              <div>
                <h2>Educational qualifications</h2>
                <p className="qf-section-description">
                  The fields change with the qualification you pick.
                </p>
              </div>

              <button type="button" className="qf-add" onClick={addQualification}>
                <FiPlus size={15} />
                Add qualification
              </button>
            </div>

            {qualifications.map((item, index) => {
              const def = typeOf(item.highestQualification)
              const Icon = def?.icon || FiBook
              const summary = summarize(item)
              const onlyOne = qualifications.length === 1

              return (
                <div
                  className={`qf-qual${invalidId === item.id ? ' qf-qual--invalid' : ''}`}
                  key={item.id}
                  id={`qual-${item.id}`}
                >
                  <div className="qf-qual-head">
                    <div className="qf-qual-title">
                      <span className="qf-qual-icon" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div>
                        <strong>Qualification {index + 1}</strong>
                        {summary && <small>{summary}</small>}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="qf-remove"
                      onClick={() => removeQualification(item.id)}
                      disabled={onlyOne}
                      title={
                        onlyOne
                          ? 'At least one qualification card is required'
                          : `Remove qualification ${index + 1}`
                      }
                      aria-label={`Remove qualification ${index + 1}`}
                    >
                      <FiTrash2 size={15} />
                    </button>
                  </div>

                  <div className="qf-grid">
                    <label className="qf-field qf-field--wide">
                      <span>
                        Qualification <em className="qf-req">*</em>
                      </span>
                      <select
                        value={item.highestQualification}
                        onChange={(event) => changeType(item.id, event.target.value)}
                      >
                        <option value="">Select qualification</option>
                        {QUAL_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.value}
                          </option>
                        ))}
                      </select>
                    </label>

                    {def ? (
                      <>
                        <p className="qf-qual-hint qf-field--wide">
                          <FiInfo size={14} aria-hidden="true" />
                          {def.hint}
                        </p>

                        {def.fields.map((f) => (
                          <label
                            key={`${item.id}-${item.highestQualification}-${f.key}`}
                            className={`qf-field${f.wide ? ' qf-field--wide' : ''}`}
                          >
                            <span>
                              {f.label}{' '}
                              {f.required ? (
                                <em className="qf-req">*</em>
                              ) : (
                                <em className="qf-opt">optional</em>
                              )}
                            </span>
                            <input
                              type={f.kind === 'year' ? 'number' : 'text'}
                              inputMode={f.kind === 'year' ? 'numeric' : undefined}
                              min={f.kind === 'year' ? MIN_YEAR : undefined}
                              max={f.kind === 'year' ? MAX_YEAR : undefined}
                              list={f.list}
                              value={item[f.key]}
                              onChange={(event) =>
                                updateField(item.id, f.key, event.target.value)
                              }
                              placeholder={f.placeholder}
                              autoComplete="off"
                            />
                          </label>
                        ))}
                      </>
                    ) : (
                      <p className="qf-qual-empty qf-field--wide">
                        Choose a qualification above to see the fields that apply.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              className="qf-add-row"
              onClick={addQualification}
            >
              <FiPlus size={16} />
              Add another qualification
            </button>

            <p className="qf-hint">
              SmartDoc AI uses the qualification, degree, specialization and your age
              to find suitable exam notifications.
            </p>
          </section>

          {/* STATUS MESSAGE (kept next to the buttons so it is never missed) */}
          {message && (
            <div
              ref={messageRef}
              className={`qf-banner qf-banner--${
                message.type === 'ok'
                  ? 'success'
                  : message.type === 'warning'
                    ? 'warning'
                    : 'error'
              }`}
              role="alert"
            >
              <span>{message.text}</span>
              {message.canContinue && (
                <button type="button" className="qf-banner-btn" onClick={goNext}>
                  Continue to exam selection
                </button>
              )}
            </div>
          )}

          {/* ACTIONS */}
          <div className="qf-actions">
            <button type="submit" className="qf-primary" disabled={saving}>
              {saving ? 'Saving details…' : 'Save & continue to exam selection'}
            </button>

            <button
              type="button"
              className="qf-ghost"
              onClick={skipToExams}
              disabled={saving}
            >
              Skip for now
            </button>
          </div>

          {completedCount > 0 && (
            <p className="qf-summary">
              <FiCheckCircle size={16} />
              {completedCount} qualification{completedCount === 1 ? '' : 's'} will be
              used for exam matching.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
