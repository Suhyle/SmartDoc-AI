import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FiArrowLeft, FiDownload, FiEye, FiFileText, FiFolder, FiPlus, FiTrash2 } from 'react-icons/fi'
import { supabase } from '../supabase'
import { deletePDF, getPDF, getPDFs, formatPDFSize } from '../services/pdfStorage'
import { getExamCategory, getExamSubfolderName, uniqueExamFolders } from '../utils/examFolders'
import {
  deleteCustomDocumentFolder,
  ensureCustomDocumentFolder,
  getCustomDocumentFolders,
  saveCustomDocumentFolder
} from '../utils/documentFolders'
import './Documents.css'

export default function Documents() {
  const navigate = useNavigate()
  const location = useLocation()
  const [pdfs, setPdfs] = useState([])
  const [selectedExams, setSelectedExams] = useState([])
  const [customFolders, setCustomFolders] = useState({})
  const [notificationExams, setNotificationExams] = useState([])
  const [notificationError, setNotificationError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(
    location.state?.category && location.state.category !== 'All'
      ? getExamCategory(location.state.category)
      : ''
  )
  const [selectedSubfolder, setSelectedSubfolder] = useState(location.state?.subfolder || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedNotificationExam, setSelectedNotificationExam] = useState('')
  const [manualFolderMode, setManualFolderMode] = useState(false)
  const [manualFolderName, setManualFolderName] = useState('')
  const [folderMessage, setFolderMessage] = useState('')
  const [folderToDelete, setFolderToDelete] = useState('')
  const [pdfToDelete, setPdfToDelete] = useState(null)

  useEffect(() => {
    if (location.state?.category) {
      setSelectedCategory(
        location.state.category === 'All'
          ? ''
          : getExamCategory(location.state.category)
      )
      setSelectedSubfolder(location.state.subfolder || '')
    }
  }, [location.state?.category, location.state?.subfolder])

  useEffect(() => {
    let active = true

    const loadDocuments = async () => {
      let folders = {}
      try {
        setLoading(true)
        setError('')
        try {
          folders = getCustomDocumentFolders()
          setCustomFolders(folders)
        } catch (folderError) {
          console.error('Unable to load persistent custom folders:', folderError)
          setActionError('Custom subfolders could not be loaded from this device.')
        }

        const storedPDFs = await getPDFs()
        if (!active) return
        const formattedPDFs = storedPDFs.map((pdf) => ({
          ...pdf,
          category: getExamCategory(pdf.category) || 'Other',
          examName: getExamSubfolderName(pdf)
        }))
        setPdfs(formattedPDFs)

        for (const pdf of formattedPDFs) {
          if (pdf.examName !== 'General') {
            try {
              folders = ensureCustomDocumentFolder(pdf.category, pdf.examName)
            } catch (folderError) {
              console.error('Unable to retain an existing PDF subfolder:', folderError)
            }
          }
        }
        setCustomFolders(folders)

        const { data: userResult, error: authError } = await supabase.auth.getUser()
        if (authError) {
          console.error('Unable to load selected exam categories:', authError)
        } else if (active) {
          const exams = userResult.user?.user_metadata?.selected_exams || []
          setSelectedExams(Array.isArray(exams) ? exams : [exams])
        }

        const { data: notifications, error: notificationLoadError } = await supabase
          .from('exam_notifications')
          .select('id, category, exam_name, notification_title, organization')
          .eq('is_active', true)

        if (notificationLoadError) {
          console.error('Unable to load exam options for document subfolders:', notificationLoadError)
          if (active) setNotificationError('Notification-based exam choices are unavailable right now.')
        } else if (active) {
          setNotificationExams(notifications || [])
          setNotificationError('')
        }

      } catch (loadError) {
        console.error('Unable to load saved documents:', loadError)
        if (active) setError('Saved documents could not be loaded from this device.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDocuments()
    return () => { active = false }
  }, [])

  const categories = useMemo(() => uniqueExamFolders([
    ...selectedExams,
    ...Object.keys(customFolders),
    ...pdfs.map((pdf) => pdf.category)
  ]), [customFolders, pdfs, selectedExams])

  const examFolders = useMemo(() => {
    if (!selectedCategory) return []

    const names = [
      ...(Array.isArray(customFolders[selectedCategory]) ? customFolders[selectedCategory] : []),
      ...pdfs
        .filter((pdf) => pdf.category === selectedCategory)
        .map((pdf) => pdf.examName)
    ]
    const seen = new Set()
    return names.filter((name) => {
      if (!name) return false
      const key = String(name).toLocaleLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [customFolders, pdfs, selectedCategory])

  const matchingPDFs = useMemo(() => {
    if (!selectedCategory || !selectedSubfolder) return []
    return pdfs.filter((pdf) =>
      pdf.category === selectedCategory && pdf.examName === selectedSubfolder
    )
  }, [pdfs, selectedCategory, selectedSubfolder])

  const openPDF = async (pdf) => {
    setActionError('')
    const preview = window.open('about:blank', '_blank')
    if (!preview) {
      setActionError('Allow pop-ups to preview this PDF.')
      return
    }

    try {
      const stored = await getPDF(pdf.id)
      if (!stored?.blob) throw new Error('This PDF file is not available in local storage.')
      const blob = stored.blob instanceof Blob
        ? stored.blob
        : new Blob([stored.blob], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      preview.location.replace(url)
      window.setTimeout(() => URL.revokeObjectURL(url), 120000)
    } catch (previewError) {
      console.error('Unable to preview saved document:', previewError)
      preview.close()
      setActionError(previewError.message || 'Unable to preview this PDF.')
    }
  }

  const downloadPDF = async (pdf) => {
    setActionError('')
    try {
      const stored = await getPDF(pdf.id)
      if (!stored?.blob) throw new Error('This PDF file is not available in local storage.')
      const blob = stored.blob instanceof Blob
        ? stored.blob
        : new Blob([stored.blob], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${(pdf.title || 'SmartDoc_Document').replace(/[<>:"/\\|?*]+/g, '_')}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 120000)
    } catch (downloadError) {
      console.error('Unable to download saved document:', downloadError)
      setActionError(downloadError.message || 'Unable to download this PDF.')
    }
  }

  const removePDF = async (pdf) => {
    try {
      await deletePDF(pdf.id)
      setPdfs((current) => current.filter((item) => item.id !== pdf.id))
      setPdfToDelete(null)
      setActionError('')
    } catch (deleteError) {
      console.error('Unable to delete saved document:', deleteError)
      setActionError(deleteError.message || 'Unable to delete this PDF.')
    }
  }

  const goBackToFolderLevel = () => {
    if (selectedSubfolder) {
      setSelectedSubfolder('')
    } else {
      setSelectedCategory('')
    }
  }

  const createSubfolder = (event) => {
    event.preventDefault()
    setFolderMessage('')
    const selectedExam = notificationExams.find(
      (exam) => String(exam.id) === selectedNotificationExam
    )
    const folderName = manualFolderMode
      ? manualFolderName.trim()
      : selectedExam
        ? getExamSubfolderName(selectedExam)
        : ''
    if (!folderName) {
      setFolderMessage(manualFolderMode
        ? 'Enter a name for the custom subfolder.'
        : 'Choose an exam from notifications first.')
      return
    }

    try {
      const updated = saveCustomDocumentFolder(
        selectedCategory,
        folderName,
        examFolders
      )
      setCustomFolders(updated)
      setSelectedNotificationExam('')
      setManualFolderMode(false)
      setManualFolderName('')
      setFolderMessage(`"${folderName}" subfolder created and saved.`)
    } catch (folderError) {
      setFolderMessage(folderError.message || 'Unable to create this subfolder.')
    }
  }

  const confirmDeleteSubfolder = (folderName) => {
    const hasPDFs = pdfs.some((pdf) =>
      pdf.category === selectedCategory && pdf.examName === folderName
    )
    if (hasPDFs) {
      setFolderMessage(`Move or delete the ${hasPDFs ? 'PDFs' : 'contents'} in "${folderName}" before deleting this folder.`)
      setFolderToDelete('')
      return
    }

    try {
      const updated = deleteCustomDocumentFolder(selectedCategory, folderName)
      setCustomFolders(updated)
      setFolderMessage(`"${folderName}" folder deleted.`)
      setFolderToDelete('')
    } catch (folderError) {
      setFolderMessage(folderError.message || 'Unable to delete this folder.')
    }
  }

  const createPDF = (subfolder = selectedSubfolder) => {
    navigate('/transcript-summary', {
      state: {
        documentCategory: selectedCategory,
        documentSubfolder: subfolder
      }
    })
  }

  const notificationOptions = useMemo(() => notificationExams
    .filter((exam) => getExamCategory(exam) === selectedCategory)
    .filter((exam) => getExamSubfolderName(exam) !== 'General')
    .map((exam) => ({
      id: String(exam.id),
      name: getExamSubfolderName(exam),
      title: exam.notification_title
    }))
    .filter((exam) => !examFolders.some(
      (folder) => folder.toLocaleLowerCase() === exam.name.toLocaleLowerCase()
    ))
    .filter((exam, index, all) => all.findIndex(
      (item) => item.name.toLocaleLowerCase() === exam.name.toLocaleLowerCase()
    ) === index), [examFolders, notificationExams, selectedCategory])

  return (
    <main className="documents-page">
      <div className="documents-shell">
        <button
          className="documents-back"
          onClick={selectedCategory ? goBackToFolderLevel : () => navigate(-1)}
          aria-label={selectedCategory ? 'Back to previous folder' : 'Go back'}
        >
          <FiArrowLeft /> {selectedCategory ? 'Folders' : 'Back'}
        </button>

        <header className="documents-header">
          <div className="documents-heading-icon"><FiFileText size={25} /></div>
          <div>
            <h1>My Documents</h1>
            <p>
              {selectedSubfolder
                ? `${selectedCategory} / ${selectedSubfolder}`
                : selectedCategory
                  ? `Subfolders in ${selectedCategory}`
                  : 'Your saved study PDFs, arranged by selected exam.'}
            </p>
          </div>
          <button className="documents-create" onClick={() => createPDF()}>
            <FiPlus /> Create PDF
          </button>
        </header>

        <div className="documents-storage-note">
          <FiDownload />
          <p>
            PDFs are saved in this browser or app on this device. Download a separate copy through your device.
            Local files do not sync between localhost, the live website, or other devices.
          </p>
        </div>
        {actionError && <p className="documents-error" role="alert">{actionError}</p>}

        {loading ? (
          <p className="documents-empty">Loading your saved folders…</p>
        ) : error ? (
          <p className="documents-error" role="alert">{error}</p>
        ) : !selectedCategory ? (
          <section className="documents-folders" aria-labelledby="documents-folders-title">
            <div className="documents-section-heading">
              <h2 id="documents-folders-title">Exam categories</h2>
              <span>{categories.length} {categories.length === 1 ? 'folder' : 'folders'}</span>
            </div>
            {categories.length ? (
              <div className="documents-folder-grid">
                {categories.map((category) => {
                  const count = pdfs.filter((pdf) => pdf.category === category).length
                  const subfolderCount = new Set([
                    ...(Array.isArray(customFolders[category]) ? customFolders[category] : []),
                    ...pdfs.filter((pdf) => pdf.category === category).map((pdf) => pdf.examName)
                  ]).size
                  return (
                    <button
                      className="documents-folder-card"
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category)
                        setSelectedSubfolder('')
                      }}
                    >
                      <span className="documents-folder-icon"><FiFolder size={23} /></span>
                      <span className="documents-folder-copy">
                        <strong>{category}</strong>
                        <small>{subfolderCount} subfolders · {count} PDFs</small>
                      </span>
                      <FiArrowLeft className="documents-folder-arrow" />
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="documents-empty">
                <FiFolder size={30} />
                <strong>No exam folders yet</strong>
                <span>Select exams in your profile or Study Plan to create dynamic folders.</span>
              </div>
            )}
          </section>
        ) : !selectedSubfolder ? (
          <section className="documents-folders" aria-labelledby="documents-subfolders-title">
            <div className="documents-section-heading">
              <h2 id="documents-subfolders-title">{selectedCategory} exams</h2>
              <span>{examFolders.length} {examFolders.length === 1 ? 'subfolder' : 'subfolders'}</span>
            </div>
            <form className="documents-add-folder" onSubmit={createSubfolder}>
              <label htmlFor="notification-document-subfolder">Add a subfolder</label>
              <div>
                <select
                  id="notification-document-subfolder"
                  value={manualFolderMode ? '__custom__' : selectedNotificationExam}
                  onChange={(event) => {
                    const value = event.target.value
                    setManualFolderMode(value === '__custom__')
                    setSelectedNotificationExam(value === '__custom__' ? '' : value)
                    setFolderMessage('')
                  }}
                >
                  <option value="">
                    {notificationError
                      ? 'Exam notifications unavailable'
                      : notificationOptions.length
                        ? 'Select an exam notification'
                        : `No new ${selectedCategory} exam options`}
                  </option>
                  {notificationOptions.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.name}{exam.title && exam.title !== exam.name ? ` — ${exam.title}` : ''}
                    </option>
                  ))}
                  <option value="__custom__">Write a custom folder name…</option>
                </select>
                <button
                  type="submit"
                  disabled={manualFolderMode ? !manualFolderName.trim() : !selectedNotificationExam}
                >
                  <FiPlus /> Add folder
                </button>
              </div>
              {manualFolderMode && (
                <input
                  aria-label="Custom subfolder name"
                  value={manualFolderName}
                  onChange={(event) => setManualFolderName(event.target.value)}
                  placeholder="Type a custom exam or folder name"
                  maxLength={80}
                />
              )}
              <small>
                Choose an exam notification or write your own name. Created folders stay here after deadlines
                and are removed only when you delete them.
              </small>
              {folderMessage && <small role="status">{folderMessage}</small>}
            </form>
            {examFolders.length ? (
              <div className="documents-folder-grid">
                {examFolders.map((examName) => {
                  const count = pdfs.filter((pdf) =>
                    pdf.category === selectedCategory && pdf.examName === examName
                  ).length
                  const isCustomFolder = customFolders[selectedCategory]?.includes(examName)
                  return (
                    <div className="documents-folder-entry" key={examName}>
                      <button
                        className="documents-folder-card"
                        onClick={() => setSelectedSubfolder(examName)}
                      >
                        <span className="documents-folder-icon"><FiFolder size={23} /></span>
                        <span className="documents-folder-copy">
                          <strong>{examName}</strong>
                          <small>{count} {count === 1 ? 'PDF' : 'PDFs'}</small>
                        </span>
                        <FiArrowLeft className="documents-folder-arrow" />
                      </button>
                      {isCustomFolder && (
                        <button
                          type="button"
                          className="documents-delete-folder"
                          aria-label={`Delete ${examName} folder`}
                          title="Delete empty subfolder"
                          onClick={() => setFolderToDelete(examName)}
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="documents-empty">
                <FiFolder size={30} />
                <strong>No exam subfolders available</strong>
                <span>Create a custom subfolder here, then save or move PDFs into it.</span>
              </div>
            )}
            {folderToDelete && (
              <div className="documents-folder-confirm" role="alert">
                <span>Delete the empty “{folderToDelete}” subfolder?</span>
                <button type="button" onClick={() => confirmDeleteSubfolder(folderToDelete)}>Delete folder</button>
                <button type="button" className="secondary" onClick={() => setFolderToDelete('')}>Cancel</button>
              </div>
            )}
            {folderMessage && <p className="documents-folder-message" role="status">{folderMessage}</p>}
          </section>
        ) : (
          <section className="documents-files" aria-labelledby="documents-files-title">
            <div className="documents-section-heading">
              <h2 id="documents-files-title">{selectedSubfolder} PDFs</h2>
              <span>{matchingPDFs.length} {matchingPDFs.length === 1 ? 'PDF' : 'PDFs'}</span>
            </div>
            {matchingPDFs.length ? matchingPDFs.map((pdf) => (
              <article className="documents-file-card" key={pdf.id}>
                <span className="documents-file-icon"><FiFileText size={22} /></span>
                <span className="documents-file-copy">
                  <strong>{pdf.title || 'Untitled PDF'}</strong>
                  <small>
                    {pdf.createdAt ? new Date(pdf.createdAt).toLocaleDateString('en-IN') : 'Saved locally'}
                    {' · '}{formatPDFSize(pdf.size)}
                  </small>
                </span>
                <div className="documents-file-actions">
                  <button
                    type="button"
                    className="documents-file-icon-action"
                    aria-label={`Preview ${pdf.title}`}
                    title="Preview PDF"
                    onClick={() => openPDF(pdf)}
                  >
                    <FiEye />
                  </button>
                  <button
                    type="button"
                    className="documents-file-delete-action"
                    aria-label={`Delete ${pdf.title}`}
                    title="Delete PDF"
                    onClick={() => setPdfToDelete(pdf)}
                  >
                    <FiTrash2 />
                  </button>
                  <button type="button" onClick={() => downloadPDF(pdf)}>
                  <FiDownload /> Download
                  </button>
                </div>
              </article>
            )) : (
              <div className="documents-empty">
                <FiFileText size={30} />
                <strong>This exam folder is empty</strong>
                <span>Choose this exam when generating a transcript PDF to save it here.</span>
                <button type="button" onClick={() => createPDF()}>
                  <FiPlus /> Create PDF
                </button>
              </div>
            )}
            {pdfToDelete && (
              <div className="documents-folder-confirm" role="alert">
                <span>Delete “{pdfToDelete.title || 'Untitled PDF'}” from this device?</span>
                <button type="button" onClick={() => removePDF(pdfToDelete)}>Delete PDF</button>
                <button type="button" className="secondary" onClick={() => setPdfToDelete(null)}>Cancel</button>
              </div>
            )}
          </section>
        )}

        <section className="documents-library-link">
          <div>
            <h2>Saved PDF library</h2>
            <p>{pdfs.length} PDFs saved on this device. Search, preview, bookmark, or manage files in Downloads.</p>
          </div>
          <button
            onClick={() => navigate('/downloads', {
              state: { category: selectedCategory || 'All', subfolder: selectedSubfolder }
            })}
          >
            Open Downloads <FiDownload />
          </button>
        </section>
      </div>
    </main>
  )
}
