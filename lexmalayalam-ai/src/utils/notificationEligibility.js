export const ELIGIBILITY_MATCH = 'match';
export const ELIGIBILITY_NO_MATCH = 'no_match';
export const ELIGIBILITY_UNKNOWN = 'unknown';

const normalizeComparable = (value) => String(value || '')
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const QUALIFICATION_EQUIVALENTS = [
  ['10th', 'sslc', 'standard x', 'class x', 'secondary school'],
  ['12th', 'plus two', 'higher secondary', 'senior secondary', 'standard xii', 'class xii'],
  ['diploma', 'diploma engineering'],
  ['bachelors degree', 'bachelor degree', 'undergraduate degree'],
  ['masters degree', 'master degree', 'postgraduate degree'],
];

const normalizeForField = (value, field) => {
  const normalized = normalizeComparable(value);
  if (field === 'qualification') {
    const group = QUALIFICATION_EQUIVALENTS.find((items) => items.includes(normalized));
    return group ? group[0] : normalized;
  }
  return normalized;
};

const SCHOOL_ROMAN_LEVELS = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6,
  vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
};

const getEducationLevel = (value) => {
  const text = normalizeComparable(value);
  if (!text) return null;

  if (/\b(?:masters?|postgraduate|post graduate|pg)\b/.test(text)) return 18;
  if (/\b(?:bachelors?|undergraduate|graduation|graduate degree)\b/.test(text)) return 15;
  if (/\b(?:diploma|polytechnic)\b/.test(text)) return 13;
  if (/\b(?:12th|twelfth|plus two|higher secondary|senior secondary|class xii|standard xii|hse)\b/.test(text)) return 12;
  if (/\b(?:10th|tenth|sslc|matriculation|matric|class x|standard x|secondary school)\b/.test(text)) return 10;
  if (/\b(?:8th|eighth)\b/.test(text)) return 8;

  const schoolGrade = /\b(?:class|standard|std)\s+(i{1,3}|iv|v|vi|vii|viii|ix|x|xi|xii|\d{1,2})\b/.exec(text);
  if (schoolGrade) {
    const grade = /^\d+$/.test(schoolGrade[1])
      ? Number(schoolGrade[1])
      : SCHOOL_ROMAN_LEVELS[schoolGrade[1]];
    return grade >= 1 && grade <= 12 ? grade : null;
  }

  const ordinalGrade = /\b(\d{1,2})(?:st|nd|rd|th)\s+(?:pass|standard|class)\b/.exec(text);
  if (ordinalGrade) {
    const grade = Number(ordinalGrade[1]);
    return grade >= 1 && grade <= 12 ? grade : null;
  }

  return null;
};

const SUBJECT_EQUIVALENTS = [
  ['statistics', 'statistical'],
  ['computer applications', 'computer application', 'mca', 'master of computer applications'],
  ['computer science', 'computing'],
  ['mathematics', 'mathematical'],
  ['pharmacy', 'pharmaceutical', 'pharma'],
];

const getSpecificSubject = (requirement) => {
  const text = normalizeComparable(requirement);
  const subjectMatch = /\b(?:degree|diploma|certificate)\s+in\s+(.+?)(?=\b(?:with|from|of|and|not less|minimum|at least)\b|$)/.exec(text);
  if (!subjectMatch) return null;
  const subject = subjectMatch[1].trim();
  if (!subject || /^(?:any|relevant|related|appropriate|concerned)\b/.test(subject)) return null;
  return subject;
};

const subjectMatches = (requiredSubject, userQualification) => {
  const userSubjects = normalizeComparable([
    userQualification?.degree,
    userQualification?.specialization,
  ].filter(Boolean).join(' '));
  if (!userSubjects) return null;

  const equivalentGroup = SUBJECT_EQUIVALENTS.find((group) =>
    group.some((term) => requiredSubject.includes(normalizeComparable(term)))
  );
  const acceptedTerms = equivalentGroup || [requiredSubject];
  return acceptedTerms.some((term) => userSubjects.includes(normalizeComparable(term)));
};

const requirementMatches = (requirement, userValue, field) => {
  const req = normalizeForField(requirement, field);
  const user = normalizeForField(userValue, field);
  if (!req || !user) return null;
  if (req === user) return true;

  const alternatives = String(requirement)
    .split(/\s+(?:or|and\/or)\s+|[;|/]/i)
    .map((item) => normalizeForField(item, field))
    .filter(Boolean);
  if (alternatives.includes(user)) return true;
  if (alternatives.length > 1) {
    const allRecognizable = alternatives.every((item) =>
      QUALIFICATION_EQUIVALENTS.some((group) => group.includes(item))
      || item.split(' ').length <= 4
    );
    return allRecognizable ? false : null;
  }

  const simpleRequirement = req.split(' ').length <= 4 && user.split(' ').length <= 4;
  return simpleRequirement ? false : null;
};

const parseAgeBounds = (ageLimit) => {
  const text = String(ageLimit || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text || /\b(?:relaxation|relaxed|born between|cut ?off date|as on)\b/.test(text)) return null;

  const range = /\b(\d{1,2})\s*(?:to|-|–|—)\s*(\d{1,2})\b/.exec(text);
  if (range) {
    const minimum = Number(range[1]);
    const maximum = Number(range[2]);
    return minimum <= maximum ? { minimum, maximum } : null;
  }

  const maximum = /\b(?:maximum|max|up to|not more than|not above)\s*(\d{1,2})\b/.exec(text);
  if (maximum) return { minimum: null, maximum: Number(maximum[1]) };

  const minimum = /\b(?:minimum|min|not less than|at least)\s*(\d{1,2})\b/.exec(text);
  if (minimum) return { minimum: Number(minimum[1]), maximum: null };

  return null;
};

const ageMatches = (age, ageLimit) => {
  const bounds = parseAgeBounds(ageLimit);
  const numericAge = Number(age);
  if (!bounds || !Number.isFinite(numericAge) || numericAge <= 0) return true;
  if (bounds.minimum !== null && numericAge < bounds.minimum) return false;
  if (bounds.maximum !== null && numericAge > bounds.maximum) return false;
  return true;
};

const evaluateQualification = (exam, profile, userQualification) => {
  if (!exam?.qualification) return ELIGIBILITY_UNKNOWN;

  const requiredEducationLevel = getEducationLevel(exam.qualification);
  const userEducationLevel = getEducationLevel(userQualification?.highestQualification);
  const requirementText = normalizeComparable(exam.qualification);
  const isDiplomaRequirement = /\b(?:diploma|polytechnic|iti|trade certificate)\b/.test(requirementText);
  let qualificationMatch;

  // Higher academic levels can satisfy lower school requirements, but do not
  // automatically satisfy a separate vocational diploma requirement.
  if (isDiplomaRequirement) {
    const userQualificationText = normalizeComparable([
      userQualification?.highestQualification,
      userQualification?.degree,
      userQualification?.specialization,
    ].filter(Boolean).join(' '));
    qualificationMatch = /\b(?:diploma|polytechnic|iti|trade certificate)\b/.test(userQualificationText);
    const diplomaSubject = getSpecificSubject(exam.qualification);
    if (qualificationMatch && diplomaSubject) {
      qualificationMatch = subjectMatches(diplomaSubject, userQualification);
    }
  } else {
    qualificationMatch = requiredEducationLevel !== null && userEducationLevel !== null
      ? userEducationLevel >= requiredEducationLevel
      : requirementMatches(exam.qualification, userQualification?.highestQualification, 'qualification');
  }
  if (qualificationMatch === null) return ELIGIBILITY_UNKNOWN;
  if (!qualificationMatch) return ELIGIBILITY_NO_MATCH;

  const requiredSubject = getSpecificSubject(exam.qualification);
  if (requiredSubject) {
    const subjectMatch = subjectMatches(requiredSubject, userQualification);
    if (subjectMatch === null) return ELIGIBILITY_UNKNOWN;
    if (!subjectMatch) return ELIGIBILITY_NO_MATCH;
  }

  if (exam.degree) {
    const degreeMatch = requirementMatches(exam.degree, userQualification?.degree, 'degree');
    if (degreeMatch === null) return ELIGIBILITY_UNKNOWN;
    if (!degreeMatch) return ELIGIBILITY_NO_MATCH;
  }

  if (exam.stream) {
    const streamMatch = requirementMatches(exam.stream, userQualification?.specialization, 'stream');
    if (streamMatch === null) return ELIGIBILITY_UNKNOWN;
    if (!streamMatch) return ELIGIBILITY_NO_MATCH;
  }

  return ageMatches(profile?.age, exam.age_limit) ? ELIGIBILITY_MATCH : ELIGIBILITY_NO_MATCH;
};

export const evaluateEligibility = (exam, userProfile) => {
  if (!exam || !userProfile || !Array.isArray(userProfile.qualifications) || userProfile.qualifications.length === 0) {
    return ELIGIBILITY_UNKNOWN;
  }

  const outcomes = userProfile.qualifications.map((qualification) =>
    evaluateQualification(exam, userProfile, qualification)
  );
  if (outcomes.includes(ELIGIBILITY_MATCH)) return ELIGIBILITY_MATCH;
  if (outcomes.includes(ELIGIBILITY_UNKNOWN)) return ELIGIBILITY_UNKNOWN;
  return ELIGIBILITY_NO_MATCH;
};

export const isCurrentNotification = (notification) => {
  if (!notification.is_active) return false;
  const lastDate = String(notification.application_last_date || '').slice(0, 10);
  return !/^\d{4}-\d{2}-\d{2}$/.test(lastDate)
    || lastDate >= new Date().toISOString().slice(0, 10);
};

export const getMatchedNotifications = (notifications, userProfile) => {
  if (!userProfile) return [];
  return notifications.filter((notification) =>
    isCurrentNotification(notification)
    && evaluateEligibility(notification, userProfile) === ELIGIBILITY_MATCH
  );
};

export const normalizeNotificationCategory = (category) => {
  const raw = String(category || '').trim().toLowerCase();
  // Check UPSC first: "UPSC" contains the substring "PSC".
  if (raw.includes('upsc') || raw.includes('union public service commission')) return 'UPSC';
  if (raw === 'psc' || raw.includes('kerala') || raw.includes('state psc')) return 'PSC';
  if (raw.includes('ssc')) return 'SSC';
  if (raw.includes('railway') || raw.includes('rrb')) return 'Railway';
  if (raw.includes('bank') || raw.includes('ibps') || raw.includes('sbi')) return 'Banking';
  return 'Other';
};

export const filterNotifications = (notifications, selectedCategory, searchQuery) => {
  return notifications.filter((item) => {
    if (selectedCategory !== 'All'
      && normalizeNotificationCategory(item.category) !== selectedCategory) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const searchable = [
        item.exam_name,
        item.notification_title,
        item.organization,
        item.category,
        item.qualification,
        item.degree,
        item.stream,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!searchable.includes(query)) return false;
    }
    return true;
  });
};

export const toggleReminderId = (reminderIds, notificationId) => reminderIds.includes(notificationId)
  ? reminderIds.filter((id) => id !== notificationId)
  : [...reminderIds, notificationId];

export const getOfficialNotificationUrl = (notification) =>
  notification.official_notification_url || notification.official_website_url || null;
