import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiUploadCloud,
  FiShield,
  FiChevronRight,
  FiFileText,
  FiMessageCircle,
  FiZap,
  FiGlobe,
  FiCheckCircle,
  FiX,
  FiLoader,
  FiVolume2,
  FiCopy,
  FiDownload,
  FiInfo,
  FiHash,
  FiHardDrive,
  FiClock,
  FiSend,
  FiRepeat,
  FiShare2,
} from 'react-icons/fi'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import BottomNav from '../components/BottomNav'
import './Upload.css'

// PDF.js worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // ---------------------------------------
  // State
  // ---------------------------------------

  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')

  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionSuccess, setExtractionSuccess] = useState(false)
  const [pageCount, setPageCount] = useState(0)

  // Malayalam summary states
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [summary, setSummary] = useState('')

  // UI states
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [copyState, setCopyState] = useState('idle')

  // ---------------------------------------
  // Choose PDF
  // ---------------------------------------

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  // ---------------------------------------
  // Validate PDF
  // ---------------------------------------

  const validateAndSetFile = (file) => {
    if (!file) return

    setError('')
    setExtractionSuccess(false)
    setPageCount(0)
    setSummary('')

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.')
      setSelectedFile(null)
      return
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.')
      setSelectedFile(null)
      return
    }

    // Maximum file size = 20 MB
    const maxSize = 20 * 1024 * 1024

    if (file.size > maxSize) {
      setError('PDF file must be smaller than 20 MB.')
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  // ---------------------------------------
  // File input
  // ---------------------------------------

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    validateAndSetFile(file)
  }

  // ---------------------------------------
  // Drag & Drop
  // ---------------------------------------

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    validateAndSetFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  // ---------------------------------------
  // Remove PDF
  // ---------------------------------------

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setError('')
    setExtractionSuccess(false)
    setPageCount(0)
    setSummary('')

    sessionStorage.removeItem('smartdoc_pdf_text')
    sessionStorage.removeItem('smartdoc_pdf_name')
    sessionStorage.removeItem('smartdoc_pdf_pages')

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    if (
      typeof window !== 'undefined' &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.cancel()
    }

    setIsSpeaking(false)
    setCopyState('idle')
  }

  // ---------------------------------------
  // Format file size
  // ---------------------------------------

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ---------------------------------------
  // Extract text from PDF
  // ---------------------------------------

  const extractPdfText = async (file) => {
    const arrayBuffer = await file.arrayBuffer()

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
    }).promise

    let completeText = ''

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber)

      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item) => item.str)
        .join(' ')

      completeText += `\n\n--- Page ${pageNumber} ---\n\n`
      completeText += pageText
    }

    return {
      text: completeText.trim(),
      pages: pdf.numPages,
    }
  }

  // ---------------------------------------
  // Process PDF
  // ---------------------------------------

  const handleProcessPdf = async () => {
    if (!selectedFile) {
      setError('Please select a PDF file first.')
      return
    }

    setError('')
    setExtractionSuccess(false)
    setIsExtracting(true)
    setSummary('')

    try {
      const result = await extractPdfText(selectedFile)

      if (!result.text || result.text.trim().length === 0) {
        setError(
          'The PDF does not contain readable text. It may be a scanned/image-only PDF.'
        )

        setIsExtracting(false)
        return
      }

      // Store extracted document temporarily
      sessionStorage.setItem(
        'smartdoc_pdf_text',
        result.text
      )

      sessionStorage.setItem(
        'smartdoc_pdf_name',
        selectedFile.name
      )

      sessionStorage.setItem(
        'smartdoc_pdf_pages',
        String(result.pages)
      )

      setPageCount(result.pages)
      setExtractionSuccess(true)
      setIsExtracting(false)

      console.log('PDF text extracted successfully.')
      console.log('Pages:', result.pages)
      console.log('Characters:', result.text.length)
    } catch (err) {
      console.error('PDF extraction error:', err)

      setError(
        'Unable to read this PDF. Please try another PDF file.'
      )

      setIsExtracting(false)
    }
  }

  // ---------------------------------------
  // Generate Malayalam Summary
  // ---------------------------------------

  const handleGenerateSummary = async () => {
    try {
      setError('')
      setSummary('')
      setIsSummarizing(true)

      const documentText = sessionStorage.getItem(
        'smartdoc_pdf_text'
      )

      if (!documentText) {
        setError(
          'No PDF text found. Please read the PDF again.'
        )
        setIsSummarizing(false)
        return
      }

      console.log('Sending question to Groq...')
      console.log(
        'Document characters:',
        documentText.length
      )

      // Send PDF text to Express + Groq backend
      const response = await fetch(
        '/api/ask',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question:
              'Generate a clear and professional Malayalam summary of this document.',
            documentText: documentText,
          }),
        }
      )

      const data = await response.json()

      console.log('Groq server response:', data)

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.message ||
            'Failed to generate summary.'
        )
      }

      // Support different backend response names
      const generatedSummary =
        data.summary ||
        data.answer ||
        data.response ||
        data.result ||
        data.text

      if (
        !generatedSummary ||
        typeof generatedSummary !== 'string' ||
        generatedSummary.trim().length === 0
      ) {
        console.error(
          'Groq returned a response, but no usable summary field was found:',
          data
        )

        throw new Error(
          'Groq responded, but the summary text was not found in the server response.'
        )
      }

      setSummary(generatedSummary.trim())

      console.log(
        'Malayalam summary generated successfully.'
      )
    } catch (err) {
      console.error(
        'Malayalam summary error:',
        err
      )

      setError(
        err.message ||
          'Unable to generate Malayalam summary. Please try again.'
      )
    } finally {
      setIsSummarizing(false)
    }
  }

  // ---------------------------------------
  // Listen to Summary
  // ---------------------------------------

  const handleListenSummary = () => {
    if (!summary) return

    if (
      typeof window === 'undefined' ||
      !window.speechSynthesis
    ) {
      setError(
        'Text-to-speech is not supported on this device.'
      )
      return
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel()
      setIsSpeaking(false)
      return
    }

    const plainText = summary.replace(
      /[#*_`>-]/g,
      ' '
    )

    const utterance =
      new SpeechSynthesisUtterance(plainText)

    utterance.lang = 'ml-IN'

    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
    }

    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)

    setIsSpeaking(true)
  }

  // ---------------------------------------
  // Copy Summary
  // ---------------------------------------

  const handleCopySummary = async () => {
    if (!summary) return

    try {
      await navigator.clipboard.writeText(summary)

      setCopyState('copied')

      setTimeout(() => {
        setCopyState('idle')
      }, 1800)
    } catch (err) {
      console.error('Copy failed:', err)

      setError(
        'Unable to copy the summary on this device.'
      )
    }
  }

  // ---------------------------------------
  // Download Summary
  // ---------------------------------------

  const handleDownloadSummary = () => {
    if (!summary) return

    const blob = new Blob(
      [summary],
      {
        type: 'text/plain;charset=utf-8',
      }
    )

    const url = URL.createObjectURL(blob)

    const baseName =
      selectedFile?.name?.replace(/\.pdf$/i, '') ||
      'document'

    const link = document.createElement('a')

    link.href = url
    link.download = `${baseName}-malayalam-summary.txt`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  }

  // ---------------------------------------
  // Return UI
  // ---------------------------------------

  return (
    <div className="page-shell">

      {/* Header */}
      <header className="page-header">

        <button
          type="button"
          className="icon-btn"
          onClick={() => navigate('/home')}
          aria-label="Go back"
        >
          <FiArrowLeft size={20} />
        </button>

        <div className="page-header-titles">
          <h1>AI Document Summary</h1>
          <p>
            Upload PDF and get smart Malayalam summary
          </p>
        </div>

        <div
          className="header-spacer"
          aria-hidden="true"
        />

      </header>

      {/* Main Content */}
      <main className="upload-page-content">

        {/* Upload Area */}
        <section
          className={`upload-card ${
            isDragging
              ? 'upload-card--dragging'
              : ''
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >

          {!selectedFile && (
            <div className="upload-dropzone">

              <div className="upload-illustration">
                <FiFileText
                  className="upload-illustration-doc"
                  size={30}
                />

                <span className="upload-illustration-badge">
                  <FiUploadCloud size={16} />
                </span>
              </div>

              <span className="upload-eyebrow">
                AI DOCUMENT ASSISTANT
              </span>

              <h2 className="dropzone-title">
                Upload your PDF
              </h2>

              <p className="dropzone-text">
                Drag &amp; drop your PDF here
              </p>

              <div className="dropzone-divider">
                <span />
                <em>or</em>
                <span />
              </div>

              <button
                type="button"
                className="btn btn-primary choose-file-button"
                onClick={handleChooseFile}
              >
                <FiUploadCloud size={17} />
                Choose File
              </button>

              <p className="dropzone-hint">
                PDF files up to 20 MB
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden-input"
                onChange={handleFileInputChange}
              />

            </div>
          )}

          {error && (
            <p
              className="form-error"
              role="alert"
            >
              {error}
            </p>
          )}

          {/* Selected File */}
          {selectedFile && (
            <div className="selected-file">

              <span className="selected-file-icon">
                <FiFileText size={20} />
              </span>

              <div className="selected-file-info">
                <span className="selected-file-label">
                  Selected document
                </span>

                <span
                  className="selected-file-name"
                  title={selectedFile.name}
                >
                  {selectedFile.name}
                </span>

                <span className="selected-file-size">
                  {formatFileSize(selectedFile.size)}

                  {extractionSuccess
                    ? ` • ${pageCount} page${
                        pageCount !== 1
                          ? 's'
                          : ''
                      }`
                    : ''}
                </span>
              </div>

              <button
                type="button"
                className="selected-file-remove"
                onClick={handleRemoveFile}
                aria-label="Remove selected file"
              >
                <FiX size={16} />
              </button>

            </div>
          )}

          {/* PDF Extraction Success */}
          {extractionSuccess && (
            <div className="status-banner status-banner--success">

              <span className="status-icon">
                <FiCheckCircle size={18} />
              </span>

              <div>
                <strong>
                  PDF successfully read
                </strong>

                <span>
                  {pageCount} page
                  {pageCount !== 1 ? 's' : ''}{' '}
                  detected
                </span>
              </div>

            </div>
          )}

          {/* Read PDF Button */}
          {selectedFile && !extractionSuccess && (
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={handleProcessPdf}
              disabled={isExtracting}
            >
              {isExtracting ? (
                <>
                  <FiLoader
                    size={17}
                    className="spin"
                  />
                  Reading PDF...
                </>
              ) : (
                <>
                  <FiFileText size={17} />
                  Read PDF
                </>
              )}
            </button>
          )}

          {/* Generate Malayalam Summary */}
          {extractionSuccess && (
            <button
              type="button"
              className="btn btn-generate btn-block"
              onClick={handleGenerateSummary}
              disabled={isSummarizing}
            >
              {isSummarizing ? (
                <>
                  <FiLoader
                    size={17}
                    className="spin"
                  />
                  Generating Malayalam Summary...
                </>
              ) : (
                <>
                  <FiZap size={17} />
                  Generate Malayalam Summary
                </>
              )}
            </button>
          )}

        </section>

        {/* Malayalam Summary + Sidebar */}
        {summary && (
          <div className="summary-layout">

            {/* Summary */}
            <section className="summary-card">

              <div className="summary-card-header">

                <div className="summary-card-heading">
                  <span className="summary-icon">
                    <FiZap size={17} />
                  </span>

                  <div>
                    <span className="summary-label">
                      AI GENERATED
                    </span>

                    <h2>
                      മലയാളം സംഗ്രഹം
                    </h2>
                  </div>
                </div>

                <div className="summary-actions">

                  <button
                    type="button"
                    className="chip-btn"
                    onClick={handleListenSummary}
                  >
                    <FiVolume2 size={14} />
                    {isSpeaking
                      ? 'Stop'
                      : 'Listen'}
                  </button>

                  <button
                    type="button"
                    className="chip-btn"
                    onClick={handleCopySummary}
                  >
                    <FiCopy size={14} />
                    {copyState === 'copied'
                      ? 'Copied'
                      : 'Copy'}
                  </button>

                  <button
                    type="button"
                    className="chip-btn"
                    onClick={handleDownloadSummary}
                  >
                    <FiDownload size={14} />
                    Download
                  </button>

                </div>

              </div>

              <div className="summary-markdown">
                <ReactMarkdown>
                  {summary}
                </ReactMarkdown>
              </div>

            </section>

            {/* Sidebar */}
            <aside className="summary-sidebar">

              {/* Document Info */}
              <div className="info-card">

                <h3>
                  <FiInfo size={15} />
                  Document Info
                </h3>

                <div className="info-row">
                  <span className="info-row-label">
                    <FiFileText size={13} />
                    File name
                  </span>

                  <span
                    className="info-row-value"
                    title={selectedFile?.name}
                  >
                    {selectedFile?.name || '—'}
                  </span>
                </div>

                <div className="info-row">
                  <span className="info-row-label">
                    <FiHash size={13} />
                    Pages
                  </span>

                  <span className="info-row-value">
                    {pageCount || '—'}
                  </span>
                </div>

                <div className="info-row">
                  <span className="info-row-label">
                    <FiHardDrive size={13} />
                    File size
                  </span>

                  <span className="info-row-value">
                    {selectedFile
                      ? formatFileSize(
                          selectedFile.size
                        )
                      : '—'}
                  </span>
                </div>

                <div className="info-row">
                  <span className="info-row-label">
                    <FiCheckCircle size={13} />
                    Status
                  </span>

                  <span className="badge badge-success">
                    Processed
                  </span>
                </div>

              </div>

              {/* AI Summary Stats */}
              <div className="info-card">

                <h3>
                  <FiZap size={15} />
                  AI Summary
                </h3>

                <div className="info-row">
                  <span className="info-row-label">
                    <FiGlobe size={13} />
                    Language
                  </span>

                  <span className="info-row-value">
                    Malayalam
                  </span>
                </div>

                <div className="info-row">
                  <span className="info-row-label">
                    <FiZap size={13} />
                    Generated by
                  </span>

                  <span className="info-row-value">
                    Groq AI
                  </span>
                </div>

                <div className="info-row">
                  <span className="info-row-label">
                    <FiClock size={13} />
                    Status
                  </span>

                  <span className="badge badge-success">
                    Generated
                  </span>
                </div>

              </div>

              {/* Quick Actions */}
              <div className="info-card">

                <h3>
                  <FiSend size={15} />
                  Quick Actions
                </h3>

                <div className="quick-actions-list">

                  <button
                    type="button"
                    className="quick-action-row"
                    disabled
                  >
                    <span className="quick-action-label">
                      <FiMessageCircle size={15} />
                      Ask Questions
                    </span>

                    <span className="badge badge-muted">
                      Coming Soon
                    </span>
                  </button>

                  <button
                    type="button"
                    className="quick-action-row"
                    disabled
                  >
                    <span className="quick-action-label">
                      <FiRepeat size={15} />
                      Translate
                    </span>

                    <span className="badge badge-muted">
                      Coming Soon
                    </span>
                  </button>

                  <button
                    type="button"
                    className="quick-action-row"
                    disabled
                  >
                    <span className="quick-action-label">
                      <FiShare2 size={15} />
                      Share Summary
                    </span>

                    <span className="badge badge-muted">
                      Coming Soon
                    </span>
                  </button>

                </div>

              </div>

            </aside>

          </div>
        )}

        {/* Security Card */}
        <div className="security-card">

          <span className="security-icon">
            <FiShield size={20} />
          </span>

          <span className="security-text">
            <span className="security-title">
              Document Processing
            </span>

            <span className="security-subtitle">
              Your document is processed to generate the requested summary.
            </span>
          </span>

          <FiChevronRight
            size={18}
            className="security-arrow"
            aria-hidden="true"
          />

        </div>

        {/* Supported Features */}
        <section className="features-section">

          <div className="features-heading-row">
            <div>
              <span className="section-eyebrow">
                WHAT YOU CAN DO
              </span>

              <h2 className="features-heading">
                Supported Features
              </h2>
            </div>
          </div>

          <div className="features-list">

            <div className="feature-row">

              <span className="feature-row-icon">
                <FiFileText size={18} />
              </span>

              <div className="feature-row-text">

                <span className="feature-row-title">
                  PDF Summarization
                </span>

                <span className="feature-row-subtitle">
                  Generate concise Malayalam summaries from uploaded PDFs.
                </span>

              </div>

              <FiCheckCircle
                className="feature-complete"
                size={16}
              />

            </div>

            <div className="feature-row">

              <span className="feature-row-icon">
                <FiMessageCircle size={18} />
              </span>

              <div className="feature-row-text">

                <span className="feature-row-title">
                  AI Chat with PDF

                  <span className="feature-badge">
                    Coming Soon
                  </span>
                </span>

                <span className="feature-row-subtitle">
                  Ask questions about your uploaded document.
                </span>

              </div>

            </div>

            <div className="feature-row">

              <span className="feature-row-icon">
                <FiZap size={18} />
              </span>

              <div className="feature-row-text">

                <span className="feature-row-title">
                  Document Insights

                  <span className="feature-badge">
                    Coming Soon
                  </span>
                </span>

                <span className="feature-row-subtitle">
                  Extract important information from documents.
                </span>

              </div>

            </div>

            <div className="feature-row">

              <span className="feature-row-icon">
                <FiGlobe size={18} />
              </span>

              <div className="feature-row-text">

                <span className="feature-row-title">
                  Multi-language Support
                </span>

                <span className="feature-row-subtitle">
                  Translate documents into Malayalam and English.
                </span>

              </div>

            </div>

          </div>

        </section>

      </main>

      <BottomNav />

    </div>
  )
}