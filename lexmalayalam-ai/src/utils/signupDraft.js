import { supabase } from '../supabase'

const DRAFT_KEY = 'smartdoc:signup-draft:v1'
const LEGACY_DRAFT_KEY = 'smartdoc_qualification'

const normalizeDraftShape = (raw) => {
  if (!raw || typeof raw !== 'object') return null

  const qualifications = (Array.isArray(raw.qualifications) ? raw.qualifications : [])
    .map((item) => ({
      highestQualification: String(
        item.highestQualification ?? item.qualification ?? item.highest_qualification ?? '',
      ).trim(),
      degree: String(item.degree ?? '').trim(),
      specialization: String(item.specialization ?? item.stream ?? '').trim(),
      yearOfPassing: item.yearOfPassing ?? item.year_of_passing ?? '',
    }))
    .filter((item) => item.highestQualification)

  return {
    fullName: String(raw.fullName ?? raw.full_name ?? '').trim(),
    dateOfBirth: String(raw.dateOfBirth ?? raw.date_of_birth ?? '').trim(),
    age: raw.age ?? '',
    category: String(raw.category ?? '').trim(),
    qualifications,
    savedAt: raw.savedAt ?? raw.saved_at ?? null,
  }
}

export const readSignupDraft = () => {
  for (const key of [DRAFT_KEY, LEGACY_DRAFT_KEY]) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null')
      const normalized = normalizeDraftShape(parsed)
      if (normalized && normalized.qualifications.length) return normalized
    } catch {
      // try the next key
    }
  }
  return null
}

export const saveSignupDraft = (draft) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    return false
  }
  return true
}

export const clearSignupDraft = () => {
  for (const key of [DRAFT_KEY, LEGACY_DRAFT_KEY]) {
    try {
      localStorage.removeItem(key)
    } catch {
      // storage may be unavailable in private mode
    }
  }
  return true
}

export const readSelectedExams = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('smartdoc_selected_exams') || '[]')
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && id) : []
  } catch {
    return []
  }
}

export const writeSelectedExams = (exams) => {
  const unique = [...new Set((exams || []).filter((id) => typeof id === 'string' && id))]
  try {
    localStorage.setItem('smartdoc_selected_exams', JSON.stringify(unique))
  } catch {
    return false
  }
  return unique
}

const cleanQualifications = (qualifications) =>
  (Array.isArray(qualifications) ? qualifications : [])
    .filter((item) => String(item?.highestQualification || '').trim())
    .map((item) => ({
      highestQualification: String(item.highestQualification).trim(),
      degree: String(item.degree || '').trim(),
      specialization: String(item.specialization || '').trim(),
      yearOfPassing:
        item.yearOfPassing === '' || item.yearOfPassing == null ? null : Number(item.yearOfPassing),
    }))

export const persistProfileToSupabase = async (userId, draft) => {
  const fullName = String(draft.fullName || '').trim()
  const dateOfBirth = String(draft.dateOfBirth || '').trim()
  const category = String(draft.category || '').trim()
  const age = draft.age === '' || draft.age == null ? null : Number(draft.age)
  const cleaned = cleanQualifications(draft.qualifications)

  const { error: profileError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        full_name: fullName,
        date_of_birth: dateOfBirth || null,
        age,
        category: category || null,
        qualifications: cleaned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

  if (profileError) throw profileError

  const timestamp = new Date().toISOString()

  if (cleaned.length) {
    // Insert before deleting so a rejected insert can never leave the user with
    // zero qualification rows.
    const { error: insertError } = await supabase.from('user_qualifications').insert(
      cleaned.map((item) => ({
        user_id: userId,
        full_name: fullName,
        date_of_birth: dateOfBirth || null,
        age,
        highest_qualification: item.highestQualification,
        degree: item.degree || null,
        specialization: item.specialization || null,
        year_of_passing: item.yearOfPassing,
        category: category || null,
        updated_at: timestamp,
      })),
    )

    if (insertError) throw insertError
  }

  const { error: clearError } = await supabase
    .from('user_qualifications')
    .delete()
    .eq('user_id', userId)

  if (clearError) throw clearError

  if (cleaned.length) {
    const { error: staleError } = await supabase
      .from('user_qualifications')
      .delete()
      .eq('user_id', userId)
      .neq('updated_at', timestamp)

    if (staleError) throw staleError
  }

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      selected_exams: readSelectedExams(),
    },
  })

  if (metadataError) throw metadataError
}

export const persistSelectedExamsToSupabase = async (exams) => {
  const unique = writeSelectedExams(exams)
  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return unique

  const { error } = await supabase.auth.updateUser({ data: { selected_exams: unique } })
  if (error) throw error

  return unique
}

export const flushSignupDraft = async () => {
  const draft = readSignupDraft()
  if (!draft) return null

  const { data } = await supabase.auth.getUser()
  const user = data?.user
  if (!user) return null

  await persistProfileToSupabase(user.id, draft)
  clearSignupDraft()

  return draft
}