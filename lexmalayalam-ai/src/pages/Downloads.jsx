import React, {
  useState,
  useMemo,
  useEffect
} from 'react'

import {
  useLocation,
  useNavigate
} from 'react-router-dom'

import { supabase } from '../supabase'

import {
  FiArrowLeft,
  FiSearch,
  FiFilter,
  FiFolder,
  FiFileText,
  FiCheckCircle,
  FiClock,
  FiBookmark,
  FiEye,
  FiDownload,
  FiTrash2,
  FiMoreVertical,
  FiHome,
  FiPlus,
  FiUser,
  FiChevronDown
} from 'react-icons/fi'

import { HiSparkles } from 'react-icons/hi'

import {
  getPDFs,
  getPDF,
  deletePDF,
  formatPDFSize
} from '../services/pdfStorage'

import './Downloads.css'
import './Home.css'


// =========================================================
// DOWNLOADS PAGE
// =========================================================

export default function Downloads() {

  const navigate = useNavigate()

  const location = useLocation()


  // =========================================================
  // SELECTED EXAMS
  // =========================================================

  const [selectedExams, setSelectedExams] = useState([])


  // =========================================================
  // LOAD SELECTED EXAMS FROM SUPABASE
  // =========================================================

  useEffect(() => {

    let isMounted = true

    const loadSelectedExams = async () => {

      try {

        // ===================================================
        // GET CURRENT LOGGED-IN USER
        // ===================================================

        const {
          data: {
            user
          },
          error
        } = await supabase.auth.getUser()


        // ===================================================
        // AUTH ERROR
        // ===================================================

        if (error) {

          console.error(
            'Error getting current user:',
            error
          )

          if (isMounted) {
            setSelectedExams([])
          }

          return
        }


        // ===================================================
        // NO USER
        // ===================================================

        if (!user) {

          console.warn(
            'No logged-in user found.'
          )

          if (isMounted) {
            setSelectedExams([])
          }

          return
        }


        // ===================================================
        // GET SELECTED EXAMS FROM USER METADATA
        // ===================================================

        const exams =
          user.user_metadata?.selected_exams || []


        console.log(
          'Selected exams loaded from Supabase:',
          exams
        )


        // ===================================================
        // MAKE SURE IT IS AN ARRAY
        // ===================================================

        const examArray =
          Array.isArray(exams)
            ? exams
            : [exams]


        if (isMounted) {

          setSelectedExams(
            examArray.filter(Boolean)
          )

        }

      } catch (error) {

        console.error(
          'Failed to load selected exams:',
          error
        )

        if (isMounted) {
          setSelectedExams([])
        }

      }

    }


    loadSelectedExams()


    // =====================================================
    // CLEANUP
    // =====================================================

    return () => {

      isMounted = false

    }

  }, [])


  // =========================================================
  // LOCAL PDF STORAGE
  // =========================================================

  const [pdfs, setPdfs] = useState([])
  const [loadingPDFs, setLoadingPDFs] = useState(true)

  const loadPDFs = async () => {
    try {
      setLoadingPDFs(true)

      const storedPDFs = await getPDFs()

      const formattedPDFs = storedPDFs.map((pdf) => ({
        ...pdf,
        uploadedDate: pdf.createdAt,
        size: formatPDFSize(pdf.size),
        status: 'completed',
        bookmarked: false
      }))

      setPdfs(formattedPDFs)
    } catch (error) {
      console.error('Failed to load saved PDFs:', error)
      setPdfs([])
    } finally {
      setLoadingPDFs(false)
    }
  }

  useEffect(() => {
    loadPDFs()
  }, [])

  // =========================================================
  // EXAM NAME NORMALIZATION
  // =========================================================

  const normalizeExam = (exam) => {

    if (!exam) {
      return null
    }


    // =======================================================
    // IF EXAM IS AN OBJECT
    // =======================================================

    if (typeof exam === 'object') {

      const possibleValue =
        exam.name ||
        exam.exam_name ||
        exam.examName ||
        exam.id ||
        exam.exam_id ||
        exam.value


      if (possibleValue) {

        return normalizeExam(
          possibleValue
        )

      }


      return null

    }


    // =======================================================
    // CONVERT TO LOWERCASE STRING
    // =======================================================

    const value =
      String(exam)
        .trim()
        .toLowerCase()


    // =======================================================
    // PSC
    // =======================================================

    if (
      value === 'psc' ||
      value === 'kerala psc' ||
      value ===
        'kerala public service commission' ||
      value.includes('kerala psc')
    ) {

      return 'PSC'

    }


    // =======================================================
    // SSC
    // =======================================================

    if (
      value === 'ssc' ||
      value ===
        'staff selection commission' ||
      value.includes('ssc')
    ) {

      return 'SSC'

    }


    // =======================================================
    // UPSC
    // =======================================================

    if (
      value === 'upsc' ||
      value ===
        'union public service commission' ||
      value.includes('upsc')
    ) {

      return 'UPSC'

    }


    // =======================================================
    // BANKING
    // =======================================================

    if (
      value === 'bank' ||
      value === 'banking' ||
      value === 'banking exams' ||
      value.includes('bank')
    ) {

      return 'Banking'

    }


    // =======================================================
    // RAILWAY
    // =======================================================

    if (
      value === 'railway' ||
      value === 'railways' ||
      value.includes('railway')
    ) {

      return 'Railway'

    }


    // =======================================================
    // OTHER
    // =======================================================

    if (value === 'other') {

      return 'Other'

    }


    // =======================================================
    // UNKNOWN
    // =======================================================

    return null

  }


  // =========================================================
  // USER SELECTED CATEGORY NAMES
  // =========================================================

  const selectedCategories = useMemo(() => {

    const converted =
      selectedExams
        .map((exam) =>
          normalizeExam(exam)
        )
        .filter(Boolean)


    // Remove duplicate categories

    return Array.from(
      new Set(converted)
    )

  }, [selectedExams])


  // =========================================================
  // FILTER CATEGORIES
  // =========================================================

  const categories = useMemo(() => {

    return [
      'All',
      ...selectedCategories
    ]

  }, [selectedCategories])


  // =========================================================
  // STATE
  // =========================================================

  const [searchTerm, setSearchTerm] =
    useState('')


  const [selectedCategory, setSelectedCategory] =
    useState(
      location.state?.category || 'All'
    )


  const [showFilterMenu, setShowFilterMenu] =
    useState(false)


  const [sortBy, setSortBy] =
    useState('newest')


  const [showSortMenu, setShowSortMenu] =
    useState(false)


  // =========================================================
  // KEEP CATEGORY VALID
  // =========================================================

  useEffect(() => {

    if (
      !categories.includes(
        selectedCategory
      )
    ) {

      setSelectedCategory('All')

    }

  }, [
    categories,
    selectedCategory
  ])


  // =========================================================
  // PDFs FOR CURRENT CATEGORY VIEW
  // =========================================================

  const examFilteredPdfs = useMemo(() => {

    // "All Categories" must show EVERY PDF saved in
    // SmartDoc AI local storage, regardless of exam selection.
    if (selectedCategory === 'All') {
      return pdfs
    }

    return pdfs.filter(
      (pdf) =>
        pdf.category === selectedCategory
    )

  }, [
    pdfs,
    selectedCategory
  ])

  // =========================================================
  // STATISTICS
  // =========================================================

  const totalPDFs =
    examFilteredPdfs.length


  const readPDFs =
    examFilteredPdfs.filter(
      (pdf) =>
        pdf.status === 'completed'
    ).length


  const pendingPDFs =
    examFilteredPdfs.filter(
      (pdf) =>
        pdf.status === 'pending'
    ).length


  const bookmarkedPDFs =
    examFilteredPdfs.filter(
      (pdf) =>
        pdf.bookmarked
    ).length


  // =========================================================
  // SEARCH + FILTER + SORT
  // =========================================================

  const visiblePdfs = useMemo(() => {

    let result =
      [...examFilteredPdfs]


    // =======================================================
    // CATEGORY FILTER
    // =======================================================

    if (
      selectedCategory !== 'All'
    ) {

      result =
        result.filter(
          (pdf) =>
            pdf.category ===
            selectedCategory
        )

    }


    // =======================================================
    // SEARCH
    // =======================================================

    if (
      searchTerm.trim()
    ) {

      const q =
        searchTerm
          .trim()
          .toLowerCase()


      result =
        result.filter(
          (pdf) =>

            pdf.title
              .toLowerCase()
              .includes(q) ||

            pdf.category
              .toLowerCase()
              .includes(q)
        )

    }


    // =======================================================
    // SORT
    // =======================================================

    result.sort(
      (a, b) => {

        // Newest

        if (
          sortBy === 'newest'
        ) {

          return (
            new Date(
              b.uploadedDate
            ) -
            new Date(
              a.uploadedDate
            )
          )

        }


        // Oldest

        if (
          sortBy === 'oldest'
        ) {

          return (
            new Date(
              a.uploadedDate
            ) -
            new Date(
              b.uploadedDate
            )
          )

        }


        // Name A-Z

        if (
          sortBy === 'nameAsc'
        ) {

          return (
            a.title.localeCompare(
              b.title
            )
          )

        }


        return 0

      }
    )


    return result

  }, [

    examFilteredPdfs,

    selectedCategory,

    searchTerm,

    sortBy

  ])


  // =========================================================
  // VIEW PDF
  // =========================================================
  // =========================================================
  // GET A VALID PDF BLOB
  // =========================================================

  const getStoredPDFBlob = async (pdf) => {

    const storedPDF =
      await getPDF(pdf.id)

    if (!storedPDF?.blob) {
      throw new Error(
        `PDF file is not available for "${pdf.title}".`
      )
    }

    if (storedPDF.blob instanceof Blob) {

      return new Blob(
        [storedPDF.blob],
        {
          type: 'application/pdf'
        }
      )

    }

    if (storedPDF.blob instanceof ArrayBuffer) {

      return new Blob(
        [storedPDF.blob],
        {
          type: 'application/pdf'
        }
      )

    }

    return new Blob(
      [storedPDF.blob],
      {
        type: 'application/pdf'
      }
    )

  }


  // =========================================================
  // VIEW PDF
  // =========================================================

  const handleViewPDF = async (pdf) => {

    // Open immediately while this is still a user click.
    const newWindow =
      window.open(
        'about:blank',
        '_blank'
      )

    if (!newWindow) {

      alert(
        'Please allow pop-ups for SmartDoc AI to open the PDF.'
      )

      return
    }

    try {

      const pdfBlob =
        await getStoredPDFBlob(pdf)

      if (!pdfBlob.size) {

        throw new Error(
          'The stored PDF is empty.'
        )

      }

      const url =
        URL.createObjectURL(
          pdfBlob
        )

      newWindow.location.replace(url)

      // Keep the object URL alive while the browser
      // PDF viewer loads the document.
      setTimeout(() => {

        URL.revokeObjectURL(url)

      }, 120000)

    } catch (error) {

      console.error(
        'Failed to open PDF:',
        error
      )

      newWindow.close()

      alert(
        error.message ||
        'Unable to open this PDF.'
      )

    }

  }


  // =========================================================
  // DOWNLOAD PDF
  // =========================================================
  const handleDownloadPDF = async (pdf) => {

    try {

      const pdfBlob =
        await getStoredPDFBlob(pdf)

      if (!pdfBlob.size) {

        throw new Error(
          'The stored PDF is empty.'
        )

      }

      const url =
        URL.createObjectURL(
          pdfBlob
        )

      const link =
        document.createElement('a')

      link.href = url

      const safeTitle =
        (pdf.title ||
          'SmartDoc_AI_Summary')
          .replace(
            /[<>:"\/\\|?*]+/g,
            '_'
          )
          .trim()

      link.download =
        `${safeTitle || 'SmartDoc_AI_Summary'}.pdf`

      link.style.display = 'none'

      document.body.appendChild(link)

      link.click()

      document.body.removeChild(link)

      setTimeout(() => {

        URL.revokeObjectURL(url)

      }, 120000)

    } catch (error) {

      console.error(
        'Failed to download PDF:',
        error
      )

      alert(
        error.message ||
        'Unable to download this PDF.'
      )

    }

  }


  // =========================================================
  // DELETE PDF
  // =========================================================

  const handleDeletePDF = async (pdf) => {

    const confirmed =
      window.confirm(
        `Delete "${pdf.title}" from SmartDoc AI Downloads?`
      )

    if (!confirmed) {
      return
    }

    try {

      await deletePDF(pdf.id)

      // Refresh from IndexedDB so the UI always
      // reflects the actual local storage.
      await loadPDFs()

    } catch (error) {

      console.error(
        'Failed to delete PDF:',
        error
      )

      alert(
        'Unable to delete this PDF.'
      )

    }

  }


  // =========================================================
  // AI CHAT
  // =========================================================

  const handleOpenAIChat = (pdf) => {

    console.log(
      'Opening AI Chat for:',
      pdf
    )

    // Future:
    // navigate('/chat', {
    //   state: {
    //     pdfId: pdf.id
    //   }
    // })

  }


  // =========================================================
  // BOOKMARK
  // =========================================================

  const handleToggleBookmark = (
    pdfId
  ) => {

    setPdfs(
      (prev) =>

        prev.map(
          (pdf) =>

            pdf.id === pdfId

              ? {
                  ...pdf,
                  bookmarked:
                    !pdf.bookmarked
                }

              : pdf
        )
    )

  }


  // =========================================================
  // MORE OPTIONS
  // =========================================================

  const handleMoreOptions = (
    pdf
  ) => {

    // Reserved for future options.

  }


  // =========================================================
  // SORT LABELS
  // =========================================================

  const sortLabels = {

    newest: 'Newest',

    oldest: 'Oldest',

    nameAsc: 'Name A-Z'

  }


  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDate = (
    dateStr
  ) => {

    const d =
      new Date(dateStr)


    return d.toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    )

  }


  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="downloads-page">


      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <div className="downloads-container">


        {/* =================================================
            HEADER
        ================================================= */}

        <header className="downloads-header">


          {/* BACK */}

          <button
            className="downloads-back-btn"
            onClick={() =>
              navigate(-1)
            }
            aria-label="Go back"
          >

            <FiArrowLeft size={20} />

          </button>


          {/* TITLE */}

          <div className="downloads-header-title">

            <h1>
              Downloaded PDFs
            </h1>

            <p>
              Your saved study materials
            </p>

          </div>


          {/* SEARCH + FILTER */}

          <div className="downloads-header-actions">


            {/* SEARCH */}

            <div className="downloads-search-box">

              <FiSearch
                size={16}
                className="downloads-search-icon"
              />

              <input
                type="text"
                placeholder="Search PDFs..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
              />

            </div>


            {/* FILTER */}

            <div className="downloads-filter-wrapper">

              <button
                className="downloads-filter-btn"
                aria-label="Filter"
                onClick={() =>
                  setShowFilterMenu(
                    (prev) => !prev
                  )
                }
              >

                <FiFilter size={18} />

              </button>


              {showFilterMenu && (

                <div className="downloads-filter-menu">

                  {categories.map(
                    (cat) => (

                      <button
                        key={cat}
                        className={
                          `downloads-filter-option ${
                            selectedCategory ===
                            cat
                              ? 'active'
                              : ''
                          }`
                        }
                        onClick={() => {

                          setSelectedCategory(
                            cat
                          )

                          setShowFilterMenu(
                            false
                          )

                        }}
                      >

                        {cat}

                      </button>

                    )
                  )}

                </div>

              )}

            </div>

          </div>

        </header>


        {/* =================================================
            CATEGORY HEADER
        ================================================= */}

        <div className="downloads-category-header">


          <div className="downloads-category-title">

            <FiFolder size={20} />

            <div>

              <span>

                {
                  selectedCategory ===
                  'All'

                    ? 'All Categories'

                    : selectedCategory
                }

              </span>


              <p>

                {
                  selectedCategory ===
                  'All'

                    ? 'Showing all your downloaded PDFs'

                    : `Showing PDFs in ${selectedCategory}`
                }

              </p>

            </div>

          </div>


          <div className="downloads-count-badge">

            <span>
              {totalPDFs} PDFs
            </span>

            <p>
              Total downloaded
            </p>

          </div>

        </div>


        {/* =================================================
            STATISTICS
        ================================================= */}

        <div className="downloads-stats-grid">


          {/* TOTAL */}

          <div className="downloads-stat-card">

            <div className="downloads-stat-icon purple">

              <FiFileText size={20} />

            </div>

            <div>

              <h3>
                {totalPDFs}
              </h3>

              <p>
                Total PDFs
              </p>

            </div>

          </div>


          {/* READ */}

          <div className="downloads-stat-card">

            <div className="downloads-stat-icon green">

              <FiCheckCircle size={20} />

            </div>

            <div>

              <h3>
                {readPDFs}
              </h3>

              <p>
                Read
              </p>

            </div>

          </div>


          {/* PENDING */}

          <div className="downloads-stat-card">

            <div className="downloads-stat-icon amber">

              <FiClock size={20} />

            </div>

            <div>

              <h3>
                {pendingPDFs}
              </h3>

              <p>
                Pending
              </p>

            </div>

          </div>


          {/* BOOKMARKED */}

          <div className="downloads-stat-card">

            <div className="downloads-stat-icon blue">

              <FiBookmark size={20} />

            </div>

            <div>

              <h3>
                {bookmarkedPDFs}
              </h3>

              <p>
                Bookmarked
              </p>

            </div>

          </div>

        </div>


        {/* =================================================
            YOUR PDFs
        ================================================= */}

        <div className="downloads-list-header">

          <h2>
            Your PDFs
          </h2>


          {/* SORT */}

          <div className="downloads-sort-wrapper">

            <span>
              Sort by:
            </span>


            <button
              className="downloads-sort-btn"
              onClick={() =>
                setShowSortMenu(
                  (prev) => !prev
                )
              }
            >

              {sortLabels[sortBy]}

              <FiChevronDown
                size={14}
              />

            </button>


            {showSortMenu && (

              <div className="downloads-sort-menu">

                {Object.entries(
                  sortLabels
                ).map(
                  ([key, label]) => (

                    <button
                      key={key}
                      className={
                        `downloads-sort-option ${
                          sortBy === key
                            ? 'active'
                            : ''
                        }`
                      }
                      onClick={() => {

                        setSortBy(key)

                        setShowSortMenu(
                          false
                        )

                      }}
                    >

                      {label}

                    </button>

                  )
                )}

              </div>

            )}

          </div>

        </div>


        {/* =================================================
            PDF LIST
        ================================================= */}

        {loadingPDFs ? (

          <div className="downloads-empty-state">

            <div className="downloads-empty-icon">

              <FiFileText
                size={42}
              />

            </div>

            <h2>
              Loading PDFs...
            </h2>

            <p>
              Loading your saved study materials.
            </p>

          </div>

        ) : visiblePdfs.length === 0 ? (

          <div className="downloads-empty-state">


            <div className="downloads-empty-icon">

              <FiFileText
                size={42}
              />

            </div>


            <h2>
              No PDFs found
            </h2>


            <p>
              Try a different search term
              or category.
            </p>


            <button
              className="downloads-create-btn"
              onClick={() =>
                navigate('/home')
              }
            >

              <FiDownload
                size={17}
              />

              Create a PDF

            </button>

          </div>

        ) : (

          <div className="downloads-pdf-list">


            {visiblePdfs.map(
              (pdf) => (

                <div
                  key={pdf.id}
                  className="downloads-pdf-card"
                >


                  {/* =======================================
                      PDF ICON
                  ======================================= */}

                  <div
                    className={
                      `downloads-pdf-icon cat-${(pdf.category || 'other').toLowerCase()}`
                    }
                  >

                    <FiFileText
                      size={22}
                    />

                  </div>


                  {/* =======================================
                      PDF INFORMATION
                  ======================================= */}

                  <div className="downloads-pdf-info">


                    <div className="downloads-pdf-title-row">

                      <h3>
                        {pdf.title}
                      </h3>


                      {pdf.bookmarked && (

                        <FiBookmark
                          size={16}
                          className="downloads-bookmark-icon"
                          onClick={() =>
                            handleToggleBookmark(
                              pdf.id
                            )
                          }
                        />

                      )}

                    </div>


                    <span className="downloads-category-tag">

                      {pdf.category}

                    </span>


                    <p className="downloads-pdf-meta">

                      Uploaded on{' '}

                      {formatDate(
                        pdf.uploadedDate
                      )}

                      {' • '}

                      {pdf.size}

                    </p>

                  </div>


                  {/* =======================================
                      RIGHT SIDE
                  ======================================= */}

                  <div className="downloads-pdf-right">


                    {/* STATUS */}

                    <div className="downloads-pdf-status-row">

                      <span
                        className={
                          `downloads-status-pill ${pdf.status}`
                        }
                      >

                        {
                          pdf.status ===
                          'completed'

                            ? 'Completed'

                            : 'Pending'
                        }

                      </span>


                      <button
                        className="downloads-more-btn"
                        aria-label="More options"
                        onClick={() =>
                          handleMoreOptions(
                            pdf
                          )
                        }
                      >

                        <FiMoreVertical
                          size={16}
                        />

                      </button>

                    </div>


                    {/* ACTIONS */}

                    <div className="downloads-pdf-actions">


                      {/* VIEW */}

                      <button
                        className="downloads-action-btn"
                        aria-label="View PDF"
                        onClick={() =>
                          handleViewPDF(
                            pdf
                          )
                        }
                      >

                        <FiEye
                          size={16}
                        />

                      </button>


                      {/* DELETE */}

                      <button
                        className="downloads-action-btn"
                        aria-label="Delete PDF"
                        onClick={() =>
                          handleDeletePDF(
                            pdf
                          )
                        }
                      >

                        <FiTrash2
                          size={16}
                        />

                      </button>


                      {/* DOWNLOAD */}

                      <button
                        className="downloads-action-btn"
                        aria-label="Download PDF"
                        onClick={() =>
                          handleDownloadPDF(
                            pdf
                          )
                        }
                      >

                        <FiDownload
                          size={16}
                        />

                      </button>


                      {/* AI CHAT */}

                      <button
                        className="downloads-action-btn ai-chat"
                        onClick={() =>
                          handleOpenAIChat(
                            pdf
                          )
                        }
                      >

                        <HiSparkles
                          size={16}
                        />

                        AI Chat

                      </button>

                    </div>

                  </div>

                </div>

              )
            )}


            {/* =================================================
                CREATE MORE PDFs
            ================================================= */}

            <div className="downloads-create-more-card">


              <div className="downloads-create-more-icon">

                <FiDownload
                  size={20}
                />

              </div>


              <div className="downloads-create-more-info">

                <h3>
                  Create more PDFs
                </h3>

                <p>
                  Generate new study materials
                  from your documents or URLs
                </p>

              </div>


              <button
                className="downloads-create-btn"
                onClick={() =>
                  navigate('/home')
                }
              >

                <FiPlus
                  size={16}
                />

                Create a PDF

              </button>

            </div>

          </div>

        )}

      </div>


      {/* =====================================================
          BOTTOM NAVIGATION
          SAME AS HOME
      ===================================================== */}

      <nav className="sd-bottom-nav">


        {/* HOME */}

        <button
          className="sd-nav-item"
          onClick={() =>
            navigate('/home')
          }
        >

          <FiHome
            size={20}
            className="sd-nav-icon"
          />

          <span className="sd-nav-label">
            Home
          </span>

        </button>


        {/* TRANSCRIPTS */}

        <button
          className="sd-nav-item"
          onClick={() =>
            navigate('/transcript-summary')
          }
        >

          <FiFileText
            size={20}
            className="sd-nav-icon"
          />

          <span className="sd-nav-label">
            Transcripts
          </span>

        </button>


        {/* CENTRAL PLUS */}

        <div className="sd-central-plus-wrapper">

          <button
            className="sd-central-plus-btn"
            aria-label="Add / New"
            onClick={() =>
              navigate('/home')
            }
          >

            <FiPlus
              size={24}
            />

          </button>


          <span className="sd-nav-label sd-plus-label">
            Add / New
          </span>

        </div>


        {/* DOWNLOADS */}

        <button
          className="sd-nav-item active"
          onClick={() =>
            navigate('/downloads')
          }
        >

          <FiDownload
            size={20}
            className="sd-nav-icon"
          />

          <span className="sd-nav-label">
            Downloads
          </span>

        </button>


        {/* PROFILE */}

        <button
          className="sd-nav-item"
          onClick={() =>
            navigate('/profile')
          }
        >

          <FiUser
            size={20}
            className="sd-nav-icon"
          />

          <span className="sd-nav-label">
            Profile
          </span>

        </button>

      </nav>

    </div>

  )

}