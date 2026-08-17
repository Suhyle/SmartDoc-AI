import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './SelectExam.css'


/* =========================================================
   ICON COMPONENT
========================================================= */

const Icon = ({ name, size = 24, stroke = 'currentColor' }) => {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  switch (name) {
    case 'arrow-left':
      return (
        <svg {...common}>
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
      )

    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9.2" />
          <path d="M9.7 9a2.5 2.5 0 1 1 4.4 1.6c-.8.9-2.1 1.2-2.1 2.7" />
          <path d="M12 16.7h.01" strokeWidth="2.5" />
        </svg>
      )

    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 2l1.2 6.8L20 10l-6.8 1.2L12 18l-1.2-6.8L4 10l6.8-1.2L12 2Z" />
        </svg>
      )

    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      )

    case 'chevron-right':
      return (
        <svg {...common}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      )

    case 'x':
      return (
        <svg {...common}>
          <path d="M7 7l10 10" />
          <path d="M17 7L7 17" />
        </svg>
      )

    case 'rocket':
      return (
        <svg {...common}>
          <path d="M14.5 4.5c2.4-2.4 5.1-2.5 5.1-2.5s-.1 2.7-2.5 5.1l-3.4 3.4-4.7-1.3-1.3-4.7 6.8-.0Z" />
          <path d="M10.7 9.3L6 14l4 4 4.7-4.7" />
          <path d="M6 14l-2.5 2.5" />
          <path d="M10 18l-2.5 2.5" />
          <path d="M6.2 9.8c-1.7-.2-3 .2-4 1.2l3 1" />
        </svg>
      )

    case 'psc':
      return (
        <svg {...common}>
          <path d="M4 20h16" />
          <path d="M6 20V9h12v11" />
          <path d="M4.5 9L12 4l7.5 5" />
          <path d="M9 20v-6h6v6" />
          <path d="M8 9V7.5M12 9V7.5M16 9V7.5" />
        </svg>
      )

    case 'ssc':
      return (
        <svg {...common}>
          <circle cx="12" cy="7" r="3" />
          <path d="M6 20c.4-3.6 2.4-5.5 6-5.5s5.6 1.9 6 5.5" />
          <path d="M4 12.5h4" />
          <path d="M16 12.5h4" />
          <path d="M5.5 11v3M18.5 11v3" />
        </svg>
      )

    case 'upsc':
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.2-2.8 7.7-7 10-4.2-2.3-7-5.8-7-10V6l7-3Z" />
          <path d="M9 12h6" />
          <path d="M10 9h4" />
          <path d="M10 15h4" />
          <path d="M12 8v8" />
        </svg>
      )

    case 'bank':
      return (
        <svg {...common}>
          <path d="M3 9h18" />
          <path d="M4 20h16" />
          <path d="M5 9v9M9 9v9M15 9v9M19 9v9" />
          <path d="M2.5 7L12 3l9.5 4" />
        </svg>
      )

    case 'railway':
      return (
        <svg {...common}>
          <rect x="6" y="3" width="12" height="13" rx="3" />
          <path d="M8.5 20h7" />
          <path d="M9 16l-2 4M15 16l2 4" />
          <path d="M8.5 8h7" />
          <circle cx="9.5" cy="12.5" r="1" />
          <circle cx="14.5" cy="12.5" r="1" />
        </svg>
      )

    case 'other':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1.2" />
          <rect x="14" y="4" width="6" height="6" rx="1.2" />
          <rect x="4" y="14" width="6" height="6" rx="1.2" />
          <rect x="14" y="14" width="6" height="6" rx="1.2" />
        </svg>
      )

    case 'document':
      return (
        <svg {...common}>
          <path d="M6 3.5h8l4 4v13H6z" />
          <path d="M14 3.5v4h4" />
          <path d="M9 12h6" />
          <path d="M9 15.5h6" />
        </svg>
      )

    default:
      return null
  }
}


/* =========================================================
   EXAM DATA
========================================================= */

const examCategories = [
  {
    id: 'psc',
    title: 'PSC Exams',
    subtitle: 'Kerala PSC, State PSC\n& Other PSC',
    color: 'purple',
    icon: 'psc',
    defaultRecent: 'Kerala PSC',
  },
  {
    id: 'ssc',
    title: 'SSC Exams',
    subtitle: 'SSC CGL, CHSL, MTS\n& Other SSC',
    color: 'blue',
    icon: 'ssc',
    defaultRecent: 'SSC CGL',
  },
  {
    id: 'upsc',
    title: 'UPSC Exams',
    subtitle: 'UPSC Civil Services\n& Other UPSC',
    color: 'green',
    icon: 'upsc',
    defaultRecent: 'UPSC CSE',
  },
  {
    id: 'banking',
    title: 'Banking Exams',
    subtitle: 'IBPS, SBI, RBI, NABARD\n& Other Bank Exams',
    color: 'orange',
    icon: 'bank',
    defaultRecent: 'RBI Grade B',
  },
  {
    id: 'railway',
    title: 'Railway Exams',
    subtitle: 'RRB NTPC, Group D,\nALP & Other Railway',
    color: 'pink',
    icon: 'railway',
    defaultRecent: 'RRB NTPC',
  },
  {
    id: 'other',
    title: 'Other Exams',
    subtitle: 'Defence, Teaching,\nNET, Police & More',
    color: 'violet',
    icon: 'other',
    defaultRecent: 'Other Exams',
  },
]


const initialRecentExams = [
  {
    id: 'recent-1',
    name: 'Kerala PSC',
    category: 'psc',
  },
  {
    id: 'recent-2',
    name: 'SSC CGL',
    category: 'ssc',
  },
  {
    id: 'recent-3',
    name: 'RBI Grade B',
    category: 'banking',
  },
  {
    id: 'recent-4',
    name: 'RRB NTPC',
    category: 'railway',
  },
]


/* =========================================================
   SELECT EXAM PAGE
========================================================= */

export default function SelectExam() {
  const navigate = useNavigate()

  // Multiple exam selection
  const [selectedExams, setSelectedExams] = useState([])

  const [recentExams, setRecentExams] = useState(initialRecentExams)
  const [showValidation, setShowValidation] = useState(false)


  /* =======================================================
     SELECT / DESELECT EXAM
  ======================================================= */

  const handleSelectExam = (exam) => {
    setSelectedExams((previous) => {
      const alreadySelected = previous.includes(exam.id)

      if (alreadySelected) {
        return previous.filter((id) => id !== exam.id)
      }

      return [...previous, exam.id]
    })

    setShowValidation(false)

    setRecentExams((previous) => {
      const alreadyExists = previous.some(
        (item) => item.name === exam.defaultRecent
      )

      if (alreadyExists) {
        return previous
      }

      const newItem = {
        id: `recent-${Date.now()}`,
        name: exam.defaultRecent,
        category: exam.id,
      }

      return [newItem, ...previous].slice(0, 6)
    })
  }


  /* =======================================================
     REMOVE RECENT
  ======================================================= */

  const handleRemoveRecent = (id) => {
    setRecentExams((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    )
  }


  /* =======================================================
     CLEAR ALL
  ======================================================= */

  const handleClearAll = () => {
    setRecentExams([])
  }


  /* =======================================================
     CUSTOM EXAM
  ======================================================= */

  const handleCustomExam = () => {
    alert(
      'Custom exam feature will be available soon.'
    )
  }


  /* =======================================================
     VIEW ALL
  ======================================================= */

  const handleViewAll = () => {
    alert(
      'More exam categories will be available soon.'
    )
  }


  /* =======================================================
     CONTINUE
  ======================================================= */
  //folder funtion handling

 const handleContinue = () => {
  if (selectedExams.length === 0) {
    setShowValidation(true)
    return
  }

  console.log('Selected exams:', selectedExams)

  // Keep existing selected exam IDs
  localStorage.setItem(
    'smartdoc_selected_exams',
    JSON.stringify(selectedExams)
  )

  // Store complete exam information for later use
  const selectedExamDetails = examCategories.filter((exam) =>
    selectedExams.includes(exam.id)
  )

  localStorage.setItem(
    'smartdoc_selected_exam_details',
    JSON.stringify(selectedExamDetails)
  )

  navigate('/login')
}


  return (
    <main className="select-exam-page">

      {/* Background decoration */}

      <div className="background-orb background-orb--one" />
      <div className="background-orb background-orb--two" />
      <div className="background-orb background-orb--three" />

      <span className="background-sparkle background-sparkle--one">
        <Icon name="sparkle" size={18} />
      </span>

      <span className="background-sparkle background-sparkle--two">
        <Icon name="sparkle" size={14} />
      </span>

      <span className="background-sparkle background-sparkle--three">
        <Icon name="sparkle" size={16} />
      </span>


      {/* Main content */}

      <div className="select-exam-container">


        {/* =================================================
            FIXED TOP HEADER
        ================================================= */}

        <header className="page-header">

          {/* LEFT */}

          <button
            type="button"
            className="header-circle-btn header-circle-btn--left"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <Icon
              name="arrow-left"
              size={25}
              stroke="#30265a"
            />
          </button>


          {/* CENTER BRAND */}

          <div className="header-brand">

            <div className="brand-logo-icon">

              <div className="brand-logo-document">

                <div className="brand-logo-fold" />

                <div className="brand-logo-play">
                  <span />
                </div>

                <div className="brand-logo-line brand-logo-line--one" />

                <div className="brand-logo-line brand-logo-line--two" />

              </div>


              <span className="brand-logo-sparkle brand-logo-sparkle--one">
                ✦
              </span>

              <span className="brand-logo-sparkle brand-logo-sparkle--two">
                ✦
              </span>

            </div>


            <div className="brand-text">

              <h1 className="brand-name">
                SmartDoc{' '}
                <span className="brand-ai">
                  AI
                </span>
              </h1>

              <p className="brand-tagline">
                AI-Powered Exam Learning Assistant
              </p>

            </div>

          </div>


          {/* RIGHT */}

          <button
            type="button"
            className="header-circle-btn header-circle-btn--right"
            onClick={() =>
              alert(
                'Choose one or more exams to personalize your learning experience.'
              )
            }
            aria-label="Help"
          >
            <Icon
              name="help"
              size={25}
              stroke="#7655d9"
            />
          </button>

        </header>


        {/* =================================================
            TITLE
        ================================================= */}

        <section className="title-section">

          <h2 className="main-title">
            Select Exam
          </h2>

          <p className="main-subtitle">
            Choose one or more exams to get personalized
            <br className="desktop-break" />
            YouTube recommendations and AI summaries
          </p>

        </section>


        {/* =================================================
            CATEGORIES
        ================================================= */}

        <section className="categories-card">

          <div className="categories-card-header">

            <h3 className="section-heading">
              Popular Exam Categories
            </h3>

            <button
              type="button"
              className="view-all-btn"
              onClick={handleViewAll}
            >
              View All

              <Icon
                name="chevron-right"
                size={17}
                stroke="currentColor"
              />

            </button>

          </div>


          <div className="categories-grid">

            {examCategories.map((exam) => {

              const isSelected =
                selectedExams.includes(exam.id)

              return (
                <button
                  key={exam.id}
                  type="button"
                  className={`category-item-card category-item-card--${exam.color} ${
                    isSelected
                      ? 'category-item-card--selected'
                      : ''
                  }`}
                  onClick={() =>
                    handleSelectExam(exam)
                  }
                  aria-pressed={isSelected}
                >

                  <div className="category-icon-circle">

                    <Icon
                      name={exam.icon}
                      size={30}
                      stroke="currentColor"
                    />

                  </div>


                  <h4 className="category-title">
                    {exam.title}
                  </h4>


                  <p className="category-subtitle">
                    {exam.subtitle}
                  </p>


                  {isSelected && (
                    <span className="selected-check">
                      ✓
                    </span>
                  )}

                </button>
              )
            })}

          </div>

        </section>


        {/* =================================================
            RECENTLY SELECTED
        ================================================= */}

        <section className="recently-selected-section">

          <div className="recently-header">

            <h3 className="section-heading">
              Recently Selected
            </h3>

            {recentExams.length > 0 && (
              <button
                type="button"
                className="clear-all-btn"
                onClick={handleClearAll}
              >
                Clear All
              </button>
            )}

          </div>


          {recentExams.length > 0 ? (

            <div className="recent-chips-container">

              {recentExams.map((recent) => {

                const category =
                  examCategories.find(
                    (exam) =>
                      exam.id === recent.category
                  )

                return (
                  <div
                    className={`recent-chip recent-chip--${
                      category?.color || 'purple'
                    }`}
                    key={recent.id}
                  >

                    <span className="recent-chip-icon">

                      <Icon
                        name={
                          category?.icon ||
                          'document'
                        }
                        size={16}
                        stroke="currentColor"
                      />

                    </span>


                    <span className="recent-chip-label">
                      {recent.name}
                    </span>


                    <button
                      type="button"
                      className="recent-chip-remove"
                      onClick={() =>
                        handleRemoveRecent(
                          recent.id
                        )
                      }
                      aria-label={`Remove ${recent.name}`}
                    >

                      <Icon
                        name="x"
                        size={15}
                        stroke="currentColor"
                      />

                    </button>

                  </div>
                )
              })}

            </div>

          ) : (

            <p className="no-recent-text">
              No recently selected exams.
            </p>

          )}

        </section>


        {/* =================================================
            CUSTOM EXAM
        ================================================= */}

        <button
          type="button"
          className="custom-exam-card"
          onClick={handleCustomExam}
        >

          <div className="custom-exam-left">

            <div className="custom-plus-btn">

              <Icon
                name="plus"
                size={27}
                stroke="#8b65df"
              />

            </div>


            <div>

              <h3 className="custom-title">
                Can't find your exam?
              </h3>

              <p className="custom-subtitle">
                Add a custom exam and we'll
                personalize it for you.
              </p>

            </div>

          </div>


          <Icon
            name="chevron-right"
            size={25}
            stroke="#7650d7"
          />

        </button>


        {/* =================================================
            VALIDATION
        ================================================= */}

        {showValidation && (
          <div
            className="validation-toast"
            role="alert"
          >
            Please select at least one exam before continuing.
          </div>
        )}


        {/* =================================================
            CONTINUE
        ================================================= */}

        <footer className="continue-footer">

          <button
            type="button"
            className="continue-primary-btn"
            onClick={handleContinue}
          >

            <span className="continue-btn-content">

              <Icon
                name="rocket"
                size={26}
                stroke="#ffffff"
              />

              <span>
                {selectedExams.length > 0
                  ? `Continue with ${selectedExams.length} ${
                      selectedExams.length === 1
                        ? 'Exam'
                        : 'Exams'
                    }`
                  : 'Continue'}
              </span>

            </span>


            <span className="continue-btn-sub">
              You can change this later in settings
            </span>

          </button>

        </footer>

      </div>

    </main>
  )
}