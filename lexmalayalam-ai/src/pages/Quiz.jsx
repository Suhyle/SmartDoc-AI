import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiBarChart2,
  FiBook,
  FiBookOpen,
  FiCalendar,
  FiCamera,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiEdit3,
  FiHome,
  FiList,
  FiRefreshCw,
  FiX,
  FiZap,
} from 'react-icons/fi';
import './Quiz.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:5000' : '');

// Home.jsx reads this key for Recent Quiz Results, streaks and achievements.
const RESULTS_KEY = 'smartdoc-quiz:results';

const TEST_TYPES = [
  { id: 'weekly', label: 'Weekly', icon: <FiCalendar /> },
  { id: 'monthly', label: 'Monthly', icon: <FiCalendar /> },
  { id: 'chapter', label: 'Chapter-wise', icon: <FiBookOpen /> },
  { id: 'topic', label: 'Topic-wise', icon: <FiList /> },
];

const FORMATS = [
  {
    id: 'mcq',
    label: 'Multiple Choice',
    description: 'Choose one answer from four options',
    icon: <FiCheckCircle />,
  },
  {
    id: 'written',
    label: 'Written answer',
    description: 'Write on paper, upload a photo',
    icon: <FiEdit3 />,
  },
  {
    id: 'mixed',
    label: 'Mixed format',
    description: 'Combine MCQ and written questions',
    icon: <FiBook />,
    recommended: true,
  },
];

const Q_COUNTS = [5, 10, 15, 20, 30, 50];
const TIME_LIMITS = [
  { label: '15 minutes', value: 15 },
  { label: '20 minutes', value: 20 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '60 minutes', value: 60 },
  { label: 'No limit', value: 0 },
];
const DIFFICULTY_OPTS = ['Mixed difficulty', 'Easy', 'Medium', 'Hard'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const safeJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

/**
 * Saves a finished quiz so the Home dashboard can show Recent Quiz Results,
 * the Quiz Master / Consistency achievements, etc. Only MCQ questions are
 * counted (written answers are graded later by AI). Keeps the last 50.
 */
const saveQuizResult = (config, questions, answers) => {
  try {
    const mcq = (questions || []).filter((q) => q.type === 'mcq');
    if (!mcq.length || !config) return;
    const score = mcq.filter((q) => answers[q.id] === q.answer).length;
    const exam = config.exams?.[0];
    const weeklyLabel = Number.isFinite(Number(config.scope)) && config.scope !== ''
      ? `Week ${Number(config.scope) + 1}`
      : 'Weekly test';
    const topic = config.testType === 'weekly'
      ? weeklyLabel
      : config.testType === 'monthly'
        ? 'Monthly test'
        : config.scope || 'Mock test';
    const saved = safeJson(RESULTS_KEY);
    const list = Array.isArray(saved) ? saved : [];
    list.push({
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      exam: exam?.category || exam?.exam_name || 'Exam',
      examName: exam?.exam_name || '',
      topic,
      testType: config.testType,
      date: new Date().toISOString(),
      score,
      total: mcq.length,
    });
    localStorage.setItem(RESULTS_KEY, JSON.stringify(list.slice(-50)));
  } catch (error) {
    console.error('Could not save quiz result', error);
  }
};

const getStudyVideoUrl = (video) => String(video?.youtubeUrl || video?.videoUrl || video?.url || '').trim();

const getYoutubeVideoId = (value) => {
  try {
    const url = new URL(String(value || '').trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      return url.searchParams.get('v')
        || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]
        || '';
    }
  } catch {
    return '';
  }
  return '';
};

const getTranscriptLanguage = (result) => {
  const language = String(
    result?.sourceLanguage
      || result?.transcriptData?.language
      || result?.language
      || result?.transcriptData?.languageCode
      || ''
  ).trim();
  if (!language) return 'Unknown';
  if (/^(?:ml|malayalam)/i.test(language)) return 'Malayalam';
  if (/^(?:en|english)/i.test(language)) return 'English';
  return language;
};

/**
 * POST /api/quiz/generate
 * Expected body: { exams, testType, scope, questionCount, difficulty, format, syllabusSections, transcripts }
 * Expected response: { success: true, questions: [...], provider, sourcesUsed }
 * Each question: { id, type: 'mcq'|'written', text, options?: string[], answer?: string, explanation?: string, topic, chapter }
 */
const generateQuestions = async (payload) => {
  if (!API_BASE_URL) throw new Error('Quiz service is not configured. Start the SmartDoc AI backend.');
  const response = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    throw new Error(data.details || data.error || 'Could not generate questions. Please try again.');
  }
  return data;
};

/**
 * POST /api/quiz/grade-written
 * Expected body: { question, answerText, imageBase64? }
 * Expected response: { success: true, score, feedback, rubric }
 */
const gradeWritten = async (question, answerText, imageBase64) => {
  if (!API_BASE_URL) throw new Error('Quiz service not configured.');
  const response = await fetch(`${API_BASE_URL}/api/quiz/grade-written`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answerText, imageBase64 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.details || data.error || 'Grading failed.');
  return data; // { score, feedback, rubric }
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExamChip({ exam, onRemove }) {
  return (
    <div className="qz-exam-chip">
      <span className="qz-exam-chip-label">{exam.category || 'Exam'} · {exam.exam_name}</span>
      {onRemove && (
        <button type="button" className="qz-exam-chip-remove" aria-label={`Remove ${exam.exam_name}`} onClick={onRemove}>
          <FiX />
        </button>
      )}
    </div>
  );
}

function ProgressBar({ current, total }) {
  const pct = total ? Math.round((current / total) * 100) : 0;
  return (
    <div className="qz-progress-bar-wrap">
      <div className="qz-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span>{current} / {total}</span>
    </div>
  );
}

function QuizResultsHistory({ results, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ exam: '', topic: '' });

  if (!results.length) return null;

  const beginEdit = (result, index) => {
    const id = result.id || `${result.date}-${index}`;
    setEditingId(id);
    setDraft({ exam: result.exam || '', topic: result.topic || '' });
  };

  return (
    <section className="qz-card qz-history-card">
      <div className="qz-card-heading">
        <strong>Saved quiz results</strong>
        <span>{results.length} attempt{results.length === 1 ? '' : 's'}</span>
      </div>
      <div className="qz-history-list">
        {results.map((result, index) => {
          const id = result.id || `${result.date}-${index}`;
          const editing = editingId === id;
          return (
            <article className="qz-history-row" key={id}>
              {editing ? (
                <div className="qz-history-edit">
                  <label>Exam label<input value={draft.exam} onChange={(event) => setDraft((value) => ({ ...value, exam: event.target.value }))} /></label>
                  <label>Test/topic label<input value={draft.topic} onChange={(event) => setDraft((value) => ({ ...value, topic: event.target.value }))} /></label>
                  <div className="qz-history-actions">
                    <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    <button type="button" className="primary" onClick={() => { onUpdate(index, { exam: draft.exam.trim(), topic: draft.topic.trim() }); setEditingId(null); }}>Save labels</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="qz-history-details">
                    <strong>{result.exam || result.examName || 'Exam'} — {result.topic || 'Quiz'}</strong>
                    <small>{result.date ? new Date(result.date).toLocaleString() : 'Date not recorded'} · Score {result.score}/{result.total}</small>
                  </div>
                  <div className="qz-history-actions">
                    <button type="button" aria-label="Edit quiz result labels" onClick={() => beginEdit(result, index)}><FiEdit3 /> Edit</button>
                    <button type="button" className="danger" aria-label="Delete saved quiz result" onClick={() => onDelete(index)}><FiX /> Delete</button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
      <p className="qz-history-note">Score and answers stay as recorded; you can edit the labels or remove an attempt from this device.</p>
    </section>
  );
}

// ─── Setup screen ─────────────────────────────────────────────────────────────

function SetupScreen({ initialExams, studyPlan, transcripts, onStart }) {
  const navigate = useNavigate();
  const [exams, setExams] = useState(initialExams || []);
  const [examPickerOpen, setExamPickerOpen] = useState(false);
  const [pendingExams, setPendingExams] = useState(initialExams || []);
  const [availableExams, setAvailableExams] = useState([]);
  const [examSearch, setExamSearch] = useState('');
  const [loadingExams, setLoadingExams] = useState(false);
  const [examLoadError, setExamLoadError] = useState('');
  const [testType, setTestType] = useState('weekly');
  const [scope, setScope] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(30);
  const [difficulty, setDifficulty] = useState('Mixed difficulty');
  const [format, setFormat] = useState('mcq');
  const [transcriptLanguage, setTranscriptLanguage] = useState('English');
  const [quizLanguage, setQuizLanguage] = useState('English');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [selectedVideoUrls, setSelectedVideoUrls] = useState(() => {
    const savedCustomVideos = safeJson('smartdoc-quiz:custom-videos');
    return new Set([
      ...(transcripts || []).map((item) => item.videoUrl || item.url),
      ...(Array.isArray(savedCustomVideos) ? savedCustomVideos.map(getStudyVideoUrl) : []),
    ].filter(Boolean));
  });
  const [extraVideos, setExtraVideos] = useState(() => {
    const saved = safeJson('smartdoc-quiz:custom-videos');
    return Array.isArray(saved) ? saved : [];
  });
  const [excludedSuggestedUrls, setExcludedSuggestedUrls] = useState(() => {
    const saved = safeJson('smartdoc-quiz:removed-suggested-videos');
    return new Set(Array.isArray(saved) ? saved : []);
  });
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [customVideoError, setCustomVideoError] = useState('');
  const [transcriptStatuses, setTranscriptStatuses] = useState(() => Object.fromEntries(
    (transcripts || [])
      .filter((item) => String(item.transcript || item.text || '').trim())
      .map((item) => [
        item.videoUrl || item.url,
        { status: 'available', language: getTranscriptLanguage(item) },
      ])
  ));
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);

  const weeks = Array.isArray(studyPlan?.weeks) ? studyPlan.weeks : [];
  const sections = Array.isArray(studyPlan?.sections) ? studyPlan.sections : [];
  const topics = sections.flatMap((s) => s.topics || []);
  const suggestedVideos = Array.isArray(studyPlan?.videos) ? studyPlan.videos : [];
  const videos = [
    ...suggestedVideos.filter((video) => !excludedSuggestedUrls.has(getStudyVideoUrl(video))),
    ...extraVideos,
  ];
  const selectedVideos = videos.filter((video) => getStudyVideoUrl(video) && selectedVideoUrls.has(getStudyVideoUrl(video)));
  const sourceCount = selectedVideos.length;
  const canCreate = exams.length > 0 && (sourceCount > 0 || topics.length > 0);

  useEffect(() => {
    setExams(initialExams || []);
    setPendingExams(initialExams || []);
  }, [initialExams]);
  useEffect(() => {
    const cachedUrls = new Set((transcripts || []).map((item) => item.videoUrl || item.url).filter(Boolean));
    if (cachedUrls.size) {
      setSelectedVideoUrls((current) => new Set([...current, ...cachedUrls]));
      setTranscriptStatuses((current) => ({
        ...current,
        ...Object.fromEntries(
          (transcripts || [])
            .filter((item) => String(item.transcript || item.text || '').trim())
            .map((item) => [
              item.videoUrl || item.url,
              { status: 'available', language: getTranscriptLanguage(item) },
            ])
        ),
      }));
    }
  }, [transcripts]);

  const scopeOptions = () => {
    if (testType === 'weekly') return weeks.map((w, i) => ({ label: `Week ${i + 1}${w.focus ? ` · ${w.focus}` : ''}`, value: String(i) }));
    if (testType === 'monthly') return [{ label: 'This month', value: 'month' }];
    if (testType === 'chapter') return sections.map((s) => ({ label: s.name, value: s.name }));
    if (testType === 'topic') return topics.map((t) => ({ label: t, value: t }));
    return [];
  };

  const opts = scopeOptions();
  useEffect(() => { setScope(opts[0]?.value || ''); }, [testType]);

  const testLabel = () => {
    const t = TEST_TYPES.find((x) => x.id === testType);
    return t ? t.label : '';
  };

  const openExamPicker = async () => {
    setPendingExams(exams);
    setExamPickerOpen(true);
    setExamLoadError('');
    if (availableExams.length) return;
    setLoadingExams(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('exam_notifications')
        .select('id, category, exam_name, notification_title, organization, description, qualification, degree, stream, application_last_date, official_notification_url, official_website_url')
        .eq('is_active', true)
        .order('exam_name', { ascending: true })
        .limit(500);
      if (fetchError) throw fetchError;
      setAvailableExams(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      console.error('Could not load available exams for Quiz:', fetchError);
      setExamLoadError('Could not load available exams. Please try again.');
    } finally {
      setLoadingExams(false);
    }
  };

  const addCustomVideo = () => {
    const url = customVideoUrl.trim();
    const videoId = getYoutubeVideoId(url);
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      setCustomVideoError('Enter a valid YouTube video link.');
      return;
    }
    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    if (videos.some((video) => getYoutubeVideoId(getStudyVideoUrl(video)) === videoId)) {
      setCustomVideoError('That video is already in your study sources.');
      return;
    }
    const video = { title: 'Added YouTube video', topic: 'Custom video', youtubeUrl: canonicalUrl, custom: true };
    const nextVideos = [...extraVideos, video];
    setExtraVideos(nextVideos);
    localStorage.setItem('smartdoc-quiz:custom-videos', JSON.stringify(nextVideos));
    setSelectedVideoUrls((current) => new Set([...current, canonicalUrl]));
    setCustomVideoUrl('');
    setCustomVideoError('');
  };

  const removeVideoFromQuiz = (video) => {
    const videoUrl = getStudyVideoUrl(video);
    setSelectedVideoUrls((current) => {
      const next = new Set(current);
      next.delete(videoUrl);
      return next;
    });
    if (video.custom) {
      const nextVideos = extraVideos.filter((item) => getStudyVideoUrl(item) !== videoUrl);
      setExtraVideos(nextVideos);
      localStorage.setItem('smartdoc-quiz:custom-videos', JSON.stringify(nextVideos));
      setTranscriptStatuses((current) => {
        const next = { ...current };
        delete next[videoUrl];
        return next;
      });
    } else {
      const nextExcluded = new Set([...excludedSuggestedUrls, videoUrl]);
      setExcludedSuggestedUrls(nextExcluded);
      localStorage.setItem('smartdoc-quiz:removed-suggested-videos', JSON.stringify([...nextExcluded]));
    }
  };

  const getScopeSections = () => {
    if (testType === 'chapter') return sections.filter((section) => section.name === scope);
    if (testType === 'topic') return sections.map((section) => ({ ...section, topics: (section.topics || []).filter((topic) => topic === scope) })).filter((section) => section.topics.length);
    if (testType === 'weekly') {
      const week = weeks[Number(scope)];
      const tasks = (week?.days || []).flatMap((day) => day.tasks || []);
      if (tasks.length) {
        const weekTopics = new Set(tasks.map((task) => task.topic).filter(Boolean));
        const weekSections = new Set(tasks.map((task) => task.section).filter(Boolean));
        const filtered = sections.map((section) => ({
          ...section,
          topics: (section.topics || []).filter((topic) => weekTopics.has(topic)),
        })).filter((section) => section.topics.length || weekSections.has(section.name));
        if (filtered.length) return filtered;
      }
    }
    return sections;
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    setError('');
    setLoadingTranscripts(true);
    try {
      if (selectedVideos.length && !API_BASE_URL) {
        throw new Error('Start the SmartDoc AI backend to retrieve video transcripts.');
      }
      const transcriptResults = await Promise.all(selectedVideos.map(async (video) => {
        const videoUrl = getStudyVideoUrl(video);
        setTranscriptStatuses((current) => ({
          ...current,
          [videoUrl]: { status: 'loading', language: '' },
        }));
        try {
          const response = await fetch(`${API_BASE_URL}/api/transcript`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoUrl,
              language: transcriptLanguage,
              transcriptMode: 'full',
              startTime: '00:00:00',
              endTime: '00:00:00',
              durationLimit: 0,
              durationUnit: 'minutes',
              additionalOptions: {
                includeTimestamps: true,
                mergeCloseCaptions: true,
                removeFillerWords: false,
                detectChapters: true,
              },
            }),
          });
          const result = await response.json().catch(() => ({}));
          const transcript = String(result.transcript || '').trim();
          if (!response.ok || !result.success || !transcript) {
            const reason = result.message || result.error || result.details || `Transcript service returned HTTP ${response.status}.`;
            const status = { status: 'missing', language: '', error: reason };
            setTranscriptStatuses((current) => ({
              ...current,
              [videoUrl]: status,
            }));
            return { transcript: null, status };
          }
          const sourceLanguage = getTranscriptLanguage(result);
          const transcriptRecord = {
            title: result.title || video.title || 'Study video',
            topic: video.topic || '',
            videoUrl,
            transcript,
            sourceLanguage,
          };
          const status = { status: 'available', language: sourceLanguage };
          setTranscriptStatuses((current) => ({
            ...current,
            [videoUrl]: status,
          }));
          return { transcript: transcriptRecord, status };
        } catch (fetchError) {
          const status = { status: 'missing', language: '', error: fetchError.message };
          setTranscriptStatuses((current) => ({
            ...current,
            [videoUrl]: status,
          }));
          return { transcript: null, status };
        }
      }));
      const selectedTranscripts = transcriptResults
        .map((result) => result.transcript)
        .filter(Boolean);
      const transcriptStatusUpdates = Object.fromEntries(
        selectedVideos.map((video, index) => [getStudyVideoUrl(video), transcriptResults[index].status])
      );
      const updatedCache = [
        ...(Array.isArray(transcripts) ? transcripts : []).filter((item) => !selectedTranscripts.some((selected) => selected.videoUrl === getStudyVideoUrl(item))),
        ...selectedTranscripts,
      ].slice(-10).map((item) => ({ ...item, transcript: String(item.transcript || item.text || '').slice(0, 80000) }));
      localStorage.setItem('smartdoc-quiz:transcripts', JSON.stringify(updatedCache));
      if (!selectedTranscripts.length && !topics.length) {
        throw new Error('No transcript was found for the selected videos, and your study plan has no syllabus topics to use.');
      }
      setLoadingTranscripts(false);
      const generation = await generateQuestions({
        exams,
        testType,
        scope,
        questionCount,
        difficulty,
        format,
        language: quizLanguage,
        syllabusSections: getScopeSections(),
        transcripts: selectedTranscripts,
      });
      onStart({
        exams,
        testType,
        scope,
        questionCount,
        timeLimit,
        difficulty,
        format,
        language: quizLanguage,
        transcriptLanguage,
        transcriptStatuses: Object.fromEntries(
          [...selectedVideoUrls].map((videoUrl) => [
            videoUrl,
            transcriptStatusUpdates[videoUrl] || transcriptStatuses[videoUrl] || { status: 'not-fetched', language: '' },
          ])
        ),
        transcriptTopics: selectedTranscripts.map((t) => t.topic || t.title),
        ...generation,
      });
    } catch (err) {
      setError(err.message || 'Could not create the test. Please try again.');
    } finally {
      setLoadingTranscripts(false);
      setCreating(false);
    }
  };

  return (
    <div className="qz-setup">
      <nav className="qz-breadcrumb">
        <button type="button" className="qz-back-link" onClick={() => navigate('/home')}>
          <FiHome /> Home
        </button>
        <button type="button" className="qz-back-link" onClick={() => navigate('/study-plan')}>
          <FiArrowLeft /> Study Plan
        </button>
      </nav>

      <header className="qz-hero">
        <div className="qz-hero-icon"><FiBarChart2 /></div>
        <div className="qz-hero-text">
          <h1>Mock Tests</h1>
          <p>Practice what you studied this week.</p>
        </div>
        <div className="qz-status-tag"><FiCalendar /> Built from your Study Plan</div>
      </header>

      {error && <div className="qz-alert" role="alert"><FiAlertCircle /><span>{error}</span></div>}

      <section className="qz-card qz-exams-card">
        <div className="qz-card-heading">
          <strong>Selected exams</strong>
          <button type="button" className="qz-edit-exams" onClick={openExamPicker}>
            <FiEdit3 /> Add or remove exams
          </button>
        </div>
        {exams.length ? (
          <div className="qz-exam-chips">
            {exams.map((exam) => (
              <ExamChip
                key={exam.id ?? exam.exam_name}
                exam={exam}
                onRemove={() => setExams((current) => {
                  const next = current.filter((item) => item.id !== exam.id);
                  localStorage.setItem('smartdoc-quiz:exams', JSON.stringify(next));
                  return next;
                })}
              />
            ))}
          </div>
        ) : (
          <p className="qz-no-exams">No exams selected. Go to Notifications to choose exams for this test.</p>
        )}
        {examPickerOpen && (
          <div className="qz-exam-picker">
            <div className="qz-exam-picker-heading">
              <strong>Add or remove exams for this quiz</strong>
              <button type="button" className="qz-exam-picker-close" onClick={() => setExamPickerOpen(false)} aria-label="Cancel exam changes"><FiX /></button>
            </div>
            <p className="qz-sources-sub">Select the exams to include. Uncheck an exam to remove it; changes are saved for this quiz.</p>
            <input
              className="qz-exam-search"
              type="search"
              value={examSearch}
              onChange={(event) => setExamSearch(event.target.value)}
              placeholder="Search available exams"
              aria-label="Search available exams"
            />
            {loadingExams && <p className="qz-sources-sub">Loading active exams…</p>}
            {examLoadError && <div className="qz-alert" role="alert"><FiAlertCircle /><span>{examLoadError}</span></div>}
            {!loadingExams && !examLoadError && (
              <div className="qz-exam-options">
                {availableExams
                  .filter((exam) => `${exam.exam_name} ${exam.category} ${exam.organization}`.toLowerCase().includes(examSearch.trim().toLowerCase()))
                  .map((exam) => {
                    const checked = pendingExams.some((selected) => selected.id === exam.id);
                    return (
                      <label className={`qz-exam-option${!checked && pendingExams.length >= 6 ? ' disabled' : ''}`} key={exam.id}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && pendingExams.length >= 6}
                          onChange={() => setPendingExams((current) => checked
                            ? current.filter((selected) => selected.id !== exam.id)
                            : [...current, exam])}
                        />
                        <span><strong>{exam.exam_name}</strong><small>{exam.category || exam.organization || 'Exam'}</small></span>
                      </label>
                    );
                  })}
                {!availableExams.length && <p className="qz-sources-sub">No active exam notifications were found.</p>}
              </div>
            )}
            <div className="qz-exam-picker-actions">
              <button type="button" className="qz-modal-cancel" onClick={() => setExamPickerOpen(false)}>Cancel</button>
              <button
                type="button"
                className="qz-modal-submit"
                disabled={!pendingExams.length}
                onClick={() => {
                  setExams(pendingExams);
                  localStorage.setItem('smartdoc-quiz:exams', JSON.stringify(pendingExams));
                  setExamPickerOpen(false);
                }}
              >
                Save {pendingExams.length} exam{pendingExams.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="qz-card">
        <strong className="qz-card-label">Choose your test</strong>
        <div className="qz-type-tabs" role="tablist">
          {TEST_TYPES.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={testType === t.id}
              className={`qz-type-tab${testType === t.id ? ' active' : ''}`}
              onClick={() => setTestType(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="qz-selectors">
          <label className="qz-field">
            {testType === 'weekly' ? 'Select week' : testType === 'monthly' ? 'Select month' : testType === 'chapter' ? 'Select chapter' : 'Select topic'}
            <select value={scope} onChange={(e) => setScope(e.target.value)} disabled={!opts.length}>
              {opts.length ? opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>) : <option value="">No options — generate a study plan first</option>}
            </select>
          </label>
          <label className="qz-field">
            Number of questions
            <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))}>
              {Q_COUNTS.map((n) => <option key={n} value={n}>{n} questions</option>)}
            </select>
          </label>
          <label className="qz-field">
            Time limit
            <select value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))}>
              {TIME_LIMITS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="qz-field">
            Difficulty level
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              {DIFFICULTY_OPTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
        </div>

        <div className="qz-format-label">Test format</div>
        <div className="qz-formats">
          {FORMATS.map((f) => (
            <label key={f.id} className={`qz-format-card${format === f.id ? ' selected' : ''}`}>
              <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} />
              <span className="qz-format-radio" aria-hidden="true" />
              <span className="qz-format-icon">{f.icon}</span>
              <span className="qz-format-body">
                <strong>{f.label}{f.recommended && <span className="qz-recommended">Recommended</span>}</strong>
                <span>{f.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="qz-language-settings">
          <strong className="qz-format-label">Language settings</strong>
          <div className="qz-language-fields">
            <label className="qz-field">
              Transcript language to request
              <select value={transcriptLanguage} onChange={(event) => setTranscriptLanguage(event.target.value)}>
                <option value="English">English</option>
                <option value="Malayalam">Malayalam</option>
              </select>
            </label>
            <label className="qz-field">
              Quiz language
              <select value={quizLanguage} onChange={(event) => setQuizLanguage(event.target.value)}>
                <option value="English">English</option>
                <option value="Malayalam">Malayalam</option>
              </select>
            </label>
          </div>
          <p className="qz-language-help">The transcript language is requested from YouTube captions. If that caption language is unavailable, the transcript service may return its available fallback language, shown below.</p>
        </div>
      </section>

      <section className={`qz-card qz-sources-card${sourceCount > 0 ? ' has-sources' : ''}`}>
        <div className="qz-sources-icon">{sourceCount > 0 ? <FiCheckCircle /> : <FiAlertCircle />}</div>
        <div className="qz-sources-body">
          <strong>Your study sources</strong>
          {videos.length > 0 && (
            <>
              <p className="qz-sources-sub">Select timetable videos you studied, remove suggestions you do not want, or add another YouTube link. Selected transcripts are fetched when you create the quiz.</p>
              <div className="qz-video-source-list">
                {videos.map((video, index) => (
                  <div className="qz-video-source" key={`${getStudyVideoUrl(video)}-${index}`}>
                    <label className="qz-video-source-select">
                      <input type="checkbox" checked={selectedVideoUrls.has(getStudyVideoUrl(video))} onChange={(event) => setSelectedVideoUrls((current) => {
                        const next = new Set(current);
                        const videoUrl = getStudyVideoUrl(video);
                        if (event.target.checked) next.add(videoUrl); else next.delete(videoUrl);
                        return next;
                      })} />
                      <span>
                        <strong>{video.title || video.topic || `Study video ${index + 1}`}</strong>
                        {video.topic && <small>{video.topic}</small>}
                        <small className={`qz-transcript-status ${transcriptStatuses[getStudyVideoUrl(video)]?.status || 'not-fetched'}`}>
                          {transcriptStatuses[getStudyVideoUrl(video)]?.status === 'loading'
                            ? 'Fetching transcript…'
                            : transcriptStatuses[getStudyVideoUrl(video)]?.status === 'available'
                              ? `Transcript found · ${transcriptStatuses[getStudyVideoUrl(video)]?.language || 'language unknown'}`
                              : transcriptStatuses[getStudyVideoUrl(video)]?.status === 'missing'
                                ? 'No transcript found'
                                : 'Transcript not checked yet'}
                        </small>
                      </span>
                    </label>
                    <button
                      type="button"
                      className="qz-video-remove"
                      aria-label={`Remove ${video.title || video.topic || 'video'} from this quiz`}
                      onClick={() => removeVideoFromQuiz(video)}
                    >
                      <FiX />
                    </button>
                  </div>
                ))}
              </div>
              {sourceCount > 0 && <p className="qz-sources-count"><strong>{sourceCount}</strong> video{sourceCount !== 1 ? 's' : ''} selected</p>}
            </>
          )}
          <div className="qz-add-video">
            <label className="qz-field" htmlFor="qz-custom-youtube-url">Add another YouTube video link</label>
            <div className="qz-add-video-row">
              <input
                id="qz-custom-youtube-url"
                type="url"
                value={customVideoUrl}
                onChange={(event) => { setCustomVideoUrl(event.target.value); setCustomVideoError(''); }}
                placeholder="https://www.youtube.com/watch?v=..."
                aria-describedby={customVideoError ? 'qz-custom-video-error' : undefined}
              />
              <button type="button" className="qz-add-video-button" onClick={addCustomVideo}>Add link</button>
            </div>
            {customVideoError && <p className="qz-video-error" id="qz-custom-video-error" role="alert">{customVideoError}</p>}
          </div>
          {sourceCount === 0 && topics.length > 0 ? (
            <>
              <p className="qz-sources-count"><strong>{topics.length}</strong> syllabus topics from your study plan</p>
              <p className="qz-sources-sub">Questions will be based on syllabus topics only. Select videos above to include their transcripts too.</p>
            </>
          ) : sourceCount === 0 && !videos.length ? (
            <p className="qz-sources-sub">No study sources found. Generate a study plan with syllabus sections or recommended videos to build a test.</p>
          ) : null}
        </div>
        {sourceCount > 0 && (
          <div className="qz-sources-progress">
            <span>{sourceCount} video{sourceCount !== 1 ? 's' : ''} selected</span>
          </div>
        )}
      </section>

      <div className="qz-create-row">
        <button
          type="button"
          className="qz-create-button"
          disabled={!canCreate || creating}
          onClick={handleCreate}
        >
          {creating ? <><FiRefreshCw className="qz-spin" /> {loadingTranscripts ? 'Getting transcripts…' : 'Creating test…'}</> : <><FiZap /> Create {testLabel()} Mock Test</>}
        </button>
        <p className="qz-create-note"><FiAlertCircle /> Questions are based on your selected exam syllabus and saved video transcripts.</p>
      </div>
    </div>
  );
}

// ─── Test screen ──────────────────────────────────────────────────────────────

function TestScreen({ config, onSubmit, onAbort }) {
  const { questions, timeLimit, exams } = config;
  const transcriptStatuses = Object.values(config.transcriptStatuses || {});
  const transcriptCount = transcriptStatuses.filter((status) => status.status === 'available').length;
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState({});           // { qId: string | null }
  const [images, setImages] = useState({});             // { qId: { dataUrl, name } }
  const [secondsLeft, setSecondsLeft] = useState(timeLimit > 0 ? timeLimit * 60 : null);
  const [confirming, setConfirming] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) { onSubmit(questions, answers, images); return; }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  const current = questions[qIndex];
  const answered = Object.keys(answers).filter((k) => answers[k] !== null && answers[k] !== '').length;

  const setAnswer = (id, value) => setAnswers((a) => ({ ...a, [id]: value }));

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImages((imgs) => ({ ...imgs, [current.id]: { dataUrl: reader.result, name: file.name } }));
    reader.readAsDataURL(file);
  };

  const removeImage = () => setImages((imgs) => { const n = { ...imgs }; delete n[current.id]; return n; });

  const examNames = exams.map((e) => e.exam_name).join(', ');

  return (
    <div className="qz-test">
      <header className="qz-test-header">
        <div className="qz-test-meta">
          <button type="button" className="qz-abort-btn" onClick={() => setConfirming(true)}><FiX /> End test</button>
          <span className="qz-test-title">{examNames}</span>
        </div>
        <div className="qz-test-status">
          <span className="qz-test-progress">Question {qIndex + 1} of {questions.length}</span>
          <span className="qz-test-language">Quiz: {config.language || 'English'} · Transcripts: {transcriptCount} found</span>
          {secondsLeft !== null && (
            <span className={`qz-timer${secondsLeft < 120 ? ' qz-timer-warn' : ''}`}><FiClock /> {fmtTime(secondsLeft)}</span>
          )}
        </div>
        <ProgressBar current={answered} total={questions.length} />
      </header>

      <div className="qz-test-body">
        <aside className="qz-question-nav">
          <p className="qz-nav-label">Questions</p>
          <div className="qz-nav-grid">
            {questions.map((q, i) => {
              const ans = answers[q.id];
              const done = ans !== undefined && ans !== null && ans !== '';
              return (
                <button
                  key={q.id}
                  type="button"
                  className={`qz-nav-dot${i === qIndex ? ' current' : ''}${done ? ' done' : ''}`}
                  aria-label={`Go to question ${i + 1}${done ? ', answered' : ''}`}
                  onClick={() => setQIndex(i)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="qz-nav-legend">
            <span className="qz-leg done" />Answered
            <span className="qz-leg" />Unanswered
          </div>
        </aside>

        <article className="qz-question-card">
          <div className="qz-q-meta">
            <span className="qz-q-topic">{current.topic || current.chapter || ''}</span>
            <span className="qz-q-type">{current.type === 'written' ? 'Written answer' : 'Multiple choice'}</span>
          </div>
          <h2 className="qz-q-text">{current.text}</h2>

          {current.type === 'mcq' && (
            <div className="qz-options">
              {(current.options || []).map((opt, oi) => (
                <label key={oi} className={`qz-option${answers[current.id] === opt ? ' selected' : ''}`}>
                  <input type="radio" name={`q-${current.id}`} value={opt} checked={answers[current.id] === opt} onChange={() => setAnswer(current.id, opt)} />
                  <span className="qz-option-letter">{String.fromCharCode(65 + oi)}</span>
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          )}

          {current.type === 'written' && (
            <div className="qz-written">
              <textarea
                className="qz-written-area"
                rows="6"
                placeholder="Type your answer here, or upload a photo of handwritten work below."
                value={answers[current.id] || ''}
                onChange={(e) => setAnswer(current.id, e.target.value)}
              />
              <div className="qz-photo-row">
                {images[current.id] ? (
                  <div className="qz-photo-preview">
                    <img src={images[current.id].dataUrl} alt="Handwritten answer" />
                    <button type="button" className="qz-photo-remove" onClick={removeImage}><FiX /> Remove photo</button>
                  </div>
                ) : (
                  <button type="button" className="qz-photo-upload-btn" onClick={() => fileRef.current?.click()}>
                    <FiCamera /> Upload handwritten answer
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="qz-hidden-file" onChange={handleImage} />
              </div>
            </div>
          )}

          <div className="qz-q-controls">
            <button type="button" className="qz-q-nav-btn" disabled={qIndex === 0} onClick={() => setQIndex((i) => i - 1)}><FiArrowLeft /> Previous</button>
            {qIndex < questions.length - 1 ? (
              <button type="button" className="qz-q-nav-btn primary" onClick={() => setQIndex((i) => i + 1)}>Next <FiArrowRight /></button>
            ) : (
              <button type="button" className="qz-q-nav-btn primary" onClick={() => setConfirming(true)}>Submit test</button>
            )}
          </div>
        </article>
      </div>

      {confirming && (
        <div className="qz-modal-overlay" role="dialog" aria-modal="true" aria-label="Submit test confirmation">
          <div className="qz-modal">
            <h3>Submit this test?</h3>
            <p>{answered} of {questions.length} questions answered. Unanswered questions will be marked incorrect.</p>
            <div className="qz-modal-actions">
              <button type="button" className="qz-modal-cancel" onClick={() => setConfirming(false)}>Keep going</button>
              <button type="button" className="qz-modal-submit" onClick={() => onSubmit(questions, answers, images)}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({ config, questions, answers, images, onRetry, onStudyPlan, onHome }) {
  const [grading, setGrading] = useState(false);
  const [gradingError, setGradingError] = useState('');
  const [grades, setGrades] = useState({});       // { qId: { score, feedback, rubric } }
  const [reviewing, setReviewing] = useState(null); // qId being reviewed

  const mcqQuestions = questions.filter((q) => q.type === 'mcq');
  const writtenQuestions = questions.filter((q) => q.type === 'written');

  const mcqCorrect = mcqQuestions.filter((q) => answers[q.id] === q.answer).length;
  const mcqScore = mcqQuestions.length ? Math.round((mcqCorrect / mcqQuestions.length) * 100) : null;

  const writtenGradedCount = Object.keys(grades).length;
  const writtenTotal = writtenQuestions.length;

  const topicStats = {};
  questions.forEach((q) => {
    const key = q.topic || q.chapter || 'Other';
    if (!topicStats[key]) topicStats[key] = { total: 0, correct: 0 };
    topicStats[key].total += 1;
    if (q.type === 'mcq' && answers[q.id] === q.answer) topicStats[key].correct += 1;
  });

  const handleGradeWritten = async () => {
    if (!writtenQuestions.length) return;
    setGrading(true);
    setGradingError('');
    const newGrades = {};
    try {
      for (const q of writtenQuestions) {
        const img = images[q.id];
        if (!String(answers[q.id] || '').trim() && !img?.dataUrl) {
          newGrades[q.id] = { score: 0, extractedText: '', feedback: 'No answer was provided.', rubric: q.explanation || '' };
          continue;
        }
        const result = await gradeWritten(q, answers[q.id] || '', img?.dataUrl);
        newGrades[q.id] = result;
      }
      setGrades(newGrades);
    } catch (err) {
      setGradingError(err.message || 'AI grading failed. Please try again.');
    } finally {
      setGrading(false);
    }
  };

  const mistakes = mcqQuestions.filter((q) => answers[q.id] !== q.answer && answers[q.id]);

  return (
    <div className="qz-results">
      <header className="qz-results-header">
        <div className="qz-results-title">
          <h1>Test complete</h1>
          <p>{config.exams.map((e) => e.exam_name).join(', ')}</p>
          <p className="qz-results-language">Quiz language: {config.language || 'English'} · Transcripts found: {Object.values(config.transcriptStatuses || {}).filter((status) => status.status === 'available').length}</p>
          {config.provider && <small className="qz-provider-note">Questions created with {config.provider}</small>}
        </div>
        <div className="qz-score-ring" style={{ '--pct': `${(mcqScore ?? 0) * 3.6}deg` }}>
          <div>
            <strong>{mcqScore !== null ? `${mcqScore}%` : '—'}</strong>
            <span>MCQ score</span>
          </div>
        </div>
      </header>

      <div className="qz-results-grid">
        <div className="qz-results-main">
          <section className="qz-card">
            <strong className="qz-card-label">Summary</strong>
            <div className="qz-summary-stats">
              <div className="qz-stat"><strong>{mcqCorrect}</strong><span>Correct</span></div>
              <div className="qz-stat"><strong>{mcqQuestions.length - mcqCorrect}</strong><span>Incorrect</span></div>
              <div className="qz-stat"><strong>{mcqQuestions.filter((q) => !answers[q.id]).length}</strong><span>Skipped</span></div>
              {writtenTotal > 0 && <div className="qz-stat"><strong>{writtenGradedCount}/{writtenTotal}</strong><span>Written graded</span></div>}
            </div>
          </section>

          {Object.keys(topicStats).length > 0 && (
            <section className="qz-card">
              <strong className="qz-card-label">By topic</strong>
              <div className="qz-topic-stats">
                {Object.entries(topicStats).map(([topic, stats]) => {
                  const pct = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
                  return (
                    <div className="qz-topic-stat-row" key={topic}>
                      <span className="qz-topic-stat-name">{topic}</span>
                      <div className="qz-topic-stat-bar"><span style={{ width: `${pct}%` }} /></div>
                      <span className="qz-topic-stat-pct">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {mistakes.length > 0 && (
            <section className="qz-card">
              <strong className="qz-card-label">Review mistakes</strong>
              {mistakes.map((q) => (
                <div className="qz-review-item" key={q.id}>
                  <p className="qz-review-question">{q.text}</p>
                  <div className="qz-review-answers">
                    <span className="qz-review-wrong"><FiX /> Your answer: {answers[q.id] || 'Skipped'}</span>
                    <span className="qz-review-correct"><FiCheck /> Correct: {q.answer}</span>
                  </div>
                  {q.explanation && <p className="qz-review-explanation">{q.explanation}</p>}
                </div>
              ))}
            </section>
          )}
        </div>

        <aside className="qz-results-side">
          {writtenTotal > 0 && (
            <section className="qz-card">
              <strong className="qz-card-label">Written answers</strong>
              {gradingError && <p className="qz-video-error" role="status">{gradingError}</p>}
              {writtenGradedCount < writtenTotal && (
                <button type="button" className="qz-grade-btn" disabled={grading} onClick={handleGradeWritten}>
                  {grading ? <><FiRefreshCw className="qz-spin" /> Grading…</> : 'Grade written answers with AI'}
                </button>
              )}
              {writtenQuestions.map((q) => {
                const grade = grades[q.id];
                const img = images[q.id];
                const open = reviewing === q.id;
                return (
                  <div className="qz-written-result" key={q.id}>
                    <button type="button" className="qz-written-toggle" onClick={() => setReviewing(open ? null : q.id)}>
                      <span>{q.text.slice(0, 60)}{q.text.length > 60 ? '…' : ''}</span>
                      <span className={`qz-written-score${grade ? '' : ' pending'}`}>{grade ? `${grade.score}/10` : 'Ungraded'}</span>
                    </button>
                    {open && (
                      <div className="qz-written-detail">
                        {img && <img className="qz-written-thumb" src={img.dataUrl} alt="Handwritten answer" />}
                        <p className="qz-written-text">{answers[q.id] || <em>No text answer provided.</em>}</p>
                        {grade ? (
                          <>
                            <p className="qz-grade-note">AI estimated score: <strong>{grade.score}/10</strong> — review below.</p>
                            {grade.extractedText && <p className="qz-extracted-text"><strong>Text read from your answer:</strong><br />{grade.extractedText}</p>}
                            <p className="qz-grade-feedback">{grade.feedback}</p>
                            {grade.rubric && <pre className="qz-grade-rubric">{grade.rubric}</pre>}
                          </>
                        ) : <p className="qz-grade-note pending">Grade this answer to see AI feedback.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="qz-ai-disclaimer"><FiAlertCircle /> AI grading is an estimate. Review the extracted text before treating scores as final.</p>
            </section>
          )}

          <div className="qz-results-actions">
            <button type="button" className="qz-action-btn primary" onClick={onRetry}><FiRefreshCw /> Try again</button>
            <button type="button" className="qz-action-btn" onClick={onStudyPlan}><FiBookOpen /> Return to Study Plan</button>
            <button type="button" className="qz-action-btn" onClick={onHome}><FiHome /> Return to Home</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function Quiz() {
  const navigate = useNavigate();
  const location = useLocation();

  // The parent can pass exams, studyPlan, and transcripts via router state or props.
  // Fallback to localStorage values used by StudyPlan.
  const routeState = location.state || {};
  const initialExamsSeed = routeState.exams
    || (routeState.exam ? [routeState.exam] : null)
    || (() => {
      try { return JSON.parse(localStorage.getItem('smartdoc-quiz:exams') || 'null'); } catch { return null; }
    })()
    || [];
  const [initialExams, setInitialExams] = useState(initialExamsSeed);
  const studyPlan = routeState.studyPlan
    || (() => { try { return JSON.parse(localStorage.getItem('smartdoc-study-plan:last') || 'null'); } catch { return null; } })();
  const transcripts = routeState.transcripts || safeJson('smartdoc-quiz:transcripts') || [];

  useEffect(() => {
    if (initialExamsSeed.length) return;
    let active = true;
    const loadReminderExams = async () => {
      const reminderIds = safeJson('smartdoc_reminders');
      if (!Array.isArray(reminderIds) || !reminderIds.length) return;
      const { data, error } = await supabase
        .from('exam_notifications')
        .select('id, category, exam_name, notification_title, organization, description, qualification, degree, stream, application_last_date, official_notification_url, official_website_url')
        .in('id', reminderIds)
        .eq('is_active', true);
      if (!error && active && Array.isArray(data)) {
        setInitialExams(data);
        localStorage.setItem('smartdoc-quiz:exams', JSON.stringify(data));
      }
    };
    loadReminderExams();
    return () => { active = false; };
  }, []);

  const [screen, setScreen] = useState('setup'); // 'setup' | 'test' | 'results'
  const [testConfig, setTestConfig] = useState(null);
  const [submittedAnswers, setSubmittedAnswers] = useState(null);
  const [submittedImages, setSubmittedImages] = useState(null);
  const resultSavedRef = useRef(false); // prevents saving the same attempt twice
  const [quizResults, setQuizResults] = useState(() => {
    const saved = safeJson(RESULTS_KEY);
    return Array.isArray(saved) ? saved.filter((result) => result && result.total > 0) : [];
  });

  const persistQuizResults = (next) => {
    setQuizResults(next);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(next));
  };

  const updateQuizResult = (index, fields) => {
    persistQuizResults(quizResults.map((result, resultIndex) => resultIndex === index ? { ...result, ...fields } : result));
  };

  const deleteQuizResult = (index) => {
    persistQuizResults(quizResults.filter((_, resultIndex) => resultIndex !== index));
  };

  const handleStart = (config) => {
    resultSavedRef.current = false;
    setTestConfig(config);
    setScreen('test');
  };

  const handleSubmit = (questions, answers, images) => {
    if (!resultSavedRef.current) {
      resultSavedRef.current = true;
      saveQuizResult(testConfig, questions, answers); // feeds Home dashboard
      const savedResults = safeJson(RESULTS_KEY);
      setQuizResults(Array.isArray(savedResults) ? savedResults : []);
    }
    setTestConfig((prev) => ({ ...prev, questions }));
    setSubmittedAnswers(answers);
    setSubmittedImages(images);
    setScreen('results');
  };

  const handleRetry = () => {
    resultSavedRef.current = false;
    setScreen('setup');
    setTestConfig(null);
    setSubmittedAnswers(null);
    setSubmittedImages(null);
  };

  return (
    <main className="qz-page">
      <div className="qz-shell">
        {screen === 'setup' && (
          <>
            <QuizResultsHistory results={quizResults} onUpdate={updateQuizResult} onDelete={deleteQuizResult} />
            <SetupScreen
              initialExams={initialExams}
              studyPlan={studyPlan}
              transcripts={transcripts}
              onStart={handleStart}
            />
          </>
        )}
        {screen === 'test' && testConfig && (
          <TestScreen
            config={testConfig}
            onSubmit={handleSubmit}
            onAbort={() => setScreen('setup')}
          />
        )}
        {screen === 'results' && testConfig && (
          <ResultsScreen
            config={testConfig}
            questions={testConfig.questions}
            answers={submittedAnswers || {}}
            images={submittedImages || {}}
            onRetry={handleRetry}
            onStudyPlan={() => navigate('/study-plan')}
            onHome={() => navigate('/home')}
          />
        )}
      </div>
    </main>
  );
}