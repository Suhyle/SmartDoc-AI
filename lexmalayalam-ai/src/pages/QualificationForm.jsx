import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import './QualificationForm.css'

/* =========================================================
   CONSTANTS
========================================================= */

const STORAGE_KEY = 'smartdoc_qualification'

const GENERAL_STREAMS = [
  'Computer Science',
  'Information Technology',
  'Mathematics',
  'Physics',
  'Chemistry',
  'Commerce',
  'Arts / Humanities',
  'Engineering',
  'Management',
  'Education',
  'Law',
  'Other',
]

const QUALIFICATION_CONFIG = {
  '10th': {
    degrees: null,
    streams: null,
  },

  '12th': {
    degrees: null,
    streams: [
      'Science',
      'Commerce',
      'Humanities / Arts',
      'Vocational',
      'Other',
    ],
  },

  Diploma: {
    degrees: [
      'Diploma (Engineering)',
      'Diploma (Other)',
      'ITI',
      'Other',
    ],
    streams: GENERAL_STREAMS,
  },

  "Bachelor's Degree": {
    degrees: [
      'BCA',
      'B.Sc',
      'B.Tech / B.E',
      'BA',
      'B.Com',
      'BBA',
      'B.Ed',
      'LLB',
      'Other',
    ],
    streams: GENERAL_STREAMS,
  },

  "Master's Degree": {
    degrees: [
      'MCA',
      'M.Sc',
      'M.Tech / M.E',
      'MA',
      'M.Com',
      'MBA',
      'M.Ed',
      'LLM',
      'Other',
    ],
    streams: GENERAL_STREAMS,
  },

  Other: {
    degrees: ['Other'],
    streams: GENERAL_STREAMS,
  },
}

const QUALIFICATIONS = Object.keys(QUALIFICATION_CONFIG)

const CATEGORIES = [
  'General',
  'OBC',
  'SC',
  'ST',
  'Other',
  'Prefer not to say',
]

const MIN_AGE = 14
const MAX_AGE = 100

const createQualification = () => ({
  highestQualification: '',
  degree: '',
  specialization: '',
  yearOfPassing: '',
})

const EMPTY_FORM = {
  fullName: '',
  dateOfBirth: '',
  category: '',
  qualifications: [createQualification()],
}

/* =========================================================
   HELPERS
========================================================= */

const todayISO = () => {
  const d = new Date()

  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${d.getFullYear()}-${month}-${day}`
}

const calculateAge = (isoDate) => {
  if (!isoDate) return null

  const birth = new Date(isoDate)

  if (Number.isNaN(birth.getTime())) {
    return null
  }

  const today = new Date()

  let age = today.getFullYear() - birth.getFullYear()

  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() >= birth.getDate())

  if (!hadBirthday) {
    age -= 1
  }

  return age
}

const readSavedQualification = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/* =========================================================
   ICONS
========================================================= */

const Icon = ({ name, size = 18 }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (name) {
    case 'user':
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )

    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9.5h18M8 3v3M16 3v3" />
        </svg>
      )

    case 'cake':
      return (
        <svg {...common}>
          <path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z" />
          <path d="M4 15c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0" />
          <path d="M12 11V7M12 4.5v.5" />
        </svg>
      )

    case 'cap':
      return (
        <svg {...common}>
          <path d="M2 9l10-5 10 5-10 5z" />
          <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
        </svg>
      )

    case 'book':
      return (
        <svg {...common}>
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 2-2 2z" />
          <path d="M4 19V5M9 8h6" />
        </svg>
      )

    case 'branch':
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="2.2" />
          <circle cx="5.5" cy="18" r="2.2" />
          <circle cx="18.5" cy="18" r="2.2" />
          <path d="M12 7.2v4M12 11.2l-5 5M12 11.2l5 5" />
        </svg>
      )

    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )

    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c.4-3.5 2.8-5.5 6.5-5.5s6.1 2 6.5 5.5" />
          <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .6 3.2 2.3 3.5 5.2" />
        </svg>
      )

    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )

    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 7V4h6v3" />
          <path d="M6 7l1 14h10l1-14" />
        </svg>
      )

    case 'arrow-right':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )

    case 'check':
      return (
        <svg {...common} strokeWidth="2.6">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )

    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5M12 8h.01" strokeWidth="2.4" />
        </svg>
      )

    default:
      return null
  }
}

/* =========================================================
   REUSABLE FIELD
========================================================= */

function Field({
  id,
  label,
  icon,
  required,
  error,
  hint,
  children,
}) {
  return (
    <div className={`qf-field ${error ? 'qf-field--error' : ''}`}>
      <label className="qf-label" htmlFor={id}>
        <span className="qf-label-icon">
          <Icon name={icon} size={16} />
        </span>

        {label}

        {required && (
          <span className="qf-required" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {hint && !error && (
        <p className="qf-hint">
          {hint}
        </p>
      )}

      {error && (
        <p
          className="qf-error"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}

/* =========================================================
   QUALIFICATION CARD
========================================================= */

function QualificationCard({
  qualification,
  index,
  errors,
  currentYear,
  yearOptions,
  canRemove,
  onChange,
  onRemove,
}) {
  const config =
    QUALIFICATION_CONFIG[
      qualification.highestQualification
    ]

  const showDegree = Boolean(config?.degrees)
  const showStream = Boolean(config?.streams)

  const update = (name, value) => {
    onChange(index, name, value)
  }

  return (
    <div className="qf-qualification-card">

      {/* Header */}

      <div className="qf-qualification-header">

        <div>
          <p className="qf-qualification-number">
            Qualification {index + 1}
          </p>

          <p className="qf-qualification-help">
            Add your educational qualification details.
          </p>
        </div>

        {canRemove && (
          <button
            type="button"
            className="qf-remove-button"
            onClick={() => onRemove(index)}
            aria-label={`Remove qualification ${index + 1}`}
            title="Remove qualification"
          >
            <Icon name="trash" size={17} />
          </button>
        )}

      </div>

      {/* Qualification */}

      <Field
        id={`qf-qualification-${index}`}
        label="Qualification"
        icon="cap"
        required
        error={errors?.highestQualification}
      >
        <select
          id={`qf-qualification-${index}`}
          className="qf-input qf-select"
          value={qualification.highestQualification}
          onChange={(event) =>
            update(
              'highestQualification',
              event.target.value
            )
          }
          aria-invalid={Boolean(
            errors?.highestQualification
          )}
        >
          <option value="">
            Select qualification
          </option>

          {QUALIFICATIONS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </Field>

      {/* Degree */}

      {showDegree && (
        <Field
          id={`qf-degree-${index}`}
          label="Degree / Course"
          icon="book"
          required
          error={errors?.degree}
        >
          <select
            id={`qf-degree-${index}`}
            className="qf-input qf-select"
            value={qualification.degree}
            onChange={(event) =>
              update(
                'degree',
                event.target.value
              )
            }
            aria-invalid={Boolean(errors?.degree)}
          >
            <option value="">
              Select degree / course
            </option>

            {config.degrees.map((degree) => (
              <option key={degree} value={degree}>
                {degree}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Stream */}

      {showStream && (
        <Field
          id={`qf-specialization-${index}`}
          label="Stream / Specialization"
          icon="branch"
          required
          error={errors?.specialization}
        >
          <select
            id={`qf-specialization-${index}`}
            className="qf-input qf-select"
            value={qualification.specialization}
            onChange={(event) =>
              update(
                'specialization',
                event.target.value
              )
            }
            aria-invalid={Boolean(
              errors?.specialization
            )}
          >
            <option value="">
              Select stream / specialization
            </option>

            {config.streams.map((stream) => (
              <option key={stream} value={stream}>
                {stream}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Year */}

      <Field
        id={`qf-year-${index}`}
        label="Year of Passing"
        icon="clock"
        required
        error={errors?.yearOfPassing}
        hint={`Select ${currentYear + 1} if you are in your final year.`}
      >
        <select
          id={`qf-year-${index}`}
          className="qf-input qf-select"
          value={qualification.yearOfPassing}
          onChange={(event) =>
            update(
              'yearOfPassing',
              event.target.value
            )
          }
          aria-invalid={Boolean(
            errors?.yearOfPassing
          )}
        >
          <option value="">
            Select year
          </option>

          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </Field>

    </div>
  )
}

/* =========================================================
   QUALIFICATION FORM PAGE
========================================================= */

export default function QualificationForm() {

  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY_FORM)

  const [errors, setErrors] = useState({})

  const [isSaving, setIsSaving] = useState(false)

  const currentYear =
    new Date().getFullYear()

  const yearOptions = useMemo(() => {

    const years = []

    for (
      let year = currentYear + 1;
      year >= 1980;
      year -= 1
    ) {
      years.push(String(year))
    }

    return years

  }, [currentYear])

  const age = useMemo(
    () => calculateAge(form.dateOfBirth),
    [form.dateOfBirth]
  )

  /* =======================================================
     PREFILL
  ======================================================= */

  useEffect(() => {

    let isMounted = true

    const saved =
      readSavedQualification()

    if (saved) {

      setForm((previous) => ({
        ...previous,

        fullName:
          saved.fullName || '',

        dateOfBirth:
          saved.dateOfBirth || '',

        category:
          saved.category || '',

        qualifications:
          Array.isArray(saved.qualifications) &&
          saved.qualifications.length
            ? saved.qualifications
            : [
                {
                  highestQualification:
                    saved.highestQualification || '',

                  degree:
                    saved.degree || '',

                  specialization:
                    saved.specialization || '',

                  yearOfPassing:
                    saved.yearOfPassing || '',
                },
              ],
      }))

      return undefined
    }

    const prefillName = async () => {

      try {

        const { data } =
          await supabase.auth.getSession()

        const name =
          data?.session?.user?.user_metadata
            ?.full_name

        if (isMounted && name) {

          setForm((previous) =>
            previous.fullName
              ? previous
              : {
                  ...previous,
                  fullName: name,
                }
          )
        }

      } catch {
        // No active session.
      }

    }

    prefillName()

    return () => {
      isMounted = false
    }

  }, [])

  /* =======================================================
     PERSONAL INFORMATION CHANGE
  ======================================================= */

  const handlePersonalChange = (event) => {

    const {
      name,
      value,
    } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))

    setErrors((previous) => ({
      ...previous,
      [name]: '',
    }))
  }

  /* =======================================================
     QUALIFICATION CHANGE
  ======================================================= */

  const handleQualificationChange = (
    index,
    name,
    value
  ) => {

    setForm((previous) => {

      const qualifications =
        previous.qualifications.map(
          (item, itemIndex) => {

            if (itemIndex !== index) {
              return item
            }

            const next = {
              ...item,
              [name]: value,
            }

            /* Reset dependent fields */

            if (
              name ===
              'highestQualification'
            ) {
              next.degree = ''
              next.specialization = ''
            }

            return next
          }
        )

      return {
        ...previous,
        qualifications,
      }
    })

    setErrors((previous) => {

      const qualificationErrors = [
        ...(previous.qualifications || []),
      ]

      qualificationErrors[index] = {
        ...(qualificationErrors[index] || {}),
        [name]: '',
      }

      return {
        ...previous,
        qualifications:
          qualificationErrors,
      }
    })
  }

  /* =======================================================
     ADD QUALIFICATION
  ======================================================= */

  const addQualification = () => {

    setForm((previous) => ({
      ...previous,

      qualifications: [
        ...previous.qualifications,
        createQualification(),
      ],
    }))
  }

  /* =======================================================
     REMOVE QUALIFICATION
  ======================================================= */

  const removeQualification = (index) => {

    setForm((previous) => {

      if (
        previous.qualifications.length <= 1
      ) {
        return previous
      }

      return {
        ...previous,

        qualifications:
          previous.qualifications.filter(
            (_, itemIndex) =>
              itemIndex !== index
          ),
      }
    })

    setErrors((previous) => ({
      ...previous,

      qualifications:
        (previous.qualifications || [])
          .filter(
            (_, itemIndex) =>
              itemIndex !== index
          ),
    }))
  }

  /* =======================================================
     VALIDATION
  ======================================================= */

  const validate = () => {

    const found = {}

    const qualificationErrors = []

    /* Full name */

    if (!form.fullName.trim()) {

      found.fullName =
        'Please enter your full name.'
    }

    /* Date of birth */

    if (!form.dateOfBirth) {

      found.dateOfBirth =
        'Please enter your date of birth.'

    } else if (
      age === null ||
      age < 0
    ) {

      found.dateOfBirth =
        'Date of birth cannot be in the future.'

    } else if (
      age < MIN_AGE ||
      age > MAX_AGE
    ) {

      found.dateOfBirth =
        'Please check your date of birth.'
    }

    /* Category */

    if (!form.category) {

      found.category =
        'Please select your category.'
    }

    /* Qualifications */

    form.qualifications.forEach(
      (qualification, index) => {

        const itemErrors = {}

        const config =
          QUALIFICATION_CONFIG[
            qualification
              .highestQualification
          ]

        if (
          !qualification
            .highestQualification
        ) {

          itemErrors.highestQualification =
            'Please select a qualification.'
        }

        if (
          config?.degrees &&
          !qualification.degree
        ) {

          itemErrors.degree =
            'Please select your degree/course.'
        }

        if (
          config?.streams &&
          !qualification.specialization
        ) {

          itemErrors.specialization =
            'Please select your stream/specialization.'
        }

        if (
          !qualification.yearOfPassing
        ) {

          itemErrors.yearOfPassing =
            'Please select your year of passing.'
        }

        qualificationErrors[index] =
          itemErrors
      }
    )

    if (
      qualificationErrors.some(
        (item) =>
          Object.keys(item).length > 0
      )
    ) {

      found.qualifications =
        qualificationErrors
    }

    return found
  }

  /* =======================================================
     SUBMIT
  ======================================================= */

  const handleSubmit = (event) => {

    event.preventDefault()

    if (isSaving) {
      return
    }

    const found = validate()

    setErrors(found)

    if (
      Object.keys(found).length > 0
    ) {

      /* Focus first qualification error */

      const firstQualificationError =
        found.qualifications?.findIndex(
          (item) =>
            Object.keys(item).length > 0
        )

      if (
        firstQualificationError !==
          undefined &&
        firstQualificationError >= 0
      ) {

        const firstField =
          Object.keys(
            found.qualifications[
              firstQualificationError
            ]
          )[0]

        let elementId

        if (
          firstField ===
          'highestQualification'
        ) {

          elementId =
            `qf-qualification-${firstQualificationError}`

        } else if (
          firstField === 'degree'
        ) {

          elementId =
            `qf-degree-${firstQualificationError}`

        } else if (
          firstField === 'specialization'
        ) {

          elementId =
            `qf-specialization-${firstQualificationError}`

        } else {

          elementId =
            `qf-year-${firstQualificationError}`
        }

        document
          .getElementById(elementId)
          ?.focus()

      } else {

        const firstKey =
          Object.keys(found)[0]

        document
          .getElementById(
            `qf-${firstKey}`
          )
          ?.focus()
      }

      return
    }

    setIsSaving(true)

    const qualification = {

      fullName:
        form.fullName.trim(),

      dateOfBirth:
        form.dateOfBirth,

      age,

      category:
        form.category,

      qualifications:
        form.qualifications.map(
          (item) => ({
            highestQualification:
              item.highestQualification,

            degree:
              item.degree || '',

            specialization:
              item.specialization || '',

            yearOfPassing:
              item.yearOfPassing,
          })
        ),

      savedAt:
        new Date().toISOString(),
    }

    try {

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          qualification
        )
      )

    } catch (error) {

      console.error(
        'Could not save qualification:',
        error
      )

      setIsSaving(false)

      setErrors({
        form:
          'We could not save your details. Please try again.',
      })

      return
    }

    /* Existing flow */

    navigate('/select-exam')
  }

  const describedBy = (name) =>
    errors[name]
      ? `qf-${name}-error`
      : undefined

  /* =======================================================
     UI
  ======================================================= */

  return (
    <main className="qf-page">

      {/* Background */}

      <div
        className="qf-orb qf-orb--one"
        aria-hidden="true"
      />

      <div
        className="qf-orb qf-orb--two"
        aria-hidden="true"
      />

      <div
        className="qf-orb qf-orb--three"
        aria-hidden="true"
      />

      <div className="qf-container">

        {/* Brand */}

        <header className="qf-header">

          <div
            className="qf-logo"
            aria-hidden="true"
          >
            <span className="qf-logo-doc">
              <span className="qf-logo-line" />

              <span className="qf-logo-line qf-logo-line--short" />
            </span>
          </div>

          <div>

            <h1 className="qf-brand">
              SmartDoc <span>AI</span>
            </h1>

            <p className="qf-tagline">
              AI-Powered Exam Learning Assistant
            </p>

          </div>

        </header>

        {/* Progress */}

        <nav
          className="qf-progress"
          aria-label="Setup progress"
        >

          <ol>

            <li className="qf-step qf-step--done">

              <span className="qf-step-dot">
                <Icon
                  name="check"
                  size={11}
                />
              </span>

              <span className="qf-step-text">
                Sign Up
              </span>

            </li>

            <li
              className="qf-step qf-step--active"
              aria-current="step"
            >

              <span className="qf-step-dot" />

              <span className="qf-step-text">
                Qualification
              </span>

            </li>

            <li className="qf-step">

              <span className="qf-step-dot" />

              <span className="qf-step-text">
                Select Exam
              </span>

            </li>

            <li className="qf-step">

              <span className="qf-step-dot" />

              <span className="qf-step-text">
                Start Learning
              </span>

            </li>

          </ol>

        </nav>

        {/* Title */}

        <section className="qf-title-section">

          <h2 className="qf-title">
            Complete Your Profile
          </h2>

          <p className="qf-subtitle">
            Add all your educational qualifications
            to discover relevant competitive exams.
          </p>

        </section>

        {/* Form */}

        <form
          className="qf-card"
          onSubmit={handleSubmit}
          noValidate
        >

          {/* Personal Information */}

          <fieldset className="qf-section">

            <legend className="qf-section-title">
              Personal Information
            </legend>

            <Field
              id="qf-fullName"
              label="Full Name"
              icon="user"
              required
              error={errors.fullName}
            >

              <input
                id="qf-fullName"
                name="fullName"
                type="text"
                className="qf-input"
                placeholder="Enter your full name"
                autoComplete="name"
                value={form.fullName}
                onChange={
                  handlePersonalChange
                }
                aria-invalid={
                  Boolean(
                    errors.fullName
                  )
                }
                aria-describedby={
                  describedBy(
                    'fullName'
                  )
                }
              />

            </Field>

            <div className="qf-row">

              <Field
                id="qf-dateOfBirth"
                label="Date of Birth"
                icon="calendar"
                required
                error={errors.dateOfBirth}
              >

                <input
                  id="qf-dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  className="qf-input"
                  max={todayISO()}
                  min="1920-01-01"
                  value={
                    form.dateOfBirth
                  }
                  onChange={
                    handlePersonalChange
                  }
                  aria-invalid={
                    Boolean(
                      errors.dateOfBirth
                    )
                  }
                  aria-describedby={
                    describedBy(
                      'dateOfBirth'
                    )
                  }
                />

              </Field>

              <Field
                id="qf-age"
                label="Age"
                icon="cake"
              >

                <output
                  id="qf-age"
                  className={`qf-input qf-age ${
                    age !== null &&
                    age >= 0
                      ? 'qf-age--filled'
                      : ''
                  }`}
                >

                  {age !== null &&
                  age >= 0
                    ? `${age} years`
                    : 'Calculated from date of birth'}

                </output>

              </Field>

            </div>

          </fieldset>

          {/* Educational Qualifications */}

          <fieldset className="qf-section">

            <div className="qf-section-heading">

              <div>

                <legend className="qf-section-title qf-section-title--plain">
                  Educational Qualifications
                </legend>

                <p className="qf-section-description">
                  Add every qualification you
                  have completed or are currently
                  pursuing.
                </p>

              </div>

              <span className="qf-count">

                {form.qualifications.length}{' '}

                {form.qualifications.length ===
                1
                  ? 'qualification'
                  : 'qualifications'}

              </span>

            </div>

            {/* Qualification cards */}

            <div className="qf-qualification-list">

              {form.qualifications.map(
                (
                  qualification,
                  index
                ) => (

                  <QualificationCard
                    key={index}
                    qualification={
                      qualification
                    }
                    index={index}
                    errors={
                      errors
                        .qualifications?.[
                        index
                      ] || {}
                    }
                    currentYear={
                      currentYear
                    }
                    yearOptions={
                      yearOptions
                    }
                    canRemove={
                      form.qualifications
                        .length > 1
                    }
                    onChange={
                      handleQualificationChange
                    }
                    onRemove={
                      removeQualification
                    }
                  />

                )
              )}

            </div>

            {/* Add button */}

            <button
              type="button"
              className="qf-add-button"
              onClick={
                addQualification
              }
            >

              <Icon
                name="plus"
                size={18}
              />

              <span>
                Add Another Qualification
              </span>

            </button>

          </fieldset>

          {/* Category */}

          <fieldset className="qf-section">

            <legend className="qf-section-title">
              Other Eligibility Information
            </legend>

            <Field
              id="qf-category"
              label="Category"
              icon="users"
              required
              error={errors.category}
              hint="Some exams have age relaxation or reservation rules by category."
            >

              <select
                id="qf-category"
                name="category"
                className="qf-input qf-select"
                value={form.category}
                onChange={
                  handlePersonalChange
                }
                aria-invalid={
                  Boolean(
                    errors.category
                  )
                }
                aria-describedby={
                  describedBy(
                    'category'
                  )
                }
              >

                <option value="">
                  Select category
                </option>

                {CATEGORIES.map(
                  (category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  )
                )}

              </select>

            </Field>

          </fieldset>

          {/* Note */}

          <div className="qf-note">

            <Icon
              name="info"
              size={18}
            />

            <p>
              Your qualifications will be
              used to identify relevant
              competitive exams. You will
              choose the exams you want to
              prepare for in the next step.
              You can update these details
              later in Settings.
            </p>

          </div>

          {/* Form error */}

          {errors.form && (
            <div
              className="qf-form-error"
              role="alert"
            >
              {errors.form}
            </div>
          )}

          {/* Submit */}

          <button
            type="submit"
            className="qf-submit"
            disabled={isSaving}
          >

            <span>
              {isSaving
                ? 'Saving...'
                : 'Find Eligible Exams'}
            </span>

            {!isSaving && (
              <Icon
                name="arrow-right"
                size={20}
              />
            )}

          </button>

          <p className="qf-required-note">

            <span aria-hidden="true">
              *
            </span>{' '}
            Required field

          </p>

        </form>

      </div>

    </main>
  )
}