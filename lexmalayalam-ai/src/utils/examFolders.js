const getExamValue = (exam) => {
  if (exam && typeof exam === 'object') {
    return exam.exam_name || exam.examName || exam.name || exam.exam_id || exam.id || exam.value || ''
  }

  return exam == null ? '' : String(exam)
}

export const getExamFolderName = (exam) => {
  const value = getExamValue(exam).trim()
  if (!value) return ''

  const normalized = value.toLowerCase()
  if (
    normalized === 'psc' ||
    normalized === 'kerala psc' ||
    normalized === 'kerala public service commission'
  ) return 'PSC'

  if (
    normalized === 'ssc' ||
    normalized === 'staff selection commission'
  ) return 'SSC'

  if (
    normalized === 'upsc' ||
    normalized === 'union public service commission'
  ) return 'UPSC'

  if (
    normalized === 'bank' ||
    normalized === 'banking' ||
    normalized === 'banking exams'
  ) return 'Banking'

  if (
    normalized === 'railway' ||
    normalized === 'railways'
  ) return 'Railway'

  if (normalized === 'other') return 'Other'

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\b(Psc|Ssc|Upsc|Ibps|Sbi|Rbi|Rrb|Cgl|Po)\b/gi, (term) => term.toUpperCase())
}

export const getExamCategory = (exam) => {
  const value = getExamValue(
    exam && typeof exam === 'object'
      ? (exam.category || exam.organization || exam.exam_id || exam.exam_name || exam)
      : exam
  ).trim()
  if (!value) return ''

  const normalized = value.toLowerCase()
  if (
    normalized === 'psc' ||
    /\bpsc\b/.test(normalized) ||
    normalized.includes('kerala psc') ||
    normalized.includes('public service commission')
  ) return 'PSC'
  if (normalized === 'ssc' || normalized.includes('staff selection commission') || /\bssc\b/.test(normalized)) return 'SSC'
  if (normalized === 'upsc' || normalized.includes('union public service commission') || /\bupsc\b/.test(normalized)) return 'UPSC'
  if (normalized === 'bank' || normalized.includes('banking') || /\b(sbi|ibps|rbi)\b/.test(normalized)) return 'Banking'
  if (normalized.includes('railway') || normalized.includes('railways') || /\brrb\b/.test(normalized)) return 'Railway'
  return getExamFolderName(value)
}

export const getExamSubfolderName = (exam) => {
  if (exam && typeof exam === 'object') {
    const value = exam.exam_name || exam.examName || exam.notification_title || exam.subcategory || exam.subfolder
    if (value && String(value).trim()) return String(value).trim()
  }

  return 'General'
}

export const uniqueExamFolders = (exams = []) => {
  const list = Array.isArray(exams) ? exams : [exams]
  const seen = new Set()

  return list.reduce((folders, exam) => {
    const name = getExamFolderName(exam)
    const key = name.toLocaleLowerCase()
    if (name && !seen.has(key)) {
      seen.add(key)
      folders.push(name)
    }
    return folders
  }, [])
}
