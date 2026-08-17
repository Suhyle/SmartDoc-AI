import React, {
  useState,
  useRef,
  useMemo
} from 'react'

import jsPDF from 'jspdf'

// STEP 1: Add src/assets/fonts/NotoSansMalayalam-normal.js (see instructions above)
// STEP 2: Uncomment the line below once the file exists
// import '../assets/fonts/NotoSansMalayalam-normal.js'

import {
  useNavigate,
  useLocation
} from 'react-router-dom'

import {
  FiArrowLeft,
  FiHelpCircle,
  FiFileText,
  FiYoutube,
  FiUploadCloud,
  FiX,
  FiSettings,
  FiClock,
  FiLayers,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiGlobe,
  FiHome,
  FiDownload,
  FiUser,
  FiList,
  FiAlignLeft,
  FiFileMinus
} from 'react-icons/fi'

import { savePDF } from '../services/pdfStorage'

import './Transcript.css'
import './Home.css'

export default function Transcript() {

  const navigate = useNavigate()

  const location = useLocation()

  // ==========================================
  // MODE: SINGLE VIDEO / MULTIPLE VIDEOS
  // ==========================================

  const [activeMode, setActiveMode] =
    useState(
      location.state?.mode === 'multiple'
        ? 'multiple'
        : 'single'
    )

  // ==========================================
  // SINGLE VIDEO — YOUTUBE URL
  // ==========================================

  const [youtubeUrl, setYoutubeUrl] =
    useState('')

  // ==========================================
  // SINGLE VIDEO — FILE UPLOAD
  // ==========================================

  const [uploadedFile, setUploadedFile] =
    useState(null)

  const [isDragging, setIsDragging] =
    useState(false)

  const fileInputRef =
    useRef(null)

  const handleFileSelect = (file) => {

    if (!file) return

    setUploadedFile(file)

    console.log(
      'File selected:',
      file
    )

  }

  const handleFileInputChange = (e) => {

    handleFileSelect(
      e.target.files?.[0] || null
    )

  }

  const handleRemoveFile = () => {

    setUploadedFile(null)

    if (fileInputRef.current) {

      fileInputRef.current.value = ''

    }

  }

  const handleDragOver = (e) => {

    e.preventDefault()

    setIsDragging(true)

  }

  const handleDragLeave = (e) => {

    e.preventDefault()

    setIsDragging(false)

  }

  const handleDrop = (e) => {

    e.preventDefault()

    setIsDragging(false)

    const file =
      e.dataTransfer.files?.[0]

    handleFileSelect(file)

  }

  // ==========================================
  // RECENT / NEXT LINKS
  // ==========================================

  const [recentLinks, setRecentLinks] =
    useState([
      {
        id: 1,
        title:
          'Introduction to Artificial Intelligence',
        url:
          'https://youtube.com/watch?v=abc123'
      },

      {
        id: 2,
        title:
          'Kerala PSC Current Affairs 2024',
        url:
          'https://youtube.com/watch?v=def456'
      },

      {
        id: 3,
        title:
          'DBMS Full Course – Gate Smashers',
        url:
          'https://youtube.com/watch?v=ghi789'
      }
    ])

  const handleSelectRecent = (item) => {

    setYoutubeUrl(item.url)

  }

  const handleRemoveRecent = (id) => {

    setRecentLinks((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    )

  }

  // ==========================================
  // TRANSCRIPT SETTINGS
  // ==========================================

  const [transcriptMode, setTranscriptMode] =
    useState('full')

  /*
    full
    custom
    duration
  */

  const [startTime, setStartTime] =
    useState('00:00:00')

  const [endTime, setEndTime] =
    useState('00:15:00')

  const [durationLimit, setDurationLimit] =
    useState(15)

  const [durationUnit, setDurationUnit] =
    useState('minutes')

  const [additionalOptions, setAdditionalOptions] =
    useState({

      includeTimestamps: true,

      mergeCloseCaptions: true,

      removeFillerWords: false,

      detectChapters: true

    })

  const toggleAdditionalOption =
    (key) => {

      setAdditionalOptions((prev) => ({
        ...prev,

        [key]: !prev[key]

      }))

    }

  // ==========================================
  // OUTPUT LANGUAGE
  // ==========================================

  const [language, setLanguage] =
    useState('english')

  // ==========================================
  // TRANSCRIPT / SUMMARY DATA
  // ==========================================

  const [transcript, setTranscript] =
    useState('')

  const [transcriptData, setTranscriptData] =
    useState(null)

  // ==========================================
  // VIDEO DURATION
  // ==========================================

  const [videoDuration, setVideoDuration] =
    useState('')

  const [summary, setSummary] =
    useState('')

  const [isTranscriptLoading, setIsTranscriptLoading] =
    useState(false)

  const [isSummaryLoading, setIsSummaryLoading] =
    useState(false)

  const [apiError, setApiError] =
    useState('')

  // ==========================================
  // BACKEND URL
  // ==========================================

  const API_BASE_URL =
    (
      import.meta.env.VITE_API_URL ||
      'http://localhost:5000'
    ).replace(/\/$/, '')

  // ==========================================
  // MULTIPLE VIDEOS
  // ==========================================

  const [multipleVideos, setMultipleVideos] =
    useState([
      {
        id: 1,
        url:
          'https://youtube.com/watch?v=abc123',
        title:
          'Introduction to Artificial Intelligence – Full Course',
        duration:
          '2:35:42'
      },

      {
        id: 2,
        url:
          'https://youtube.com/watch?v=def456',
        title:
          'Kerala PSC Current Affairs 2024 – Complete',
        duration:
          '1:12:30'
      },

      {
        id: 3,
        url:
          'https://youtube.com/watch?v=ghi789',
        title:
          'DBMS Full Course – Gate Smashers',
        duration:
          '3:10:15'
      }
    ])

  const [batchUrlInput, setBatchUrlInput] =
    useState('')

  const handleAddVideosFromInput = () => {

    if (!batchUrlInput.trim()) return

    const lines =
      batchUrlInput
        .split('\n')
        .map(
          (line) => line.trim()
        )
        .filter(Boolean)

    const newVideos =
      lines.map(
        (url, index) => ({
          id:
            Date.now() + index,

          url,

          title: url,

          duration:
            '--:--'
        })
      )

    setMultipleVideos(
      (prev) => [
        ...prev,
        ...newVideos
      ]
    )

    setBatchUrlInput('')

  }

  const handleRemoveVideo = (id) => {

    setMultipleVideos(
      (prev) =>
        prev.filter(
          (video) =>
            video.id !== id
        )
    )

  }

  const handleClearAllVideos = () => {

    setMultipleVideos([])

  }

  // ==========================================
  // DISPLAY LANGUAGE HELPER
  // ==========================================

  const getDisplayLanguage =
    (value) => {

      if (!value) {
        return 'Unknown'
      }

      const normalized =
        String(value)
          .trim()
          .toLowerCase()

      const languageMap = {

        en: 'English',
        english: 'English',
        ml: 'Malayalam',
        malayalam: 'Malayalam',
        hi: 'Hindi',
        hindi: 'Hindi',
        ta: 'Tamil',
        tamil: 'Tamil',
        te: 'Telugu',
        telugu: 'Telugu',
        kn: 'Kannada',
        kannada: 'Kannada',
        bn: 'Bengali',
        bengali: 'Bengali',
        mr: 'Marathi',
        marathi: 'Marathi',
        gu: 'Gujarati',
        gujarati: 'Gujarati',
        pa: 'Punjabi',
        punjabi: 'Punjabi',
        ur: 'Urdu',
        urdu: 'Urdu'

      }

      return (
        languageMap[normalized] ||
        String(value)
      )
    }

  // ==========================================
  // VIDEO DURATION HELPERS
  // ==========================================

  const formatSecondsAsDuration =
    (seconds) => {

      if (
        !Number.isFinite(seconds) ||
        seconds < 0
      ) {
        return ''
      }

      const totalSeconds =
        Math.round(seconds)

      const hours =
        Math.floor(
          totalSeconds / 3600
        )

      const minutes =
        Math.floor(
          (totalSeconds % 3600) / 60
        )

      const remainingSeconds =
        totalSeconds % 60

      if (hours > 0) {

        return [
          String(hours).padStart(2, '0'),
          String(minutes).padStart(2, '0'),
          String(remainingSeconds).padStart(2, '0')
        ].join(':')
      }

      return [
        String(minutes).padStart(2, '0'),
        String(remainingSeconds).padStart(2, '0')
      ].join(':')
    }

  const formatVideoDuration =
    (value) => {

      if (
        value === null ||
        value === undefined ||
        value === ''
      ) {
        return ''
      }

      if (typeof value === 'string') {

        const trimmed =
          value.trim()

        if (
          /^\d{1,2}:\d{2}:\d{2}$/
            .test(trimmed)
        ) {
          return trimmed
        }

        if (
          /^\d{1,3}:\d{2}$/
            .test(trimmed)
        ) {
          return trimmed
        }

        const isoMatch =
          trimmed.match(
            /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i
          )

        if (isoMatch) {

          const hours =
            Number(
              isoMatch[1] || 0
            )

          const minutes =
            Number(
              isoMatch[2] || 0
            )

          const seconds =
            Math.round(
              Number(
                isoMatch[3] || 0
              )
            )

          const totalSeconds =
            hours * 3600 +
            minutes * 60 +
            seconds

          return formatSecondsAsDuration(
            totalSeconds
          )
        }

        if (
          /^\d+(?:\.\d+)?$/
            .test(trimmed)
        ) {
          return formatSecondsAsDuration(
            Number(trimmed)
          )
        }

      }

      if (typeof value === 'number') {
        return formatSecondsAsDuration(
          value
        )
      }

      return ''

    }

  const getVideoDurationFromResponse =
    (data) => {

      const possibleDurations = [
        data?.videoDuration,
        data?.duration,
        data?.videoDetails?.duration,
        data?.videoDetails?.lengthSeconds,
        data?.video?.duration,
        data?.video?.lengthSeconds,
        data?.metadata?.duration,
        data?.metadata?.lengthSeconds,
        data?.lengthSeconds
      ]

      for (
        const value of possibleDurations
      ) {

        const formatted =
          formatVideoDuration(
            value
          )

        if (formatted) {
          return formatted
        }

      }

      const segments =
        Array.isArray(
          data?.segments
        )
          ? data.segments
          : []

      if (
        segments.length > 0
      ) {

        let maxEndMilliseconds = 0

        for (
          const segment of segments
        ) {

          const offset =
            Number(
              segment?.offset ??
              segment?.start ??
              0
            )

          const duration =
            Number(
              segment?.duration ??
              0
            )

          if (
            Number.isFinite(offset) &&
            Number.isFinite(duration)
          ) {
            maxEndMilliseconds =
              Math.max(
                maxEndMilliseconds,
                offset + duration
              )
          }

        }

        if (
          maxEndMilliseconds > 0
        ) {
          return formatSecondsAsDuration(
            maxEndMilliseconds / 1000
          )
        }

      }

      return ''

    }

  // ==========================================
  // PROCESSING STATUS
  // ==========================================

  const [isProcessing, setIsProcessing] =
    useState(false)

  const [processingStages, setProcessingStages] =
    useState([
      {
        id: 1,
        label:
          'Fetching video details',
        status:
          'pending'
      },

      {
        id: 2,
        label:
          'Extracting transcript',
        status:
          'pending'
      },

      {
        id: 3,
        label:
          'Preparing summary',
        status:
          'pending'
      },

      {
        id: 4,
        label:
          'Finalizing output',
        status:
          'pending'
      }
    ])

  const [processingPercent, setProcessingPercent] =
    useState(0)

  const [processingText, setProcessingText] =
    useState(
      'Waiting to start...'
    )

  const [processingSubtext, setProcessingSubtext] =
    useState(
      'Paste a YouTube URL and get started.'
    )

  // ==========================================
  // SUMMARY TYPE
  // ==========================================

  const summaryTypes = [

    {
      id: 'detailed',
      title: 'Detailed Summary',
      description:
        'Comprehensive summary with key points, explanations and important details.',
      badge: 'Best for in-depth understanding',
      icon: <FiAlignLeft size={20} />,
      accent: 'purple'
    },

    {
      id: 'bullet',
      title: 'Bullet Summary',
      description:
        'Concise summary in bullet points covering main ideas and key takeaways.',
      badge: 'Best for quick review',
      icon: <FiList size={20} />,
      accent: 'green'
    },

    {
      id: 'abstract',
      title: 'Abstract Summary',
      description:
        'Short abstract capturing the core essence and context of the content.',
      badge: 'Best for overview',
      icon: <FiFileMinus size={20} />,
      accent: 'amber'
    }

  ]

  const [summaryType, setSummaryType] =
    useState('detailed')

  // ==========================================
  // AI PROMPT
  // ==========================================

  const [aiPrompt, setAiPrompt] =
    useState('')

  const AI_PROMPT_MAX = 500

  // ==========================================
  // UPDATE PROCESSING STATUS
  // ==========================================

  const updateProcessing =
    (
      activeStage,
      percent,
      text,
      subtext
    ) => {

      setIsProcessing(true)

      setProcessingPercent(
        percent
      )

      setProcessingText(
        text
      )

      setProcessingSubtext(
        subtext
      )

      setProcessingStages(
        [

          {
            id: 1,
            label: 'Fetching video details',
            status:
              activeStage > 1
                ? 'completed'
                : activeStage === 1
                  ? 'in_progress'
                  : 'pending'
          },

          {
            id: 2,
            label: 'Extracting transcript',
            status:
              activeStage > 2
                ? 'completed'
                : activeStage === 2
                  ? 'in_progress'
                  : 'pending'
          },

          {
            id: 3,
            label: 'Preparing summary',
            status:
              activeStage > 3
                ? 'completed'
                : activeStage === 3
                  ? 'in_progress'
                  : 'pending'
          },

          {
            id: 4,
            label: 'Finalizing output',
            status:
              activeStage === 4
                ? 'in_progress'
                : activeStage > 4
                  ? 'completed'
                  : 'pending'
          }

        ]
      )

    }

  const finishProcessing =
    () => {

      setProcessingStages([

        { id: 1, label: 'Fetching video details', status: 'completed' },
        { id: 2, label: 'Extracting transcript', status: 'completed' },
        { id: 3, label: 'Preparing summary', status: 'completed' },
        { id: 4, label: 'Finalizing output', status: 'completed' }

      ])

      setProcessingPercent(100)

      setProcessingText(
        'Processing completed.'
      )

      setProcessingSubtext(
        'Your transcript is ready.'
      )

    }

  // ==========================================
  // GET REAL YOUTUBE TRANSCRIPT
  // ==========================================

  const handleGetTranscript =
    async () => {

      if (!youtubeUrl.trim()) {

        alert(
          'Please paste a YouTube video URL first.'
        )

        return

      }

      setIsTranscriptLoading(true)

      setApiError('')

      setTranscript('')

      setTranscriptData(null)

      setVideoDuration('')

      setSummary('')

      updateProcessing(
        1,
        20,
        'Fetching video details...',
        'Connecting to YouTube transcript service...'
      )

      try {

        updateProcessing(
          2,
          50,
          'Extracting transcript...',
          'Fetching captions and formatting the transcript...'
        )

        const response =
          await fetch(
            `${API_BASE_URL}/api/transcript`,
            {
              method: 'POST',

              headers: {
                'Content-Type': 'application/json'
              },

              body:
                JSON.stringify({

                  videoUrl:
                    youtubeUrl.trim(),

                  language:
                    language === 'malayalam'
                      ? 'Malayalam'
                      : 'English',

                  transcriptMode,
                  startTime,
                  endTime,
                  durationLimit,
                  durationUnit,
                  additionalOptions

                })
            }
          )

        const data =
          await response
            .json()
            .catch(
              () => ({})
            )

        if (
          !response.ok ||
          !data.success
        ) {

          throw new Error(
            data.message ||
            data.error ||
            data.details ||
            'Unable to get transcript.'
          )

        }

        const receivedTranscript =
          data.transcript || ''

        if (
          !receivedTranscript.trim()
        ) {

          throw new Error(
            'Transcript was not returned by the backend.'
          )

        }

        setTranscript(
          receivedTranscript
        )

        setTranscriptData(
          data
        )

        const detectedVideoDuration =
          getVideoDurationFromResponse(
            data
          )

        setVideoDuration(
          detectedVideoDuration
        )

        updateProcessing(
          4,
          90,
          'Finalizing transcript...',
          'Transcript extracted and formatted successfully.'
        )

        finishProcessing()

      } catch (error) {

        console.error(
          'Transcript error:',
          error
        )

        setApiError(
          error.message ||
          'Something went wrong while getting the transcript.'
        )

        setIsProcessing(false)

      } finally {

        setIsTranscriptLoading(
          false
        )

      }

    }

  // ==========================================
  // KEEP COMPATIBILITY
  // ==========================================

  const handleTranscriptGeneration =
    handleGetTranscript

  // ==========================================
  // GENERATE SUMMARY
  // ==========================================

  const handleSummaryGeneration =
    async () => {

      if (!transcript.trim()) {

        alert(
          'Please get a transcript first.'
        )

        return

      }

      setIsSummaryLoading(true)

      setApiError('')

      setSummary('')

      updateProcessing(
        3,
        70,
        'Preparing summary...',
        'Sending transcript to SmartDoc AI...'
      )

      try {

        const outputLanguage =
          language === 'malayalam'
            ? 'Malayalam'
            : 'English'

        const sourceLanguage =
          transcriptData?.sourceLanguage ||
          transcriptData?.language ||
          transcriptData?.languageCode ||
          'unknown'

        const response =
          await fetch(
            `${API_BASE_URL}/api/summarize-transcript`,
            {
              method: 'POST',

              headers: {
                'Content-Type': 'application/json'
              },

              body:
                JSON.stringify({

                  transcript: transcript,
                  language: sourceLanguage,
                  outputLanguage: outputLanguage,
                  summaryType: summaryType,
                  aiPrompt: aiPrompt.trim()

                })
            }
          )

        const data =
          await response
            .json()
            .catch(
              () => ({})
            )

        if (
          !response.ok ||
          !data.success
        ) {

          throw new Error(
            data.message ||
            data.error ||
            data.details ||
            'Unable to generate summary.'
          )

        }

        const generatedSummary =
          data.summary || ''

        if (
          !generatedSummary.trim()
        ) {

          throw new Error(
            'Summary was not returned by the backend.'
          )

        }

        setSummary(
          generatedSummary
        )

        finishProcessing()

      } catch (error) {

        console.error(
          'Summary error:',
          error
        )

        setApiError(
          error.message ||
          'Something went wrong while generating the summary.'
        )

        setIsProcessing(false)

      } finally {

        setIsSummaryLoading(
          false
        )

      }

    }

  // ==========================================
  // PDF GENERATION (professional, Markdown-aware,
  // paginated, Malayalam-capable)
  // ==========================================

 const handlePdfGeneration = async () => {
    if (!summary.trim()) { 

      alert( 
        'Please generate a summary first.' 
      ) 

      return

      }

      try {

        const doc = new jsPDF()

        const PAGE_WIDTH = doc.internal.pageSize.getWidth()
        const PAGE_HEIGHT = doc.internal.pageSize.getHeight()
        const MARGIN = 18
        const usableWidth = PAGE_WIDTH - (MARGIN * 2)
        const CONTENT_BOTTOM = PAGE_HEIGHT - 22
        const LINE_HEIGHT = 6

        const isMalayalam = language === 'malayalam'
        const bodyFontFamily = isMalayalam ? 'NotoSansMalayalam' : 'helvetica'

        // Safe font setter — falls back to Helvetica if a custom
        // font (e.g. Malayalam) has not been registered yet.
        const styleFor = (wantBold) =>
          bodyFontFamily === 'helvetica'
            ? (wantBold ? 'bold' : 'normal')
            : 'normal'

        const safeSetFont = (family, style) => {
          try {
            doc.setFont(family, style)
          } catch (e) {
            doc.setFont('helvetica', style)
          }
        }

        let cursorY = MARGIN

        const ensureSpace = (needed) => {
          if (cursorY + needed > CONTENT_BOTTOM) {
            doc.addPage()
            cursorY = MARGIN
          }
        }

        // ---- Header (first page) ----

        doc.setTextColor(103, 71, 233)
        safeSetFont('helvetica', 'bold')
        doc.setFontSize(19)
        doc.text('SmartDoc AI', MARGIN, cursorY)

        cursorY += 8

        doc.setTextColor(30, 30, 50)
        safeSetFont('helvetica', 'normal')
        doc.setFontSize(13)
        doc.text('AI Generated Study Summary', MARGIN, cursorY)

        cursorY += 6

        doc.setDrawColor(224, 220, 240)
        doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY)

        cursorY += 8

        // ---- Meta info ----

        doc.setFontSize(9.5)
        doc.setTextColor(80, 80, 95)
        safeSetFont('helvetica', 'normal')

        const videoTitle =
          transcriptData?.title ||
          transcriptData?.videoDetails?.title ||
          transcriptData?.video?.title ||
          ''

        if (videoTitle) {
          const titleLines = doc.splitTextToSize(`Video: ${videoTitle}`, usableWidth)
          doc.text(titleLines, MARGIN, cursorY)
          cursorY += titleLines.length * 4.6
        }

        if (youtubeUrl.trim()) {
          const urlLines = doc.splitTextToSize(`Source: ${youtubeUrl.trim()}`, usableWidth)
          doc.text(urlLines, MARGIN, cursorY)
          cursorY += urlLines.length * 4.6
        }

        doc.text(
          `Generated: ${new Date().toLocaleString()}`,
          MARGIN,
          cursorY
        )
        cursorY += 4.6

        const sourceLanguageLabel = getDisplayLanguage(
          transcriptData?.sourceLanguage ||
          transcriptData?.language ||
          transcriptData?.languageCode
        )

        doc.text(
          `Source Language: ${sourceLanguageLabel}   |   Output Language: ${isMalayalam ? 'Malayalam' : 'English'}`,
          MARGIN,
          cursorY
        )
        cursorY += 4.6

        const summaryTypeLabel =
          summaryTypes.find((item) => item.id === summaryType)?.title ||
          summaryType

        doc.text(
          `Summary Type: ${summaryTypeLabel}`,
          MARGIN,
          cursorY
        )
        cursorY += 8

        doc.setDrawColor(224, 220, 240)
        doc.line(MARGIN, cursorY, PAGE_WIDTH - MARGIN, cursorY)
        cursorY += 8

        doc.setTextColor(25, 25, 40)

        // ---- Inline markdown bold parsing ----

        const parseInlineSegments = (text) => {
          const parts = text.split('**')
          return parts
            .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
            .filter((p) => p.text.length > 0)
        }

        // ---- Word-wrapped, bold-aware line drawer ----

        const drawWrappedSegments = (segments, x, maxWidth, fontSize) => {

          const words = []

          segments.forEach((seg) => {
            seg.text.split(/(\s+)/).forEach((w) => {
              if (w.length > 0) words.push({ text: w, bold: seg.bold })
            })
          })

          let cursorX = x

          ensureSpace(LINE_HEIGHT)

          words.forEach((word) => {

            safeSetFont(bodyFontFamily, styleFor(word.bold))
            doc.setFontSize(fontSize)

            const wWidth = doc.getTextWidth(word.text)

            if (word.text.trim() === '') {
              if (cursorX + wWidth <= x + maxWidth) {
                cursorX += wWidth
              }
              return
            }

            if (cursorX + wWidth > x + maxWidth) {
              cursorY += LINE_HEIGHT
              ensureSpace(LINE_HEIGHT)
              cursorX = x
            }

            doc.text(word.text, cursorX, cursorY)
            cursorX += wWidth

          })

          cursorY += LINE_HEIGHT

        }

        // ---- Markdown block parser ----

        const summaryLinesRaw = summary.trim().split('\n')

        summaryLinesRaw.forEach((rawLine) => {

          const line = rawLine.trim()

          if (line === '') {
            cursorY += LINE_HEIGHT * 0.55
            return
          }

          const h1 = line.match(/^#\s+(.*)/)
          const h2 = line.match(/^##\s+(.*)/)
          const h3 = line.match(/^###\s+(.*)/)
          const bullet = line.match(/^[-*]\s+(.*)/)
          const numbered = line.match(/^(\d+)\.\s+(.*)/)

          if (h1) {
            ensureSpace(LINE_HEIGHT * 2)
            cursorY += 2
            drawWrappedSegments(
              parseInlineSegments(h1[1]).map((s) => ({ ...s, bold: true })),
              MARGIN, usableWidth, 15
            )
            cursorY += 1
            return
          }

          if (h2) {
            ensureSpace(LINE_HEIGHT * 1.6)
            cursorY += 1.5
            drawWrappedSegments(
              parseInlineSegments(h2[1]).map((s) => ({ ...s, bold: true })),
              MARGIN, usableWidth, 13
            )
            return
          }

          if (h3) {
            ensureSpace(LINE_HEIGHT * 1.3)
            drawWrappedSegments(
              parseInlineSegments(h3[1]).map((s) => ({ ...s, bold: true })),
              MARGIN, usableWidth, 11.5
            )
            return
          }

          if (bullet) {
            ensureSpace(LINE_HEIGHT)
            safeSetFont(bodyFontFamily, 'normal')
            doc.setFontSize(10.5)
            doc.text('•', MARGIN, cursorY)
            drawWrappedSegments(
              parseInlineSegments(bullet[1]),
              MARGIN + 6, usableWidth - 6, 10.5
            )
            return
          }

          if (numbered) {
            ensureSpace(LINE_HEIGHT)
            safeSetFont(bodyFontFamily, 'normal')
            doc.setFontSize(10.5)
            doc.text(`${numbered[1]}.`, MARGIN, cursorY)
            drawWrappedSegments(
              parseInlineSegments(numbered[2]),
              MARGIN + 8, usableWidth - 8, 10.5
            )
            return
          }

          drawWrappedSegments(
            parseInlineSegments(line),
            MARGIN, usableWidth, 10.5
          )

        })

        // ---- Footer / page numbers on every page ----

        const pageCount = doc.internal.getNumberOfPages()

        for (let page = 1; page <= pageCount; page++) {

          doc.setPage(page)

          doc.setDrawColor(230, 230, 240)
          doc.line(MARGIN, PAGE_HEIGHT - 16, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 16)

          doc.setFontSize(8)
          doc.setTextColor(140, 140, 155)
          safeSetFont('helvetica', 'normal')

          doc.text('Generated by SmartDoc AI', MARGIN, PAGE_HEIGHT - 10)

          doc.text(
            `Page ${page} of ${pageCount}`,
            PAGE_WIDTH - MARGIN,
            PAGE_HEIGHT - 10,
            { align: 'right' }
          )

        }

        const pdfBlob = doc.output('blob')

const savedPDF = await savePDF({
  blob: pdfBlob,
  title:
    transcriptData?.title ||
    'SmartDoc AI Summary',
  category: 'Other',
  sourceUrl: youtubeUrl.trim(),
  summaryType: summaryTypeLabel,
  language:
    language === 'malayalam'
      ? 'Malayalam'
      : 'English'
})

console.log(
  'PDF saved to SmartDoc AI Downloads:',
  savedPDF
)

// Keep computer download
doc.save('SmartDoc_AI_Summary.pdf')

      } catch (error) {

        console.error(
          'PDF generation error:',
          error
        )

        alert(
          'Unable to generate PDF. Please try again.'
        )

      }

    }

  // ==========================================
  // HELPERS
  // ==========================================

  const stageStatusIcon =
    (status) => {

      if (status === 'completed') {
        return (<FiCheck size={14} />)
      }

      return null

    }

  const durationDisplay =
    useMemo(
      () =>
        `${durationLimit} ${durationUnit}`,
      [durationLimit, durationUnit]
    )

  // ==========================================
  // RENDER
  // ==========================================

  return (

    <div className="tr-page">

      <div className="tr-container">


        {/* 1. HEADER */}

        <header className="tr-header">

          <div className="tr-header-left">

            <button
              className="tr-back-btn"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <FiArrowLeft size={20} />
            </button>

            <div className="tr-header-icon">
              <FiFileText size={20} />
            </div>

            <div>
              <h1>Transcript &amp; Summary</h1>
              <p>Get transcript and AI summaries from YouTube videos</p>
            </div>

          </div>

          <button
            className="tr-how-it-works-btn"
            onClick={() => {
              alert(
                'Paste a YouTube video link, get its transcript, choose the output language and summary type, then generate your AI summary.'
              )
            }}
          >
            <FiHelpCircle size={16} />
            How it works?
          </button>

        </header>


        {/* 2. MODE TABS */}

        <div className="tr-mode-tabs">

          <button
            className={`tr-mode-tab ${activeMode === 'single' ? 'active' : ''}`}
            onClick={() => setActiveMode('single')}
          >
            <FiYoutube size={16} />
            Single Video
          </button>

          <button
            className={`tr-mode-tab ${activeMode === 'multiple' ? 'active' : ''}`}
            onClick={() => setActiveMode('multiple')}
          >
            <FiLayers size={16} />
            Multiple Videos
          </button>

        </div>


        {/* 3. SINGLE VIDEO SECTION */}

        {activeMode === 'single' && (

          <section className="tr-card tr-single-video-card">

            <div className="tr-single-video-grid">

              <div className="tr-single-col">

                <div className="tr-single-col-label">
                  <FiYoutube size={16} className="tr-red" />
                  <span>YouTube Video Link</span>
                </div>

                <div className="tr-yt-input-row">

                  <input
                    type="text"
                    placeholder="Paste YouTube video link here..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="tr-yt-input"
                  />

                  <button
                    className="tr-get-transcript-btn"
                    onClick={handleGetTranscript}
                    disabled={isTranscriptLoading}
                  >
                    {isTranscriptLoading ? 'Getting Transcript...' : 'Get Transcript'}
                  </button>

                </div>

                <p className="tr-example-text">
                  Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ
                </p>

              </div>


              <div className="tr-or-divider">
                <span>or</span>
              </div>


              <div className="tr-single-col">

                <div className="tr-single-col-label">
                  <FiUploadCloud size={16} className="tr-purple" />
                  <span>Upload Video File</span>
                </div>

                <div
                  className={`tr-dropzone ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >

                  <FiUploadCloud size={30} className="tr-dropzone-icon" />

                  <p className="tr-dropzone-title">Drag &amp; drop your video file here</p>
                  <p className="tr-dropzone-browse">or click to browse</p>
                  <p className="tr-dropzone-hint">MP4, MOV, AVI &bull; Max 2GB</p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="tr-hidden-file"
                    onChange={handleFileInputChange}
                  />

                </div>

                {uploadedFile && (

                  <div className="tr-file-selected">

                    <span>{uploadedFile.name}</span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveFile()
                      }}
                      aria-label="Remove file"
                    >
                      <FiX size={14} />
                    </button>

                  </div>

                )}

              </div>

            </div>


            {recentLinks.length > 0 && (

              <div className="tr-recent-links">

                <div className="tr-recent-links-title">Next / Recent Links</div>

                <div className="tr-recent-links-list">

                  {recentLinks.map((item) => (

                    <div
                      key={item.id}
                      className="tr-recent-pill"
                      onClick={() => handleSelectRecent(item)}
                    >

                      <FiYoutube size={14} className="tr-red" />
                      <span>{item.title}</span>

                      <button
                        aria-label="Remove"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveRecent(item.id)
                        }}
                      >
                        <FiX size={13} />
                      </button>

                    </div>

                  ))}

                </div>

              </div>

            )}

          </section>

        )}


        {/* TRANSCRIPT SUCCESS MESSAGE */}

        {transcript && (

          <section
            className="tr-card"
            style={{
              marginTop: '20px',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              background: 'rgba(240, 253, 244, 0.95)'
            }}
          >

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>

              <div
                style={{
                  width: '38px', height: '38px', minWidth: '38px',
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: '#dcfce7', color: '#16a34a'
                }}
              >
                <FiCheck size={20} />
              </div>

              <div>

                <h3 style={{ margin: '0 0 8px', color: '#166534', fontSize: '18px' }}>
                  Transcript retrieved successfully
                </h3>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 22px', color: '#365314', fontSize: '14px' }}>

                  <span>
                    <strong>Source language:</strong>{' '}
                    {getDisplayLanguage(
                      transcriptData?.sourceLanguage ||
                      transcriptData?.language ||
                      transcriptData?.languageCode
                    )}
                  </span>

                  {videoDuration && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <FiClock size={14} />
                      <strong>Video length:</strong> {videoDuration}
                    </span>
                  )}

                </div>

                <p style={{ margin: '8px 0 0', color: '#4d7c0f', fontSize: '14px' }}>
                  Transcript ready for summarization
                </p>

              </div>

            </div>

          </section>

        )}


        {/* ERROR MESSAGE */}

        {apiError && (

          <section
            className="tr-card"
            style={{ marginTop: '20px', border: '1px solid #fca5a5', background: '#fff7f7' }}
          >

            <div>
              <h3 style={{ marginTop: 0, color: '#dc2626' }}>Error</h3>
              <p style={{ marginBottom: 0 }}>{apiError}</p>
            </div>

          </section>

        )}


        {/* 4. TRANSCRIPT SETTINGS */}

        {activeMode === 'single' && (

          <section className="tr-card">

            <div className="tr-section-heading">

              <FiSettings size={18} className="tr-purple" />

              <div>
                <h2>Transcript Settings (Prompt Setup)</h2>
                <p>Customize how you want the transcript to be generated</p>
              </div>

            </div>

            <div className="tr-settings-grid">

              <div className="tr-settings-box">

                <h3>Transcript Range</h3>
                <p className="tr-settings-sub">Select the portion of the video to transcribe</p>

                <label className="tr-radio-row">
                  <input
                    type="radio"
                    name="transcriptMode"
                    checked={transcriptMode === 'full'}
                    onChange={() => setTranscriptMode('full')}
                  />
                  <div>
                    <span className="tr-radio-title">Full Video</span>
                    <span className="tr-radio-sub">0:00 – End</span>
                  </div>
                </label>

                <label className="tr-radio-row">
                  <input
                    type="radio"
                    name="transcriptMode"
                    checked={transcriptMode === 'custom'}
                    onChange={() => setTranscriptMode('custom')}
                  />
                  <div>
                    <span className="tr-radio-title">Custom Range</span>
                    <span className="tr-radio-sub">Start and end time</span>
                  </div>
                </label>

                <label className="tr-radio-row">
                  <input
                    type="radio"
                    name="transcriptMode"
                    checked={transcriptMode === 'duration'}
                    onChange={() => setTranscriptMode('duration')}
                  />
                  <div>
                    <span className="tr-radio-title">Duration Limit</span>
                    <span className="tr-radio-sub">First N minutes</span>
                  </div>
                </label>

              </div>


              <div className={`tr-settings-box ${transcriptMode !== 'custom' ? 'disabled' : ''}`}>

                <h3>Custom Time Range</h3>
                <p className="tr-settings-sub">Only available for videos longer than selected range</p>

                <div className="tr-time-row">

                  <div className="tr-time-field">
                    <label>Start Time</label>
                    <div className="tr-time-input-wrapper">
                      <FiClock size={14} />
                      <input
                        type="text"
                        value={startTime}
                        disabled={transcriptMode !== 'custom'}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <span className="tr-time-to">to</span>

                  <div className="tr-time-field">
                    <label>End Time</label>
                    <div className="tr-time-input-wrapper">
                      <FiClock size={14} />
                      <input
                        type="text"
                        value={endTime}
                        disabled={transcriptMode !== 'custom'}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                </div>

                <p className="tr-selected-hint">Selected: 15 minutes</p>

              </div>


              <div className={`tr-settings-box ${transcriptMode !== 'duration' ? 'disabled' : ''}`}>

                <h3>Or Limit by Duration</h3>
                <p className="tr-settings-sub">Get transcript for the first N minutes</p>

                <div className="tr-duration-input-row">

                  <input
                    type="number"
                    min="1"
                    value={durationLimit}
                    disabled={transcriptMode !== 'duration'}
                    onChange={(e) => setDurationLimit(Number(e.target.value))}
                  />

                  <select
                    value={durationUnit}
                    disabled={transcriptMode !== 'duration'}
                    onChange={(e) => setDurationUnit(e.target.value)}
                  >
                    <option value="minutes">minutes</option>
                    <option value="seconds">seconds</option>
                  </select>

                </div>

                <p className="tr-selected-hint">Max available: 30:45 minutes</p>

              </div>

            </div>


            <div className="tr-additional-row">

              <div className="tr-additional-options">

                <h3>Additional Options</h3>

                <div className="tr-checkbox-grid">

                  <label className="tr-checkbox-item">
                    <input
                      type="checkbox"
                      checked={additionalOptions.includeTimestamps}
                      onChange={() => toggleAdditionalOption('includeTimestamps')}
                    />
                    <span>Include Timestamps</span>
                  </label>

                  <label className="tr-checkbox-item">
                    <input
                      type="checkbox"
                      checked={additionalOptions.mergeCloseCaptions}
                      onChange={() => toggleAdditionalOption('mergeCloseCaptions')}
                    />
                    <span>Merge close captions</span>
                  </label>

                  <label className="tr-checkbox-item">
                    <input
                      type="checkbox"
                      checked={additionalOptions.removeFillerWords}
                      onChange={() => toggleAdditionalOption('removeFillerWords')}
                    />
                    <span>Remove filler words</span>
                  </label>

                  <label className="tr-checkbox-item">
                    <input
                      type="checkbox"
                      checked={additionalOptions.detectChapters}
                      onChange={() => toggleAdditionalOption('detectChapters')}
                    />
                    <span>Detect chapters</span>
                  </label>

                </div>

              </div>


              <div className="tr-language-box">

                <div className="tr-language-label">
                  <FiGlobe size={14} />
                  <span>Language</span>
                </div>

                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="english">English</option>
                  <option value="malayalam">Malayalam</option>
                </select>

              </div>

            </div>

          </section>

        )}


        {/* 5. MULTIPLE VIDEOS */}

        {activeMode === 'multiple' && (

          <section className="tr-card">

            <div className="tr-section-heading">

              <FiLayers size={18} className="tr-purple" />

              <div>
                <h2>Multiple Videos (Batch Processing)</h2>
                <p>Process and summarize multiple videos together</p>
              </div>

            </div>

            <div className="tr-batch-grid">

              <div
                className="tr-batch-dropzone"
                onClick={() => document.getElementById('tr-batch-textarea')?.focus()}
              >
                <FiUploadCloud size={26} />
                <p className="tr-batch-dropzone-title">Add multiple video links</p>
                <p className="tr-batch-dropzone-sub">
                  Paste links (one per line)
                  <br />
                  or upload a .txt file
                </p>
              </div>

              <div className="tr-batch-list-wrapper">

                <textarea
                  id="tr-batch-textarea"
                  className="tr-batch-textarea"
                  placeholder="Paste one YouTube URL per line, then press Add"
                  value={batchUrlInput}
                  onChange={(e) => setBatchUrlInput(e.target.value)}
                />

                <div className="tr-batch-list">

                  {multipleVideos.length === 0 && (
                    <p className="tr-batch-empty">No videos added yet.</p>
                  )}

                  {multipleVideos.map((video) => (

                    <div key={video.id} className="tr-batch-item">

                      <FiYoutube size={16} className="tr-red" />
                      <span className="tr-batch-item-title">{video.title}</span>
                      <span className="tr-batch-item-duration">{video.duration}</span>

                      <button
                        aria-label="Remove video"
                        onClick={() => handleRemoveVideo(video.id)}
                      >
                        <FiX size={15} />
                      </button>

                    </div>

                  ))}

                </div>

                <div className="tr-batch-actions">

                  <button className="tr-add-more-btn" onClick={handleAddVideosFromInput}>
                    <FiPlus size={14} />
                    Add more videos
                  </button>

                  <button className="tr-clear-all-btn" onClick={handleClearAllVideos}>
                    <FiTrash2 size={13} />
                    Clear All
                  </button>

                </div>

              </div>

            </div>

          </section>

        )}


        {/* 6. PROCESSING STATUS */}

        {isProcessing && (

          <section className="tr-card">

            <div className="tr-section-heading">
              <FiFileText size={18} className="tr-purple" />
              <div><h2>Processing Status</h2></div>
            </div>

            <div className="tr-stage-row">

              {processingStages.map((stage, index) => (

                <React.Fragment key={stage.id}>

                  <div className={`tr-stage-item ${stage.status}`}>

                    <div className="tr-stage-circle">
                      {stage.status === 'completed' ? stageStatusIcon(stage.status) : stage.id}
                    </div>

                    <div>
                      <p className="tr-stage-label">{stage.label}</p>
                      <p className="tr-stage-status-text">
                        {stage.status === 'completed' && 'Completed'}
                        {stage.status === 'in_progress' && 'In Progress'}
                        {stage.status === 'pending' && 'Pending'}
                      </p>
                    </div>

                  </div>

                  {index < processingStages.length - 1 && (
                    <div className="tr-stage-connector" />
                  )}

                </React.Fragment>

              ))}

            </div>

            <div className="tr-progress-panel">

              <div className="tr-progress-icon">
                <FiFileText size={20} />
              </div>

              <div className="tr-progress-info">

                <div className="tr-progress-top-row">

                  <div>
                    <h4>{processingText}</h4>
                    <p>This may take a few moments. Please wait.</p>
                  </div>

                  <span className="tr-progress-percent">{processingPercent}%</span>

                </div>

                <div className="tr-progress-bar-track">
                  <div className="tr-progress-bar-fill" style={{ width: `${processingPercent}%` }} />
                </div>

                <p className="tr-progress-subtext">{processingSubtext}</p>

              </div>

            </div>

            <div className="tr-processing-note">
              Please don't close this page. We'll notify you when it's ready.
            </div>

          </section>

        )}


        {/* TRANSCRIPT RESULT */}

        {transcript && (

          <section className="tr-card">

            <div className="tr-section-heading">

              <FiFileText size={18} className="tr-purple" />

              <div>
                <h2>Transcript</h2>
                <p>
                  Source language:{' '}
                  {getDisplayLanguage(
                    transcriptData?.sourceLanguage ||
                    transcriptData?.language ||
                    transcriptData?.languageCode
                  )}
                </p>
              </div>

            </div>

            <div
              style={{
                whiteSpace: 'pre-wrap', lineHeight: 1.7, maxHeight: '500px',
                overflowY: 'auto', padding: '20px', borderRadius: '12px',
                background: '#fafaff', border: '1px solid #e5e7eb'
              }}
            >
              {transcript}
            </div>

          </section>

        )}


        {/* 7. SUMMARIZATION OPTIONS */}

        <section className="tr-card">

          <div className="tr-section-heading">

            <FiFileText size={18} className="tr-purple" />

            <div>
              <h2>Summarization Options</h2>
              <p>Choose the type of summary you want to generate</p>
            </div>

          </div>

          <div className="tr-summary-grid">

            {summaryTypes.map((type) => (

              <div
                key={type.id}
                className={`tr-summary-card ${summaryType === type.id ? 'selected' : ''} accent-${type.accent}`}
                onClick={() => setSummaryType(type.id)}
              >

                <div className="tr-summary-card-top">
                  <div className="tr-summary-icon">{type.icon}</div>
                  {summaryType === type.id && (<div className="tr-summary-selected-dot" />)}
                </div>

                <h3>{type.title}</h3>
                <p>{type.description}</p>
                <span className="tr-summary-badge">{type.badge}</span>

              </div>

            ))}

          </div>


          <div className="tr-ai-prompt-box">

            <div className="tr-ai-prompt-label">
              <FiFileText size={14} />
              <span>AI Prompt (Optional)</span>
            </div>

            <p className="tr-ai-prompt-sub">
              Add specific instructions for the AI about what to focus on in the summary
            </p>

            <textarea
              className="tr-ai-prompt-textarea"
              placeholder="E.g., Focus on important concepts, Ignore examples, Explain like for beginners, etc."
              maxLength={AI_PROMPT_MAX}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />

            <div className="tr-ai-prompt-counter">
              {aiPrompt.length} / {AI_PROMPT_MAX}
            </div>

          </div>


          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>

            <button
              className="tr-get-transcript-btn"
              onClick={handleSummaryGeneration}
              disabled={!transcript || isSummaryLoading}
            >
              {isSummaryLoading ? 'Generating Summary...' : 'Generate Summary'}
            </button>

          </div>


          {summary && (

            <div
              style={{
                marginTop: '24px', padding: '20px', borderRadius: '14px',
                background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.18)'
              }}
            >

              <div className="tr-section-heading">

                <FiFileText size={18} className="tr-purple" />

                <div>
                  <h2>Generated Summary</h2>
                  <p>
                    {summaryType}
                    {' summary • '}
                    {language === 'malayalam' ? 'Malayalam' : 'English'}
                  </p>
                </div>

              </div>

              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {summary}
              </div>

              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>

                <button
                  className="tr-get-transcript-btn"
                  onClick={handlePdfGeneration}
                >
                  Generate PDF
                </button>

              </div>

            </div>

          )}

        </section>

      </div>


      {/* BOTTOM NAVIGATION */}

      <nav className="sd-bottom-nav">

        <button className="sd-nav-item" onClick={() => navigate('/home')}>
          <FiHome size={20} className="sd-nav-icon" />
          <span className="sd-nav-label">Home</span>
        </button>

        <button className="sd-nav-item active" onClick={() => navigate('/documents')}>
          <FiFileText size={20} className="sd-nav-icon" />
          <span className="sd-nav-label">Transcripts</span>
        </button>

        <div className="sd-central-plus-wrapper">

          <button
            className="sd-central-plus-btn"
            aria-label="Add / New"
            onClick={() => navigate('/home')}
          >
            <FiPlus size={24} />
          </button>

          <span className="sd-nav-label sd-plus-label">Add / New</span>

        </div>

        <button className="sd-nav-item" onClick={() => navigate('/downloads')}>
          <FiDownload size={20} className="sd-nav-icon" />
          <span className="sd-nav-label">Downloads</span>
        </button>

        <button className="sd-nav-item" onClick={() => navigate('/profile')}>
          <FiUser size={20} className="sd-nav-icon" />
          <span className="sd-nav-label">Profile</span>
        </button>

      </nav>

    </div>

  )

}