import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiArrowLeft,
  FiInfo,
  FiUploadCloud,
  FiShield,
  FiChevronRight,
  FiFileText,
  FiMessageCircle,
  FiZap,
  FiGlobe,
  FiCheckCircle,
  FiX,
} from 'react-icons/fi'
import BottomNav from '../components/BottomNav'
import './Upload.css'

export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [selectedFile, setSelectedFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState('')

  const handleChooseFile = () => {
    fileInputRef.current?.click()
  }

  const validateAndSetFile = (file) => {
    if (!file) return

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported.')
      setSelectedFile(null)
      return
    }

    setError('')
    setSelectedFile(file)
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    validateAndSetFile(file)
  }

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

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="upload-page">
      <div className="upload-content">
        {/* ---------- Header ---------- */}
        <header className="upload-header">
          <button className="icon-btn" onClick={() => navigate('/home')} aria-label="Go back">
            <FiArrowLeft size={20} />
          </button>
          <h1 className="upload-title">Upload PDF</h1>
          <button className="icon-btn" aria-label="Information">
            <FiInfo size={20} />
          </button>
        </header>

        {/* ---------- Upload Area ---------- */}
        <div
          className={`upload-dropzone ${isDragging ? 'upload-dropzone--dragging' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <span className="dropzone-spark dropzone-spark--a">✦</span>
          <span className="dropzone-spark dropzone-spark--b">✧</span>
          <span className="dropzone-spark dropzone-spark--c">✦</span>

          <div className="upload-illustration">
            <FiFileText className="upload-illustration-doc" size={30} />
            <span className="upload-illustration-badge">
              <FiUploadCloud size={22} />
            </span>
          </div>

          <p className="dropzone-text">Drag &amp; Drop your PDF here</p>
          <span className="dropzone-or">or</span>

          <button type="button" className="choose-file-btn" onClick={handleChooseFile}>
            Choose File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden-input"
            onChange={handleFileInputChange}
          />

          {error && <p className="dropzone-error">{error}</p>}

          {selectedFile && (
            <div className="selected-file">
              <span className="selected-file-icon">
                <FiCheckCircle size={16} />
              </span>
              <div className="selected-file-info">
                <span className="selected-file-name">{selectedFile.name}</span>
                <span className="selected-file-size">{formatFileSize(selectedFile.size)}</span>
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
        </div>

        {/* ---------- Security Card ---------- */}
        <button type="button" className="security-card">
          <span className="security-icon">
            <FiShield size={20} />
          </span>
          <span className="security-text">
            <span className="security-title">Secure &amp; Private</span>
            <span className="security-subtitle">
              Your documents are encrypted and safe with us.
            </span>
          </span>
          <FiChevronRight size={18} className="security-arrow" />
        </button>

        {/* ---------- Supported Features ---------- */}
        <section className="features-section">
          <h2 className="features-heading">Supported Features</h2>

          <div className="features-list">
            <div className="feature-row">
              <span className="feature-row-icon">
                <FiFileText size={18} />
              </span>
              <div className="feature-row-text">
                <span className="feature-row-title">PDF Summarization</span>
                <span className="feature-row-subtitle">
                  Generate concise summaries from uploaded PDFs.
                </span>
              </div>
            </div>

            <div className="feature-row">
              <span className="feature-row-icon">
                <FiMessageCircle size={18} />
              </span>
              <div className="feature-row-text">
                <span className="feature-row-title">
                  AI Chat with PDF
                  <span className="feature-badge">Coming Soon</span>
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
                  <span className="feature-badge">Coming Soon</span>
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
                <span className="feature-row-title">Multi-language Support</span>
                <span className="feature-row-subtitle">
                  Translate documents into Malayalam and English.
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  )
} 