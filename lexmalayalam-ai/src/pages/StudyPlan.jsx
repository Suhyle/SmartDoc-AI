import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiClock,
  FiEdit3,
  FiExternalLink,
  FiFileText,
  FiPlayCircle,
  FiPlus,
  FiRefreshCw,
  FiRepeat,
  FiTrash2,
  FiZap,
  FiX,
} from 'react-icons/fi';
import { supabase } from '../supabase';
import './StudyPlan.css';

const DURATION_OPTIONS = [
  { label: '30 days', days: 30 },
  { label: '2 months', days: 60 },
  { label: '3 months', days: 90 },
  { label: 'Custom', days: null },
];

const API_BASE_URL = import.meta.env.VITE_API_URL
  || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

const DONE_KEY = 'smartdoc-study-plan:done';
const REMINDERS_KEY = 'smartdoc_reminders';
const PLAN_LAST_KEY = 'smartdoc-study-plan:last';
const PLAN_LAST_EXAM_KEY = 'smartdoc-study-plan:last-exam-id';

const readReminders = () => {
  const saved = safeJson(REMINDERS_KEY);
  return Array.isArray(saved) ? saved : [];
};

const loadPlanForExam = (examId) => {
  if (examId === undefined || examId === null) return null;
  const savedPlan = safeJson(`smartdoc-study-plan:plan:${examId}`);
  const usablePlan = (candidate) => candidate?.customSyllabus === true
    || (Array.isArray(candidate?.sections) && candidate.sections.length > 0);
  if (usablePlan(savedPlan)) return savedPlan;
  const lastExamId = localStorage.getItem(PLAN_LAST_EXAM_KEY)
    || localStorage.getItem('smartdoc-study-plan:exam-id');
  const lastPlan = lastExamId === String(examId) ? safeJson(PLAN_LAST_KEY) : null;
  return usablePlan(lastPlan) ? lastPlan : null;
};

const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const dateLabel = (value) => {
  if (!value) return 'Date not listed';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Date not listed'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const safeJson = (value) => {
  try {
    return JSON.parse(localStorage.getItem(value) || 'null');
  } catch {
    return null;
  }
};

const youtubeEmbedUrl = (url) => {
  const match = String(url || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : '';
};

const blankCustomSection = () => ({ name: '', topics: '' });

function DeleteConfirmation({ message, onCancel, onConfirm }) {
  return (
    <div className="sp-delete-confirmation" role="alertdialog" aria-live="polite">
      <div><strong>Confirm deletion</strong><p>{message}</p></div>
      <div className="sp-delete-confirmation-actions">
        <button type="button" className="cancel" onClick={onCancel}>Keep it</button>
        <button type="button" className="confirm" onClick={onConfirm}>Yes, delete</button>
      </div>
    </div>
  );
}

export default function StudyPlan() {
  const navigate = useNavigate();
  const location = useLocation();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(location.state?.exam || null);
  const [reminderIds, setReminderIds] = useState(readReminders);
  const [loadingExams, setLoadingExams] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [customDays, setCustomDays] = useState(45);
  const [studyHoursPerDay, setStudyHoursPerDay] = useState(3);
  const [startDate, setStartDate] = useState(today());
  const [plan, setPlan] = useState(() => location.state?.plan || loadPlanForExam(location.state?.exam?.id));
  const [generating, setGenerating] = useState(false);
  const [planError, setPlanError] = useState('');
  const [weekIndex, setWeekIndex] = useState(0);
  const [done, setDone] = useState(() => safeJson(DONE_KEY) || {});
  const [customSyllabusSections, setCustomSyllabusSections] = useState([blankCustomSection]);
  const [showAllVideos, setShowAllVideos] = useState(false);
  const [findingMoreVideos, setFindingMoreVideos] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [taskDraft, setTaskDraft] = useState({ section: '', topic: '', activity: '', studyHours: 1 });
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    let alive = true;
    const loadExams = async () => {
      setLoadingExams(true);
      setLoadError('');
      const { data, error } = await supabase
        .from('exam_notifications')
        .select('id, category, exam_name, notification_title, organization, description, qualification, degree, stream, application_last_date, official_notification_url, official_website_url')
        .eq('is_active', true)
        .order('application_last_date', { ascending: true });

      if (!alive) return;
      if (error) {
        setLoadError(error.message || 'Could not load exams from Supabase.');
      } else {
        const rows = data || [];
        setExams(rows);
        const routeExam = location.state?.exam;
        const savedExamId = localStorage.getItem('smartdoc-study-plan:exam-id');
        const preferredExamId = routeExam?.id ?? savedExamId;
        const chosen = rows.find((row) => preferredExamId !== null && preferredExamId !== undefined && String(row.id) === String(preferredExamId))
          || (routeExam?.exam_name ? routeExam : null)
          || null;
        setSelectedExam(chosen);
        if (!location.state?.plan) setPlan(loadPlanForExam(chosen?.id));
        if (chosen?.id !== undefined && chosen?.id !== null) {
          localStorage.setItem('smartdoc-study-plan:exam-id', String(chosen.id));
        } else {
          localStorage.removeItem('smartdoc-study-plan:exam-id');
        }
      }
      setLoadingExams(false);
    };
    loadExams();
    return () => { alive = false; };
    // Initial route state selects the exam; fetch current active rows once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveDurationDays = useMemo(
    () => durationDays || Math.min(180, Math.max(1, Number(customDays) || 1)),
    [durationDays, customDays],
  );

  const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
  const currentWeek = weeks[weekIndex] || null;
  const sections = Array.isArray(plan?.sections) ? plan.sections : [];
  const videos = Array.isArray(plan?.videos) ? plan.videos : [];
  const visibleVideos = showAllVideos ? videos : videos.slice(0, 4);
  const sources = Array.isArray(plan?.sources) ? plan.sources : [];
  const reminderExams = exams.filter((exam) => reminderIds.some((id) => String(id) === String(exam.id)));
  const totalTopics = sections.reduce((count, section) => count + (section.topics?.length || 0), 0);

  const taskId = (w, d, t) => `${w}-${d}-${t}`;
  const countTasks = (week) => (week?.days || []).reduce((n, day) => n + (day.tasks?.length || 0), 0);
  const totalTasks = weeks.reduce((n, week) => n + countTasks(week), 0);
  const selectedExamKey = String(selectedExam?.id ?? 'no-exam');
  const selectedDone = done[selectedExamKey] || {};
  const doneTasks = Object.values(selectedDone).filter(Boolean).length;
  const progress = totalTasks ? Math.min(100, Math.round((doneTasks / totalTasks) * 100)) : 0;
  const sectionTaskStats = {};
  weeks.forEach((week, weekNumber) => (week.days || []).forEach((day, dayNumber) => (day.tasks || []).forEach((task, taskNumber) => {
    const name = task.section || '';
    if (!sectionTaskStats[name]) sectionTaskStats[name] = { total: 0, completed: 0, hours: 0 };
    sectionTaskStats[name].total += 1;
    sectionTaskStats[name].hours += Number(task.studyHours) || 0;
    if (selectedDone[taskId(weekNumber, dayNumber, taskNumber)]) sectionTaskStats[name].completed += 1;
  })));
  const weekDone = (currentWeek?.days || []).reduce(
    (n, day, d) => n + (day.tasks || []).filter((_, t) => selectedDone[taskId(weekIndex, d, t)]).length, 0,
  );
  const weekTotal = countTasks(currentWeek);

  const resetDone = (examId = selectedExam?.id) => {
    if (examId === undefined || examId === null) return;
    setDone((current) => {
      const next = { ...current };
      delete next[String(examId)];
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const toggleTask = (id) => {
    setDone((current) => {
      const examTasks = { ...(current[selectedExamKey] || {}), [id]: !selectedDone[id] };
      const next = { ...current, [selectedExamKey]: examTasks };
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const persistPlanEdit = (nextPlan) => {
    setPlan(nextPlan);
    if (selectedExam?.id !== undefined && selectedExam?.id !== null) {
      localStorage.setItem(`smartdoc-study-plan:plan:${selectedExam.id}`, JSON.stringify(nextPlan));
      localStorage.setItem(PLAN_LAST_EXAM_KEY, String(selectedExam.id));
      localStorage.setItem('smartdoc-study-plan:exam-id', String(selectedExam.id));
    }
    localStorage.setItem(PLAN_LAST_KEY, JSON.stringify(nextPlan));
  };

  const saveTaskEdit = (weekNumber, dayNumber, taskNumber, editedTask) => {
    const nextPlan = {
      ...plan,
      weeks: plan.weeks.map((week, weekIndexValue) => weekIndexValue !== weekNumber ? week : {
        ...week,
        days: week.days.map((day, dayIndexValue) => dayIndexValue !== dayNumber ? day : {
          ...day,
          tasks: day.tasks.map((task, taskIndexValue) => taskIndexValue === taskNumber ? {
            ...task,
            section: editedTask.section.trim() || task.section,
            topic: editedTask.topic.trim() || task.topic,
            activity: editedTask.activity.trim() || task.activity,
            studyHours: Math.min(24, Math.max(0.25, Number(editedTask.studyHours) || Number(task.studyHours) || 1)),
          } : task),
        }),
      }),
    };
    persistPlanEdit(nextPlan);
  };

  const removeTask = (weekNumber, dayNumber, taskNumber) => {
    const nextPlan = {
      ...plan,
      weeks: plan.weeks.map((week, weekIndexValue) => weekIndexValue !== weekNumber ? week : {
        ...week,
        days: week.days.map((day, dayIndexValue) => dayIndexValue !== dayNumber ? day : {
          ...day,
          tasks: day.tasks.filter((_, taskIndexValue) => taskIndexValue !== taskNumber),
        }),
      }),
    };
    const nextDone = { ...done };
    const examTasks = { ...(nextDone[selectedExamKey] || {}) };
    const dayPrefix = `${weekNumber}-${dayNumber}-`;
    const shifted = {};
    Object.entries(examTasks).forEach(([key, value]) => {
      if (!key.startsWith(dayPrefix)) {
        shifted[key] = value;
        return;
      }
      const taskIndexValue = Number(key.slice(dayPrefix.length));
      if (!Number.isInteger(taskIndexValue) || taskIndexValue === taskNumber) return;
      const nextTaskIndex = taskIndexValue > taskNumber ? taskIndexValue - 1 : taskIndexValue;
      shifted[`${dayPrefix}${nextTaskIndex}`] = value;
    });
    nextDone[selectedExamKey] = shifted;
    setDone(nextDone);
    localStorage.setItem(DONE_KEY, JSON.stringify(nextDone));
    persistPlanEdit(nextPlan);
  };

  const deleteTimetableNow = () => {
    if (selectedExam?.id !== undefined && selectedExam?.id !== null) {
      localStorage.removeItem(`smartdoc-study-plan:plan:${selectedExam.id}`);
      resetDone(selectedExam.id);
      if (localStorage.getItem(PLAN_LAST_EXAM_KEY) === String(selectedExam.id)) {
        localStorage.removeItem(PLAN_LAST_EXAM_KEY);
        localStorage.removeItem(PLAN_LAST_KEY);
      }
      if (localStorage.getItem('smartdoc-study-plan:exam-id') === String(selectedExam.id)) {
        localStorage.removeItem('smartdoc-study-plan:exam-id');
      }
    } else {
      localStorage.removeItem(PLAN_LAST_KEY);
      localStorage.removeItem(PLAN_LAST_EXAM_KEY);
      localStorage.removeItem('smartdoc-study-plan:exam-id');
    }
    setPlan(null);
    setSelectedExam(null);
    setWeekIndex(0);
  };

  const addCustomSection = () => setCustomSyllabusSections((current) => [...current, blankCustomSection()]);

  const updateCustomSection = (index, key, value) => {
    setCustomSyllabusSections((current) => current.map((section, sectionIndex) => (
      sectionIndex === index ? { ...section, [key]: value } : section
    )));
  };

  const createPlanFromCustomSyllabus = () => {
    const syllabusSections = customSyllabusSections
      .map((section) => ({
        name: section.name.trim(),
        topics: section.topics.split(/[\n,;]+/).map((topic) => topic.trim()).filter(Boolean),
      }))
      .filter((section) => section.name && section.topics.length);

    if (!syllabusSections.length) {
      setPlanError('Add at least one syllabus subject and one topic before building the timetable.');
      return;
    }

    const days = Array.from({ length: effectiveDurationDays }, (_, dayIndex) => {
      const section = syllabusSections[dayIndex % syllabusSections.length];
      const topic = section.topics[Math.floor(dayIndex / syllabusSections.length) % section.topics.length];
      const date = new Date(`${startDate}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() + dayIndex);
      const activity = (dayIndex + 1) % 14 === 0
        ? 'Mock test'
        : (dayIndex + 1) % 7 === 0
          ? 'Revision'
          : dayIndex % 2 === 0 ? 'Learn' : 'Practice';
      return {
        date: date.toISOString().slice(0, 10),
        day: date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
        tasks: [{ section: section.name, topic, studyHours: Number(studyHoursPerDay), activity }],
      };
    });
    const weeks = [];
    for (let index = 0; index < days.length; index += 7) {
      const weekDays = days.slice(index, index + 7);
      weeks.push({
        weekNumber: weeks.length + 1,
        focus: [...new Set(weekDays.map((day) => day.tasks[0].section))].join(' and '),
        days: weekDays,
      });
    }

    const customPlan = {
      summary: `Your syllabus is arranged across ${effectiveDurationDays} days, with subjects rotated evenly and revision and mock-test sessions included. This syllabus was entered by you and has not been independently verified.`,
      exactMatch: false,
      syllabusVerified: false,
      customSyllabus: true,
      needsCustomSyllabus: false,
      sections: syllabusSections.map((section) => ({
        ...section,
        summary: 'Topics supplied by you',
        estimatedHours: Math.ceil((effectiveDurationDays / syllabusSections.length) * Number(studyHoursPerDay)),
        difficulty: 'Review',
        sourceType: 'user_provided',
      })),
      weeks,
      videos: [],
      sources: [],
      generatedBy: 'Your syllabus',
      providerFlag: '',
      fallbackUsed: false,
      webSearchUsed: false,
    };
    setPlan(customPlan);
    setPlanError('');
    setWeekIndex(0);
    resetDone(selectedExam?.id);
    if (selectedExam?.id !== undefined && selectedExam?.id !== null) {
      localStorage.setItem(`smartdoc-study-plan:plan:${selectedExam.id}`, JSON.stringify(customPlan));
      localStorage.setItem(PLAN_LAST_EXAM_KEY, String(selectedExam.id));
      localStorage.setItem('smartdoc-study-plan:exam-id', String(selectedExam.id));
    }
    localStorage.setItem(PLAN_LAST_KEY, JSON.stringify(customPlan));
  };

  const handleExamChange = (event) => {
    const next = exams.find((exam) => String(exam.id) === event.target.value);
    setSelectedExam(next || null);
    setPlan(loadPlanForExam(next?.id));
    setPlanError('');
    setWeekIndex(0);
    setCustomSyllabusSections([blankCustomSection()]);
    setShowAllVideos(false);
    setVideoError('');
    if (next?.id !== undefined && next?.id !== null) {
      localStorage.setItem('smartdoc-study-plan:exam-id', String(next.id));
    } else {
      localStorage.removeItem('smartdoc-study-plan:exam-id');
    }
  };

  const selectReminderExam = (exam) => {
    setSelectedExam(exam);
    setPlan(loadPlanForExam(exam.id));
    setPlanError('');
    setWeekIndex(0);
    setCustomSyllabusSections([blankCustomSection()]);
    setShowAllVideos(false);
    setVideoError('');
    localStorage.setItem('smartdoc-study-plan:exam-id', String(exam.id));
  };

  const deleteReminderTimetableNow = (exam) => {
    const examId = exam.id;
    const next = reminderIds.filter((id) => String(id) !== String(examId));
    setReminderIds(next);
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(next));
    localStorage.removeItem(`smartdoc-study-plan:plan:${examId}`);
    resetDone(examId);
    if (localStorage.getItem(PLAN_LAST_EXAM_KEY) === String(examId)) {
      localStorage.removeItem(PLAN_LAST_EXAM_KEY);
      localStorage.removeItem(PLAN_LAST_KEY);
    }
    if (localStorage.getItem('smartdoc-study-plan:exam-id') === String(examId)) {
      localStorage.removeItem('smartdoc-study-plan:exam-id');
    }
    if (String(selectedExam?.id) === String(examId)) {
      setPlan(null);
      setSelectedExam(null);
      setWeekIndex(0);
    }
  };

  const confirmPendingDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.type === 'task') {
      removeTask(pendingDelete.weekNumber, pendingDelete.dayNumber, pendingDelete.taskNumber);
    } else if (pendingDelete.type === 'plan') {
      deleteTimetableNow();
    } else if (pendingDelete.type === 'reminder') {
      const exam = exams.find((item) => String(item.id) === String(pendingDelete.examId));
      if (exam) deleteReminderTimetableNow(exam);
    }
    setPendingDelete(null);
  };

  const handleGenerate = async () => {
    if (!selectedExam) {
      setPlanError('Choose an exam first.');
      return;
    }
    if (!API_BASE_URL) {
      setPlanError('The study planner service is not configured. Start the SmartDoc AI backend and try again.');
      return;
    }
    setGenerating(true);
    setPlanError('');
    setWeekIndex(0);
    try {
      const response = await fetch(`${API_BASE_URL}/api/study-plan/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam: selectedExam,
          durationDays: effectiveDurationDays,
          studyHoursPerDay: Number(studyHoursPerDay),
          startDate,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !result.plan) {
        throw new Error([result.error, result.details].filter(Boolean).join(' ')
          || 'The AI providers could not create this study plan. Please try again.');
      }
      const planWithProvider = {
        ...result.plan,
        exactMatch: Boolean(result.exactMatch),
        needsCustomSyllabus: Boolean(result.needsCustomSyllabus),
        generatedBy: result.provider || (result.needsCustomSyllabus ? '' : 'AI provider'),
        providerFlag: result.providerFlag || '',
        fallbackUsed: Boolean(result.fallbackUsed),
        webSearchUsed: Boolean(result.webSearchUsed),
      };
      setPlan(planWithProvider);
      setShowAllVideos(false);
      setVideoError('');
      resetDone(selectedExam.id);
      if (selectedExam.id !== undefined && selectedExam.id !== null) {
        localStorage.setItem(`smartdoc-study-plan:plan:${selectedExam.id}`, JSON.stringify(planWithProvider));
        localStorage.setItem(PLAN_LAST_EXAM_KEY, String(selectedExam.id));
        localStorage.setItem('smartdoc-study-plan:exam-id', String(selectedExam.id));
      }
      localStorage.setItem(PLAN_LAST_KEY, JSON.stringify(planWithProvider));
    } catch (error) {
      setPlanError(error.message || 'Could not generate the study plan. Check the backend and try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleFindMoreVideos = async () => {
    if (!selectedExam || !sections.length) {
      setVideoError('Choose an exam and generate or add its syllabus before finding videos.');
      return;
    }
    if (!API_BASE_URL) {
      setVideoError('The study planner service is not configured. Start the SmartDoc AI backend and try again.');
      return;
    }
    setFindingMoreVideos(true);
    setVideoError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/study-plan/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam: selectedExam, sections, excludedVideoUrls: videos.map((video) => video.youtubeUrl), count: 4 }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Could not find more verified YouTube videos. Please try again.');
      }
      const existing = new Set(videos.map((video) => youtubeEmbedUrl(video.youtubeUrl)).filter(Boolean));
      const additions = (Array.isArray(result.videos) ? result.videos : [])
        .filter((video) => youtubeEmbedUrl(video.youtubeUrl) && !existing.has(youtubeEmbedUrl(video.youtubeUrl)));
      if (!additions.length) {
        setVideoError('No additional verified videos were found this time. Try again later.');
        return;
      }
      const updatedPlan = { ...plan, videos: [...videos, ...additions], videoProvider: result.provider || '' };
      setPlan(updatedPlan);
      setShowAllVideos(true);
      if (selectedExam?.id !== undefined && selectedExam?.id !== null) {
        localStorage.setItem(`smartdoc-study-plan:plan:${selectedExam.id}`, JSON.stringify(updatedPlan));
        localStorage.setItem(PLAN_LAST_EXAM_KEY, String(selectedExam.id));
      }
      localStorage.setItem(PLAN_LAST_KEY, JSON.stringify(updatedPlan));
    } catch (error) {
      setVideoError(error.message || 'Could not find more videos. Please try again.');
    } finally {
      setFindingMoreVideos(false);
    }
  };

  const openTranscript = (video) => {
    navigate('/transcript-summary', {
      state: {
        studyPlanVideoUrl: video.youtubeUrl,
        studyPlanVideoTitle: video.title,
        studyPlanExamName: selectedExam?.exam_name || selectedExam?.category || '',
        studyPlanCategory: selectedExam?.category || selectedExam?.organization || '',
        studyPlanExamId: selectedExam?.id || '',
        exam: selectedExam
      },
    });
  };

  const examTitle = selectedExam?.exam_name || (loadingExams ? 'Loading exams…' : 'Choose an exam');

  return (
    <main className="sp-page">
      <div className="sp-shell">
        <nav className="sp-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="sp-back-link" onClick={() => navigate('/home')}>
            <FiArrowLeft /> Back to Home
          </button>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Study plan</span>
        </nav>

        <header className="sp-hero">
          <div className="sp-hero-text">
            <h1>STUDY PLAN</h1>
          </div>
          <section className="sp-exam-card" aria-label="Selected exam">
            <div className="sp-exam-icon"><FiBookOpen /></div>
            <div className="sp-exam-summary">
              <span>Selected exam</span>
              <strong>{examTitle}</strong>
              <small>{selectedExam?.organization || selectedExam?.category || 'Select an active exam'}</small>
              <small className="sp-exam-deadline">Application deadline: {dateLabel(selectedExam?.application_last_date)}</small>
            </div>
            <div className="sp-exam-change">
              <label htmlFor="sp-exam-select"><FiRepeat /> Change exam</label>
              <select id="sp-exam-select" className="sp-exam-select" value={selectedExam?.id ?? ''} onChange={handleExamChange} disabled={loadingExams || !exams.length}>
                <option value="">Choose an exam</option>
                {exams.map((exam, index) => (
                  <option key={exam.id ?? `${exam.exam_name}-${index}`} value={exam.id}>{exam.exam_name}</option>
                ))}
              </select>
            </div>
          </section>
        </header>

        <section className="sp-reminders" aria-label="Reminder exam selections">
          <div className="sp-reminders-heading">
            <strong>Your reminder exams <span>{reminderExams.length}</span></strong>
            <small>Select a reminder to switch its study plan. Other active exams are available under Change exam.</small>
          </div>
          {reminderExams.length ? (
            <div className="sp-reminder-chips">
              {reminderExams.map((exam) => {
                const active = String(selectedExam?.id) === String(exam.id);
                return (
                  <div className={`sp-reminder-chip${active ? ' active' : ''}`} key={exam.id}>
                    <button type="button" className="sp-reminder-select" aria-pressed={active} onClick={() => selectReminderExam(exam)}>
                      <span className="sp-reminder-category">{exam.category || 'Exam'}</span>
                      <strong>{exam.exam_name}</strong>
                      {active && <span className="sp-reminder-current">Selected</span>}
                    </button>
                    <button type="button" className="sp-reminder-remove" aria-label={`Delete timetable for ${exam.exam_name}`} title="Delete this exam timetable" onClick={() => setPendingDelete({ type: 'reminder', examId: exam.id })}><FiX /></button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="sp-no-reminders">No exam reminders yet. Set a reminder on any exam notification to pin it here.</p>
          )}
          {pendingDelete?.type === 'reminder' && (
            <DeleteConfirmation
              message={`Delete the saved timetable and study progress for "${exams.find((exam) => String(exam.id) === String(pendingDelete.examId))?.exam_name || 'this exam'}"? Its reminder will also be removed.`}
              onCancel={() => setPendingDelete(null)}
              onConfirm={confirmPendingDelete}
            />
          )}
        </section>

        {(loadError || planError) && (
          <div className="sp-alert" role="alert"><FiAlertCircle /> <span>{loadError || planError}</span></div>
        )}

        <section className="sp-section sp-syllabus-section" aria-busy={generating}>
          <div className="sp-section-heading">
            <div>
              <h2>Syllabus analysis</h2>
              <p>{plan?.summary || 'Generate a plan to search for the official syllabus and break it into study sections.'}</p>
            </div>
            {plan && (
              <div className="sp-plan-statuses">
                {plan.generatedBy && (
                  <div className={`sp-provider-status${plan.fallbackUsed ? ' fallback' : ''}`}>
                    <FiZap />
                    {plan.generatedBy}{plan.providerFlag ? ` · ${plan.providerFlag}` : ''}
                    {plan.webSearchUsed ? ' · web search used' : ' · no live web search'}
                  </div>
                )}
              </div>
            )}
          </div>

          {generating ? (
            <div className="sp-section-grid" aria-label="Finding syllabus">
              {[0, 1, 2, 3, 4].map((n) => <div className="sp-syllabus-card sp-skeleton" key={n} />)}
            </div>
          ) : sections.length ? (
            <div className="sp-section-grid">
              {sections.map((section, index) => {
                const sectionStats = sectionTaskStats[section.name] || { total: 0, completed: 0, hours: 0 };
                const weight = sectionStats.total
                  ? Math.min(100, Math.round((sectionStats.completed / sectionStats.total) * 100))
                  : 0;
                const allocatedHours = sectionStats.hours || Number(section.estimatedHours) || 0;
                const level = String(section.difficulty || 'Medium').toLowerCase();
                return (
                  <article className={`sp-syllabus-card tone-${index % 5}`} key={`${section.name}-${index}`}>
                    <div className="sp-syllabus-card-top">
                      <div className="sp-section-icon"><FiBookOpen /></div>
                      <span className={`sp-difficulty ${level}`}>{section.difficulty || 'Review'}</span>
                    </div>
                    <h3>{section.name}</h3>
                    <p className="sp-section-description">{section.summary}</p>
                    <div className="sp-section-stats">
                      <span><FiFileText /> {section.topics?.length || 0} topics</span>
                      <span><FiClock /> {allocatedHours} hrs</span>
                    </div>
                    <div className="sp-weight-row"><span>Completed</span><strong>{weight}%</strong></div>
                    <div className="sp-weight-track" role="progressbar" aria-label={`${section.name} completion`} aria-valuenow={weight} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${weight}%` }} /></div>
                    {section.topics?.length > 0 && (
                      <details className="sp-topics-details">
                        <summary>View topics</summary>
                        <ul>{section.topics.map((topic, topicIndex) => <li key={`${topic}-${topicIndex}`}>{topic}</li>)}</ul>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="sp-empty-syllabus">
              <FiBookOpen />
              <span>{plan?.needsCustomSyllabus
                ? 'The web search could not verify a syllabus for this exact post and category.'
                : 'Choose your pace below and select Generate study plan. Syllabus sections will appear here.'}</span>
            </div>
          )}

          {plan?.needsCustomSyllabus && (
            <div className="sp-custom-syllabus">
              <div className="sp-custom-syllabus-heading">
                <div>
                  <h3>Add the syllabus for this exam</h3>
                  <p>Enter each subject and its topics. SmartDoc will distribute them across your selected study duration.</p>
                </div>
              </div>
              <div className="sp-custom-syllabus-list">
                {customSyllabusSections.map((section, index) => (
                  <article className="sp-custom-syllabus-item" key={`custom-section-${index}`}>
                    <label>Subject or section
                      <input type="text" value={section.name} onChange={(event) => updateCustomSection(index, 'name', event.target.value)} placeholder="e.g. General Knowledge" />
                    </label>
                    <label>Topics (separate with commas or new lines)
                      <textarea value={section.topics} onChange={(event) => updateCustomSection(index, 'topics', event.target.value)} rows="3" placeholder="e.g. Indian Constitution, Geography, Current Affairs" />
                    </label>
                    {customSyllabusSections.length > 1 && (
                      <button type="button" className="sp-custom-remove" onClick={() => setCustomSyllabusSections((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove section</button>
                    )}
                  </article>
                ))}
              </div>
              <div className="sp-custom-syllabus-actions">
                <button type="button" className="sp-custom-add" onClick={addCustomSection}>Add another subject</button>
                <button type="button" className="sp-generate-button" onClick={createPlanFromCustomSyllabus}><FiCalendar /> Build timetable from my syllabus</button>
              </div>
            </div>
          )}

          {plan && (
            <p className="sp-focus-note">
              Subject progress starts at 0% and increases as you complete its scheduled sessions. Study hours are divided evenly across the listed subjects for the selected duration.
            </p>
          )}

          {sources.length > 0 && (
            <div className="sp-sources-row">
              <span>Sources:</span>
              {sources.slice(0, 4).map((source, index) => (
                <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer">{source.title || source.type || 'Source'} <FiExternalLink /></a>
              ))}
            </div>
          )}
        </section>

        <section className="sp-section sp-controls-section">
          <div className="sp-section-heading sp-controls-heading">
            <div><h2>Build your timetable</h2><p>Choose how long you want to study and how much time you have each day.</p></div>
            {plan && <span className="sp-topic-count">{sections.length} sections · {totalTopics} topics</span>}
          </div>
          <div className="sp-controls-grid">
            <fieldset className="sp-duration-field">
              <legend>Plan duration</legend>
              <div className="sp-duration-options">
                {DURATION_OPTIONS.map((option) => (
                  <button key={option.label} type="button" aria-pressed={durationDays === option.days} className={durationDays === option.days ? 'selected' : ''} onClick={() => setDurationDays(option.days)}>{option.label}</button>
                ))}
              </div>
              {!durationDays && <label className="sp-custom-duration">Number of days (1–180)<input type="number" min="1" max="180" value={customDays} onChange={(event) => setCustomDays(event.target.value)} /></label>}
            </fieldset>
            <label className="sp-input-field">Study time per day
              <select value={studyHoursPerDay} onChange={(event) => setStudyHoursPerDay(event.target.value)}>
                {[1, 2, 3, 4, 5, 6, 8].map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? 'hour' : 'hours'}</option>)}
              </select>
            </label>
            <label className="sp-input-field">Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
            <button type="button" className="sp-generate-button" onClick={handleGenerate} disabled={generating || loadingExams || !selectedExam}>
              {generating ? <><FiRefreshCw className="sp-spin" /> Finding syllabus…</> : <><FiZap /> {plan ? 'Regenerate study plan' : 'Generate study plan'}</>}
            </button>
          </div>
          <p className="sp-plan-note">Study Plan tries Gemini, then Groq, then Antigravity, and finally DeepSeek V4.1 Flash through Ollama Cloud if earlier providers fail. The timetable spreads subjects across {effectiveDurationDays} days, with up to {studyHoursPerDay} study hours each day.</p>
        </section>

        {generating && !plan && (
          <div className="sp-section sp-loading-panel" role="status"><FiRefreshCw className="sp-spin" /> Building your timetable. This can take a minute.</div>
        )}

        {plan && (
          <div className="sp-results-grid">
            <section className="sp-section sp-week-section">
              <div className="sp-week-heading">
                <div><h2>Week {weekIndex + 1} timetable</h2>{currentWeek?.focus && <p className="sp-week-focus">{currentWeek.focus}</p>}</div>
                <div className="sp-week-actions">
                  <button type="button" className="sp-delete-plan-button" onClick={() => setPendingDelete({ type: 'plan' })}><FiTrash2 /> Delete timetable</button>
                  <div className="sp-week-controls">
                    <span>Week {weekIndex + 1} of {weeks.length || 1}</span>
                    <button type="button" aria-label="Previous week" disabled={weekIndex <= 0} onClick={() => setWeekIndex((value) => Math.max(0, value - 1))}><FiArrowLeft /></button>
                    <button type="button" aria-label="Next week" disabled={weekIndex >= weeks.length - 1} onClick={() => setWeekIndex((value) => Math.min(weeks.length - 1, value + 1))}><FiArrowRight /></button>
                  </div>
                </div>
              </div>
              {pendingDelete?.type === 'plan' && (
                <DeleteConfirmation
                  message="Delete this saved timetable and its completion progress? This cannot be undone."
                  onCancel={() => setPendingDelete(null)}
                  onConfirm={confirmPendingDelete}
                />
              )}
              {weekTotal > 0 && (
                <div className="sp-week-progress">
                  <div className="sp-weight-track"><span style={{ width: `${(weekDone / weekTotal) * 100}%` }} /></div>
                  <small>{weekDone} / {weekTotal} tasks completed</small>
                </div>
              )}
              <div className="sp-day-list">
                {(currentWeek?.days || []).map((day, dayIndex) => (
                  <article className="sp-day-row" key={`${day.date || day.day}-${dayIndex}`}>
                    <div className="sp-day-date"><strong>{day.day || dateLabel(day.date)}</strong><small>{day.date ? dateLabel(day.date) : ''}</small></div>
                    <div className="sp-day-tasks">{(day.tasks || []).map((task, taskIndex) => {
                      const id = taskId(weekIndex, dayIndex, taskIndex);
                      const checked = Boolean(done[id]);
                      const editKey = `${weekIndex}-${dayIndex}-${taskIndex}`;
                      const editing = editingTask === editKey;
                      return (
                        <div className={`sp-task${checked ? ' is-done' : ''}`} key={`${task.topic}-${taskIndex}`}>
                          {editing ? (
                            <div className="sp-task-editor">
                              <label>Topic<input value={taskDraft.topic} onChange={(event) => setTaskDraft((current) => ({ ...current, topic: event.target.value }))} /></label>
                              <label>Subject<input value={taskDraft.section} onChange={(event) => setTaskDraft((current) => ({ ...current, section: event.target.value }))} /></label>
                              <label>Activity<input value={taskDraft.activity} onChange={(event) => setTaskDraft((current) => ({ ...current, activity: event.target.value }))} /></label>
                              <label>Hours<input type="number" min="0.25" max="24" step="0.25" value={taskDraft.studyHours} onChange={(event) => setTaskDraft((current) => ({ ...current, studyHours: event.target.value }))} /></label>
                              <div className="sp-task-edit-actions">
                                <button type="button" onClick={() => setEditingTask(null)}>Cancel</button>
                                <button type="button" className="save" onClick={() => { saveTaskEdit(weekIndex, dayIndex, taskIndex, taskDraft); setEditingTask(null); }}>Save</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div><strong>{task.topic}</strong><small>{task.section} · {task.activity}</small></div>
                              <span className="sp-task-hours"><FiClock /> {task.studyHours}h</span>
                              <div className="sp-task-actions">
                                <button type="button" className="sp-task-edit" aria-label={`Edit ${task.topic}`} onClick={() => {
                                  setEditingTask(editKey);
                                  setTaskDraft({ section: task.section || '', topic: task.topic || '', activity: task.activity || '', studyHours: task.studyHours || 1 });
                                }}><FiEdit3 /></button>
                                <button type="button" className="sp-task-delete" aria-label={`Delete ${task.topic}`} onClick={() => setPendingDelete({ type: 'task', weekNumber: weekIndex, dayNumber: dayIndex, taskNumber: taskIndex, topic: task.topic })}><FiTrash2 /></button>
                                <button type="button" className="sp-task-check" aria-pressed={checked} aria-label={`Mark ${task.topic} ${checked ? 'not done' : 'done'}`} onClick={() => toggleTask(id)}>{checked && <FiCheck />}</button>
                              </div>
                              {pendingDelete?.type === 'task' && pendingDelete.weekNumber === weekIndex && pendingDelete.dayNumber === dayIndex && pendingDelete.taskNumber === taskIndex && (
                                <DeleteConfirmation
                                  message={`Remove "${pendingDelete.topic}" from this timetable?`}
                                  onCancel={() => setPendingDelete(null)}
                                  onConfirm={confirmPendingDelete}
                                />
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}</div>
                  </article>
                ))}
                {!currentWeek?.days?.length && <p className="sp-empty-syllabus">No schedule days were returned. Try generating the plan again.</p>}
              </div>
            </section>

            <aside className="sp-side-column">
              <section className="sp-section sp-progress-section">
                <h2>Syllabus progress</h2>
                <div className="sp-progress-overview">
                  <div className="sp-progress-ring" style={{ '--pct': `${progress * 3.6}deg` }}><div><strong>{progress}%</strong><span>completed</span></div></div>
                  <p>{doneTasks} of {totalTasks} study sessions done. Tick sessions in the timetable to track your progress.</p>
                </div>
                <div className="sp-progress-list">{sections.map((section, index) => {
                  const stats = sectionTaskStats[section.name] || { total: 0, completed: 0 };
                  return <div className="sp-progress-item" key={`${section.name}-${index}`}><span>{section.name}</span><strong>{stats.completed}/{stats.total} sessions</strong></div>;
                })}</div>
              </section>

              <section className="sp-section sp-video-section">
                <div className="sp-video-heading">
                  <h2>Recommended videos</h2>
                  <div className="sp-video-heading-actions">
                    {videos.length > 4 && <button type="button" className="sp-more-videos-button secondary" onClick={() => setShowAllVideos((value) => !value)}>{showAllVideos ? 'Show fewer' : `Show more (${videos.length - 4})`}</button>}
                    <button type="button" className="sp-more-videos-button" onClick={handleFindMoreVideos} disabled={findingMoreVideos || generating}>
                      {findingMoreVideos ? <><FiRefreshCw className="sp-spin" /> Finding…</> : <><FiPlus /> Find more</>}
                    </button>
                  </div>
                </div>
                {videoError && <p className="sp-video-error" role="status">{videoError}</p>}
                {videos.length ? visibleVideos.map((video, index) => {
                  const embedUrl = youtubeEmbedUrl(video.youtubeUrl);
                  return (
                    <article className="sp-video-row" key={`${video.youtubeUrl}-${index}`}>
                      {embedUrl ? <div className="sp-video-player-wrap"><iframe className="sp-video-player" src={embedUrl} title={video.title || video.topic || 'Recommended YouTube lesson'} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <a className="sp-video-thumb" href={video.youtubeUrl} target="_blank" rel="noreferrer" aria-label={`Open ${video.title || 'video'} on YouTube`}><FiPlayCircle /></a>}
                      <div className="sp-video-info"><a href={video.youtubeUrl} target="_blank" rel="noreferrer">{video.title || video.topic || 'Recommended lesson'} <FiExternalLink /></a><span>{video.channel || 'YouTube'}{video.duration ? ` · ${video.duration}` : ''}</span><small>{video.topic}</small></div>
                      <button type="button" className="sp-transcript-link" onClick={() => openTranscript(video)}><FiFileText /> Use transcript</button>
                    </article>
                  );
                }) : <p className="sp-video-empty">No verified YouTube lessons were found for these topics. Use Find more to search again.</p>}
              </section>
            </aside>
          </div>
        )}

        <footer className="sp-footer-note"><FiCalendar /> Syllabus and video suggestions are AI-assisted. Open the cited sources to confirm exam-specific details.</footer>
      </div>
    </main>
  );
}
