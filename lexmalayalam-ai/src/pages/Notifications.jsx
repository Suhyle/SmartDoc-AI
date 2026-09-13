import React, { useState, useEffect, useMemo } from 'react';



import { useNavigate } from 'react-router-dom';



import { supabase } from '../supabase';



import {



  ELIGIBILITY_UNKNOWN,



  filterNotifications,



  getMatchedNotifications,



  getOfficialNotificationUrl,



  normalizeNotificationCategory,



  toggleReminderId,



} from '../utils/notificationEligibility';



import {



  FiArrowLeft as ArrowLeft,



  FiSearch as Search,



  FiBell as Bell,



  FiUser as User,



  FiFileText as FileText,



  FiBriefcase as Building2,



  FiTrendingUp as Train,



  FiAward as Trophy,



  FiBookOpen as GraduationCap,



  FiCalendar as Calendar,



  FiExternalLink as ExternalLink,



  FiChevronRight as ChevronRight,



  FiGrid as Grid2x2,



  FiLayers as Landmark,



  FiCheckCircle as CheckCircle2,



  FiAlertCircle as AlertCircle,



  FiArrowRight as ArrowRight,



  FiInfo as Info



} from 'react-icons/fi';



import './Notifications.css';







/* =========================================================



   CONSTANTS & HELPERS



========================================================= */







const STORAGE_REMINDERS_KEY = 'smartdoc_reminders';

const hasRequiredExamDetails = (row) => Boolean(
  row?.exam_name?.trim()
  && row?.application_last_date
  && [row?.qualification, row?.degree, row?.stream].some((value) => value?.trim())
);







const CATEGORY_KEYS = ['All', 'PSC', 'SSC', 'Railway', 'UPSC', 'Banking'];







// View modes



const VIEW_ALL = 'all';



const VIEW_MY_EXAMS = 'my_exams';







/**



 * Safely format ISO date strings (YYYY-MM-DD) into user-friendly format (e.g. "31 Oct 2026")



 * without timezone shifting errors.



 */



const formatDate = (dateStr) => {



  if (!dateStr) return '';



  try {



    const parts = String(dateStr).split('T')[0].split('-');



    if (parts.length === 3) {



      const year = parseInt(parts[0], 10);



      const monthIndex = parseInt(parts[1], 10) - 1;



      const day = parseInt(parts[2], 10);



      const date = new Date(year, monthIndex, day);



      if (!isNaN(date.getTime())) {



        return date.toLocaleDateString('en-GB', {



          day: '2-digit',



          month: 'short',



          year: 'numeric',



        });



      }



    }



  } catch {



    // Fallback to raw string



  }



  return dateStr;



};







/**



 * Get category icon, colors, and metadata



 */



const getCategoryMeta = (category) => {



  const normalized = normalizeNotificationCategory(category);



  switch (normalized) {



    case 'PSC':



      return {



        key: 'PSC',



        displayName: 'Kerala PSC',



        icon: <Building2 className="sd-notif-cat-icon" size={18} />,



        badgeText: 'PSC',



        themeClass: 'sd-notif-accent-psc',



      };



    case 'SSC':



      return {



        key: 'SSC',



        displayName: 'SSC',



        icon: <FileText className="sd-notif-cat-icon" size={18} />,



        badgeText: 'SSC',



        themeClass: 'sd-notif-accent-ssc',



      };



    case 'Railway':



      return {



        key: 'Railway',



        displayName: 'Railway',



        icon: <Train className="sd-notif-cat-icon" size={18} />,



        badgeText: 'RRB',



        themeClass: 'sd-notif-accent-railway',



      };



    case 'UPSC':



      return {



        key: 'UPSC',



        displayName: 'UPSC',



        icon: <Trophy className="sd-notif-cat-icon" size={18} />,



        badgeText: 'UPSC',



        themeClass: 'sd-notif-accent-upsc',



      };



    case 'Banking':



      return {



        key: 'Banking',



        displayName: 'Banking',



        icon: <Landmark className="sd-notif-cat-icon" size={18} />,



        badgeText: 'BANK',



        themeClass: 'sd-notif-accent-bank',



      };



    default:



      return {



        key: 'Other',



        displayName: category || 'General',



        icon: <Building2 className="sd-notif-cat-icon" size={18} />,



        badgeText: 'EXAM',



        themeClass: 'sd-notif-accent-other',



      };



  }



};







/* =========================================================



   MAIN COMPONENT



========================================================= */







export default function Notifications() {



  const navigate = useNavigate();







  const [notifications, setNotifications] = useState([]);



  const [loading, setLoading] = useState(false);



  const [searched, setSearched] = useState(false);



  const [error, setError] = useState('');







  // Filtering & Search state



  const [selectedCategory, setSelectedCategory] = useState('All');



  const [searchQuery, setSearchQuery] = useState('');







  // View mode: 'all' = show all notifications, 'my_exams' = qualification-filtered



  const [viewMode, setViewMode] = useState(VIEW_ALL);







  // Reminders state stored in localStorage



  const [reminders, setReminders] = useState(() => {



    try {



      const saved = localStorage.getItem(STORAGE_REMINDERS_KEY);



      return saved ? JSON.parse(saved) : [];



    } catch {



      return [];



    }



  });







  // User qualification loaded from Supabase (primary source)



  const [userQualification, setUserQualification] = useState(null);



  // Whether qualification loading has completed (success or failure)



  const [qualLoading, setQualLoading] = useState(true);

  // Supabase / notification pipeline status
  const [pipelineStatus, setPipelineStatus] = useState([]);
  const [showPipelineStatus, setShowPipelineStatus] = useState(false);







  // Toast / Feedback message state



  const [toastMessage, setToastMessage] = useState('');







  /* =========================================================



     EFFECTS & FETCHING



  ========================================================= */







  /**



   * On mount: load qualification from Supabase (authenticated user) then



   * fetch existing active exam notifications. No automatic source refresh.



   */



  useEffect(() => {



    let isMounted = true;







    const loadQualification = async () => {



      try {



        // 1. Get authenticated Supabase user



        const { data: { user }, error: authError } = await supabase.auth.getUser();







        if (authError || !user) {



          // Not authenticated — cannot load private qualification



          if (isMounted) setQualLoading(false);



          return;



        }







        // Login saves one row per qualification in user_qualifications.
        const { data: qualificationRows, error: qualificationError } = await supabase
          .from('user_qualifications')
          .select('full_name, date_of_birth, age, category, highest_qualification, degree, specialization, year_of_passing')
          .eq('user_id', user.id)
          .order('year_of_passing', { ascending: true });

        if (qualificationError) {
          console.error('Error loading qualifications:', qualificationError);
          if (isMounted) {
            setUserQualification(null);
            setPipelineStatus([
              { label: 'Supabase authentication: connected', ok: true },
              { label: `Qualification query failed: ${qualificationError.message}`, ok: false },
            ]);
            setShowPipelineStatus(true);
          }
          return;
        }

        const qualifications = (qualificationRows || [])
          .filter((item) => item?.highest_qualification)
          .map((item) => ({
            highestQualification: item.highest_qualification,
            degree: item.degree || '',
            specialization: item.specialization || '',
            yearOfPassing: item.year_of_passing ?? null,
          }));

        if (qualifications.length === 0) {
          if (isMounted) {
            setUserQualification(null);
            setPipelineStatus([
              { label: 'Supabase authentication: connected', ok: true },
              { label: 'No saved qualifications found for this account', ok: false },
            ]);
            setShowPipelineStatus(true);
          }
        } else {
          const profile = qualificationRows[0];
          const userQual = {
            fullName: profile.full_name || '',
            dateOfBirth: profile.date_of_birth || '',
            age: profile.age ?? null,
            category: profile.category || '',
            qualifications,
          };

          if (isMounted) {
            setUserQualification(userQual);
            setPipelineStatus([
              { label: 'Supabase authentication: connected', ok: true },
              { label: `Qualification profile loaded from Supabase: ${qualifications.length} qualification(s)`, ok: true },
            ]);
            setShowPipelineStatus(true);
          }
        }



      } catch (err) {



        console.error('Unexpected error loading qualification:', err);



      } finally {



        if (isMounted) setQualLoading(false);



      }



    };







    loadQualification();







    // Also auto-fetch existing active notifications from Supabase on mount (no source refresh)



    fetchExams();







    return () => { isMounted = false; };



  }, []);







  // Save reminders to localStorage whenever state changes



  useEffect(() => {



    try {



      localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(reminders));



    } catch (e) {



      console.error('Could not save reminders to localStorage', e);



    }



  }, [reminders]);







  /**



   * Fetch active exam notifications from Supabase (reads existing DB records only).



   * Does NOT trigger official source refresh.



   */



  const fetchExams = async () => {



    setLoading(true);



    setError('');







    try {



      const { data, error: fetchErr } = await supabase



        .from('exam_notifications')



        .select('*')



        .eq('is_active', true)



        .order('application_last_date', { ascending: true });







      if (fetchErr) {



        console.error('Supabase fetch error:', fetchErr);



        setError('Unable to load exam notifications. Please try again.');



        setNotifications([]);



      } else {
        const uniqueRows = new Map();
        for (const row of (data || []).filter(hasRequiredExamDetails)) {
          const identity = [row.category, row.exam_name, row.application_last_date]
            .map((value) => String(value || '').trim().toLowerCase())
            .join('|');
          const existing = uniqueRows.get(identity);
          const rowUpdatedAt = Date.parse(row.updated_at || row.created_at || '') || 0;
          const existingUpdatedAt = Date.parse(existing?.updated_at || existing?.created_at || '') || 0;
          if (!existing || rowUpdatedAt >= existingUpdatedAt) uniqueRows.set(identity, row);
        }
        const rows = [...uniqueRows.values()];
        setNotifications(rows);
        setSearched(true);
        setPipelineStatus((prev) => [
          ...prev.filter(
            (item) =>
              !String(item.label).startsWith('Active notifications read from exam_notifications') &&
              !String(item.label).startsWith('Notifications available on this page')
          ),
          { label: `Active notifications read from exam_notifications: ${rows.length}`, ok: true },
          { label: `Notifications available on this page: ${rows.length}`, ok: true },
        ]);
        setShowPipelineStatus(true);
      }



    } catch (err) {



      console.error('Unexpected error fetching exams:', err);



      setError('Connection error while fetching exam notifications.');



      setNotifications([]);



    } finally {



      setLoading(false);



    }



  };







  /* =========================================================



     ACTIONS



  ========================================================= */







  const handleBack = () => {



    navigate('/home');



  };







  const handleAllNotifications = async () => {
    if (loading) return;
    setViewMode(VIEW_ALL);
    setSelectedCategory('All');
    setSearchQuery('');
    setSearched(true);
    setShowPipelineStatus(true);
    setPipelineStatus([
      { label: 'Refreshing PSC notifications from the deployed function...', pending: true },
      { label: 'Loading active exam notifications from Supabase...', pending: true },
    ]);

    let pscResult;
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'fetch-psc-notifications',
        { body: { dry_run: false } }
      );
      let result = data;
      let errorMessage = invokeError?.message || '';
      if (invokeError?.context && typeof invokeError.context.json === 'function') {
        try {
          result = await invokeError.context.json();
          errorMessage = result?.error || result?.message || errorMessage;
        } catch {
          // Keep the original Functions error when the response is not JSON.
        }
      }

      const ok = !invokeError && result?.success !== false;
      const counts = `PSC: ${Number(result?.inserted) || 0} added, ${Number(result?.updated) || 0} updated, ${Number(result?.skipped) || 0} skipped`;
      pscResult = {
        ok,
        label: `${counts}${errorMessage ? ` — ${errorMessage}` : ''}`,
      };
    } catch (refreshError) {
      pscResult = {
        ok: false,
        label: `PSC refresh failed — ${refreshError?.message || 'could not reach the deployed function'}`,
      };
    }

    await fetchExams();
    setPipelineStatus((prev) => [
      ...prev.filter((item) => !String(item.label).startsWith('Refreshing PSC notifications')
        && !String(item.label).startsWith('Loading active exam notifications')
        && !String(item.label).startsWith('PSC:')),
      pscResult,
    ]);
  };

  const handleFindExamForMe = async () => {
    if (loading) return;
    if (!userQualification?.qualifications?.length) {
      setError('Your saved qualification profile is not available.');
      return;
    }

    setViewMode(VIEW_MY_EXAMS);
    setSelectedCategory('All');
    setSearchQuery('');
    setSearched(true);
    setShowPipelineStatus(true);
    setPipelineStatus([{ label: 'Qualification profile loaded from Supabase', ok: true }]);
    await fetchExams();
  };
  const toggleReminder = (notificationId, examName, exam) => {
    const isAlreadySet = reminders.includes(notificationId);
    setReminders((previous) => toggleReminderId(previous, notificationId));

    if (isAlreadySet) {
      showToast(`Reminder removed for ${examName}`);
      return;
    }

    showToast(`Reminder set for ${examName}! Opening your study planner…`);
    navigate('/study-plan', { state: { exam } });
  };







  const handleViewNotification = (exam) => {



    const targetUrl = getOfficialNotificationUrl(exam);



    if (targetUrl) {



      window.open(targetUrl, '_blank', 'noopener,noreferrer');



    } else {



      showToast('Official notification link is not available yet.');



    }



  };







  const showToast = (msg) => {



    setToastMessage(msg);



    setTimeout(() => setToastMessage(''), 3200);



  };







  /* =========================================================



     ELIGIBILITY CALCULATIONS (runs only in VIEW_MY_EXAMS mode)



  ========================================================= */







  // Only active records with a definitive MATCH are eligible for display.



  const matchedNotifications = useMemo(() => {



    return getMatchedNotifications(notifications, userQualification);



  }, [notifications, userQualification]);







  /* =========================================================



     FILTER & SEARCH CALCULATIONS



  ========================================================= */







  // All mode shows every saved active notice; qualification mode shows only matches.

  const notificationsForView = viewMode === VIEW_MY_EXAMS
    ? matchedNotifications
    : notifications;



  // Counts reflect the current view and its qualification filter.



  const categoryCounts = useMemo(() => {



    const counts = { All: notificationsForView.length, PSC: 0, SSC: 0, Railway: 0, UPSC: 0, Banking: 0 };



    notificationsForView.forEach((item) => {



      const key = normalizeNotificationCategory(item.category);



      if (counts[key] !== undefined) counts[key] += 1;



    });



    return counts;



  }, [notificationsForView]);







  /**



   * Apply the category and search filters to the selected view.



   */



  const filteredNotifications = useMemo(() => {



    return filterNotifications(notificationsForView, selectedCategory, searchQuery);



  }, [notificationsForView, selectedCategory, searchQuery]);







  // Group only notifications that are still eligible after all filters.



  const groupedNotifications = useMemo(() => {



    const groups = {};



    const categoriesToGroup = selectedCategory === 'All'



      ? ['PSC', 'SSC', 'Railway', 'UPSC', 'Banking']



      : [selectedCategory];



    categoriesToGroup.forEach((catKey) => {



      groups[catKey] = filteredNotifications.filter(



        (item) => normalizeNotificationCategory(item.category) === catKey



      );



    });



    return groups;



  }, [filteredNotifications, selectedCategory]);







  /* =========================================================



     SHARED CARD RENDERER



  ========================================================= */







  const renderCard = (exam, eligibilityStatus = null) => {



    const examMeta = getCategoryMeta(exam.category);



    const isReminderSet = reminders.includes(exam.id);



    const formattedLastDate = formatDate(exam.application_last_date);



    const formattedStartDate = formatDate(exam.application_start_date);







    return (



      <article



        key={exam.id}



        className={`sd-notif-card ${examMeta.themeClass}`}



      >



        {/* Card Top: Badge, Eligibility Tag & Chevron */}



        <div className="sd-notif-card-header">



          <div className="sd-notif-badge">{examMeta.badgeText}</div>



          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>



            {eligibilityStatus === ELIGIBILITY_UNKNOWN && (



              <span className="sd-notif-eligibility-tag unknown">



                <Info size={11} /> Eligibility details unavailable



              </span>



            )}



            <ChevronRight size={16} className="sd-notif-card-arrow" />



          </div>



        </div>







        {/* Card Title & Organization */}



        <div className="sd-notif-card-title-block">



          <h3 className="sd-notif-exam-name">{exam.exam_name}</h3>



          <p className="sd-notif-org-name">



            {exam.organization || exam.notification_title || examMeta.displayName}



          </p>



        </div>







        {/* Description (Optional) */}



        {exam.description && (



          <p className="sd-notif-description">{exam.description}</p>



        )}







        {/* Key Details List */}



        <div className="sd-notif-details-list">



          {/* Qualification / Degree */}



          <div className="sd-notif-detail-item">



            <GraduationCap size={15} className="sd-notif-detail-icon" />



            <span className="sd-notif-detail-text">



              <strong>Qualification:</strong>{' '}



              {[exam.qualification, exam.degree, exam.stream]



                .filter(Boolean)



                .join(' / ') || 'As per notification'}



            </span>



          </div>







          {/* Age Limit */}



          {exam.age_limit && (



            <div className="sd-notif-detail-item">



              <User size={15} className="sd-notif-detail-icon" />



              <span className="sd-notif-detail-text">



                <strong>Age Limit:</strong> {exam.age_limit}



              </span>



            </div>



          )}







          {/* Application Last Date */}



          <div className="sd-notif-detail-item sd-notif-highlight-date">



            <Calendar size={15} className="sd-notif-detail-icon date-icon" />



            <span className="sd-notif-detail-text">



              <strong>Last Date:</strong>{' '}



              <span className="sd-notif-date-val">



                {formattedLastDate || 'See notification'}



              </span>



            </span>



          </div>







          {/* Optional Application Start Date */}



          {formattedStartDate && (



            <div className="sd-notif-detail-item sd-notif-sub-detail">



              <span className="sd-notif-detail-text">



                <strong>Starts:</strong> {formattedStartDate}



              </span>



            </div>



          )}







          {/* Optional Vacancies */}



          {exam.vacancies && (



            <div className="sd-notif-detail-item sd-notif-sub-detail">



              <span className="sd-notif-detail-text">



                <strong>Vacancies:</strong> {exam.vacancies}



              </span>



            </div>



          )}



        </div>







        {/* Card Action Buttons */}



        <div className="sd-notif-card-actions">



          <button



            type="button"



            className="sd-notif-official-btn"



            onClick={() => handleViewNotification(exam)}



          >



            <ExternalLink size={14} />



            <span>View Notification</span>



          </button>







          <button



            type="button"



            className={`sd-notif-reminder-btn ${isReminderSet ? 'active' : ''}`}



            onClick={() => toggleReminder(exam.id, exam.exam_name, exam)}



          >



            {isReminderSet ? (



              <>



                <Bell size={14} className="bell-active-icon" />



                <span>Reminder Set</span>



              </>



            ) : (



              <>



                <Bell size={14} />



                <span>Set Reminder</span>



              </>



            )}



          </button>



        </div>



      </article>



    );



  };







  /* =========================================================



     RENDER



  ========================================================= */







  const qualificationLabels = [...new Set(
    (userQualification?.qualifications || [])
      .map((item) => item?.highestQualification)
      .filter(Boolean)
  )];
  const highestQualLabel = qualificationLabels.length
    ? qualificationLabels.join(', ')
    : userQualification?.highestQualification || 'Your Profile';







  return (



    <div className="sd-notif-page">



      <div className="sd-notif-container">







        {/* ── 1. BRAND HEADER WITH BACK BUTTON TO /HOME ── */}



        <header className="sd-notif-brand-header">



          <div className="sd-notif-brand-left">



            <button



              type="button"



              className="sd-notif-icon-btn sd-notif-back-btn"



              onClick={handleBack}



              aria-label="Back to Home"



              title="Back to Home"



            >



              <ArrowLeft size={20} />



            </button>







            <div className="sd-notif-logo-box" aria-hidden="true">



              <FileText size={20} className="sd-notif-logo-icon" />



            </div>







            <div className="sd-notif-brand-text-group">



              <span className="sd-notif-brand-title">



                SmartDoc <span className="sd-notif-brand-ai">AI</span>



              </span>



              <span className="sd-notif-brand-tagline">Transcribe. Learn. Succeed.</span>



            </div>



          </div>







          <div className="sd-notif-brand-right">



            <button className="sd-notif-icon-btn" aria-label="Notifications">



              <Bell size={19} />



              <span className="sd-notif-badge-dot">{reminders.length}</span>



            </button>







            <button className="sd-notif-icon-btn sd-notif-avatar-btn" aria-label="User Profile">



              <User size={19} />



            </button>



          </div>



        </header>







        {/* ── 2. HERO BANNER ── */}



        <section className="sd-notif-hero">



          <div className="sd-notif-hero-content">



            <span className="sd-notif-hero-tag">COMPETITIVE EXAMS</span>



            <h1 className="sd-notif-hero-title">Exam Notifications</h1>



            <p className="sd-notif-hero-subtitle">



              PSC notices refresh from the official source; other exam notices are maintained in Supabase and matched to your qualifications.



            </p>







            {/* Hero Action Row: two mode buttons */}



            <div className="sd-notif-hero-action-row">







              {/* All Notifications Button */}



              <button



                type="button"



                className={`sd-notif-find-btn ${viewMode === VIEW_ALL ? 'active-mode' : 'secondary-mode'}`}



                onClick={handleAllNotifications}

                disabled={loading}



              >



                <Grid2x2 size={17} className="sd-notif-btn-icon" />



                <span>All Notifications</span>



              </button>







              {/* Find Exam For Me Button */}



              <button



                type="button"



                className={`sd-notif-find-btn ${viewMode === VIEW_MY_EXAMS ? 'active-mode' : 'secondary-mode'}`}



                onClick={handleFindExamForMe}

                disabled={loading || qualLoading || !userQualification}

              >

                <Search size={17} className="sd-notif-btn-icon" />

                <span>

                  {qualLoading

                    ? 'Loading Profile...'

                    : loading && viewMode === VIEW_MY_EXAMS

                      ? 'Finding...'

                      : 'Find Exam for Me'}

                </span>



                <ChevronRight size={16} className="sd-notif-btn-arrow" />



              </button>







            </div>







            {/* Qualification profile pill — informational only, loaded from Supabase */}



            {!qualLoading && userQualification && (



              <div className="sd-notif-qual-pill" title="Qualification Profile (loaded from your account)">



                <GraduationCap size={15} />



                <span>Qualifications: {highestQualLabel}</span>



              </div>



            )}

            {/* Qualification is created during account setup and is only

                read from Supabase on this page. */}

            {!qualLoading && !userQualification && (

              <div className="sd-notif-no-profile-warning">

                <AlertCircle size={15} />

                <span>

                  Your saved qualification profile is not available for this account.

                </span>

              </div>

            )}





          </div>







          {/* Decorative graphic element */}



          <div className="sd-notif-hero-graphic" aria-hidden="true">



            <div className="sd-notif-doc-shape">



              <div className="sd-notif-doc-line" />



              <div className="sd-notif-doc-line short" />



              <div className="sd-notif-doc-line" />



              <div className="sd-notif-bell-badge">



                <Bell size={24} style={{ fill: '#f59e0b', color: '#d97706' }} />



              </div>



            </div>



          </div>



        </section>

        {showPipelineStatus && pipelineStatus.length > 0 && (
          <section
            className="sd-notif-pipeline-status"
            aria-live="polite"
            style={{
              marginTop: '14px',
              padding: '14px 16px',
              borderRadius: '14px',
              background: '#ffffff',
              border: '1px solid #e2e1ff',
              boxShadow: '0 6px 18px rgba(75, 63, 181, 0.08)',
            }}
          >
            <div style={{
              fontWeight: 800,
              color: '#312e81',
              marginBottom: '10px',
              fontSize: '14px',
            }}>
              Notification Status
            </div>
            <div style={{ display: 'grid', gap: '7px' }}>
              {pipelineStatus.map((step, index) => (
                <div
                  key={`${step.label}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: step.ok === false ? '#b42318' : '#374151',
                    fontSize: '13px',
                  }}
                >
                  <span
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: step.pending
                        ? '#eef2ff'
                        : step.ok === false
                          ? '#fee4e2'
                          : '#dcfae6',
                      color: step.pending
                        ? '#4f46e5'
                        : step.ok === false
                          ? '#b42318'
                          : '#087443',
                      fontWeight: 800,
                      flex: '0 0 18px',
                    }}
                  >
                    {step.pending ? '…' : step.ok === false ? '!' : '✓'}
                  </span>
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          </section>
        )}







        {/* ── 3. SEARCH & CATEGORY FILTER BAR ── */}



        <div className="sd-notif-filter-section">



          {/* Search Bar */}



          <div className="sd-notif-search-wrapper">



            <Search size={18} className="sd-notif-search-icon" />



            <input



              type="text"



              className="sd-notif-search-input"



              placeholder="Search by exam name, qualification, organization..."



              value={searchQuery}



              onChange={(e) => setSearchQuery(e.target.value)}



            />



            {searchQuery && (



              <button



                type="button"



                className="sd-notif-search-clear"



                onClick={() => setSearchQuery('')}



                aria-label="Clear search"



              >



                ✕



              </button>



            )}



          </div>







          {/* Category Filter Pills */}



          <div className="sd-notif-category-pills">



            {CATEGORY_KEYS.map((catKey) => {



              const isActive = selectedCategory === catKey;



              const count = categoryCounts[catKey] || 0;



              let IconComp = Grid2x2;



              if (catKey === 'PSC') IconComp = Building2;



              if (catKey === 'SSC') IconComp = FileText;



              if (catKey === 'Railway') IconComp = Train;



              if (catKey === 'UPSC') IconComp = Trophy;



              if (catKey === 'Banking') IconComp = Landmark;







              return (



                <button



                  key={catKey}



                  type="button"



                  className={`sd-notif-pill ${isActive ? 'active' : ''}`}



                  onClick={() => setSelectedCategory(catKey)}



                >



                  <IconComp size={16} className="sd-notif-pill-icon" />



                  <span>{catKey}</span>



                  <span className="sd-notif-pill-count">({count})</span>



                </button>



              );



            })}



          </div>



        </div>







        {/* ── 4. ERROR & LOADING STATES ── */}



        {error && (



          <div className="sd-notif-error-banner" role="alert">



            <AlertCircle size={20} />



            <span>{error}</span>



            <button type="button" onClick={fetchExams} className="sd-notif-retry-btn">



              Retry



            </button>



          </div>



        )}







        {loading && (



          <div className="sd-notif-loading-grid">



            {[1, 2, 3, 4, 5, 6].map((idx) => (



              <div key={idx} className="sd-notif-card sd-notif-skeleton-card">



                <div className="sd-notif-skeleton-top" />



                <div className="sd-notif-skeleton-line short" />



                <div className="sd-notif-skeleton-line" />



                <div className="sd-notif-skeleton-line" />



                <div className="sd-notif-skeleton-button" />



              </div>



            ))}



          </div>



        )}







        {/* ── 5. QUALIFICATION-MATCHED NOTIFICATIONS ── */}



        {!loading && (



          <>



            {/* Empty state */}



            {searched && filteredNotifications.length === 0 && (



              <div className="sd-notif-empty-card">



                <Info size={36} className="sd-notif-empty-icon" />



                <h3>{userQualification ? 'No Matching Exams' : 'No Qualification Profile'}</h3>



                <p>



                  {!userQualification



                    ? 'Your saved qualification profile is not available for this account.'



                    : searchQuery



                    ? `No notifications matched your search "${searchQuery}".`



                    : selectedCategory !== 'All'



                    ? `No active exams currently match your qualification under ${selectedCategory}.`



                    : 'No active exams currently match your qualification.'}



                </p>

                {/* Qualification is never entered from Notifications.

                    It is loaded from the authenticated user's Supabase profile. */}





                {(searchQuery || selectedCategory !== 'All') && (



                  <button



                    type="button"



                    className="sd-notif-reset-btn"



                    onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}



                  >



                    Reset Filters



                  </button>



                )}



              </div>



            )}







            <div className="sd-notif-sections-wrapper">



              {Object.entries(groupedNotifications).map(([catKey, items]) => {



                if (items.length === 0) return null;



                const meta = getCategoryMeta(catKey);







                return (



                  <section key={catKey} className="sd-notif-category-section">



                    <div className="sd-notif-category-header">



                      <div className="sd-notif-category-title-group">



                        <div className={`sd-notif-category-icon-box ${meta.themeClass}`}>



                          {meta.icon}



                        </div>



                        <h2 className="sd-notif-category-title">



                          {meta.displayName}{' '}



                          <span className="sd-notif-cat-count">({items.length})</span>



                        </h2>



                      </div>



                      {selectedCategory === 'All' && (



                        <button



                          type="button"



                          className="sd-notif-view-all-link"



                          onClick={() => setSelectedCategory(catKey)}



                        >



                          <span>View All</span>



                          <ArrowRight size={14} />



                        </button>



                      )}



                    </div>







                    <div className="sd-notif-cards-grid">



                      {items.map((exam) => renderCard(exam, null))}



                    </div>



                  </section>



                );



              })}



            </div>



          </>



        )}







        {/* ── 7. TOAST FEEDBACK ── */}



        {toastMessage && (



          <div className="sd-notif-toast" role="status">



            <CheckCircle2 size={16} />



            <span>{toastMessage}</span>



          </div>



        )}







      </div>



    </div>



  );



}
