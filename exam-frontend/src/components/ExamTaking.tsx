import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import api from '../lib/api';
import { useProctoring, requestFullScreen } from '../hooks/useProctoring';
import { Exam, Question } from '../types/models';
import ReviewAndSubmitModal from './ReviewAndSubmitModal';
import {
  Clock,
  Loader2,
  AlertOctagon,
  ShieldAlert,
  Flag,
  ChevronLeft,
  ChevronRight,
  Check,
  Menu,
  X,
  CloudCheck,
  WifiOff,
  ListFilter,
  CheckCircle2,
  Keyboard,
  MousePointerClick,
  Maximize2,
  Type,
  Filter,
  Circle,
  FileText,
  User,
} from 'lucide-react';

type CandidateInfo = {
  name: string;
  candidateId: string;
  center: string;
};

type Props = {
  exam: Exam;
  onComplete: () => void;
  onCancel: () => void;
  // Optional candidate details for the top bar
  candidate?: CandidateInfo;
};

const MAX_WARNINGS = 3;
const SNAPSHOT_INTERVAL = 30000;

// Try to infer section name from flexible backend fields
const getSectionName = (q: Question): string => {
  const anyQ: any = q;
  return (
    anyQ.section || anyQ.section_name || anyQ.topic || 'General'
  );
};

export function ExamTaking({ exam, onComplete, onCancel, candidate }: Props) {
  // --- State ---
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(
    new Set(),
  );
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const [status, setStatus] = useState<
    'loading' | 'idle' | 'active' | 'submitting' | 'error'
  >('loading');
  const [warnings, setWarnings] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preferences
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg' | 'xl'>(
    'base',
  );
  const [paletteFilter, setPaletteFilter] = useState<
    'all' | 'unanswered' | 'marked'
  >('all');

  const [saveStatus, setSaveStatus] = useState<
    'saved' | 'saving' | 'error'
  >('saved');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showQuestionPaper, setShowQuestionPaper] = useState(false);

  const [activeSection, setActiveSection] = useState<string | null>(null);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef(answers);
  const warningsRef = useRef(warnings);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    warningsRef.current = warnings;
  }, [warnings]);

  useEffect(() => {
    if (window.innerWidth < 1024) setShowSidebar(false);
  }, []);

  // Derive section list from questions
  const sections = useMemo(() => {
    if (!questions.length) return [] as string[];
    const names = Array.from(
      new Set(questions.map(q => getSectionName(q))),
    );
    return names;
  }, [questions]);

  // --- 1. API: Start Exam ---
  useEffect(() => {
    let isMounted = true;
    async function initExam() {
      try {
        const examRes = await api.get(`/exams/${exam.id}`);
        if (!isMounted) return;

        const qs: Question[] = examRes.data.questions || [];
        setQuestions(qs);
        if (qs.length > 0) {
          setVisited(new Set([qs[0].id]));
          setActiveSection(getSectionName(qs[0]));
        }

        const attemptRes = await api.post('/attempts/start', {
          exam_id: exam.id,
        });
        if (!isMounted) return;

        const attempt = attemptRes.data;
        setAttemptId(attempt.id);

        if (attempt.answers) setAnswers(attempt.answers);
        if (attempt.time_left) setTimeLeft(attempt.time_left);
        if (attempt.tab_switches) setWarnings(attempt.tab_switches);

        if (attempt.submitted_at || attempt.is_terminated) {
          onComplete();
          return;
        }

        if (!document.fullscreenElement) {
          try {
            await requestFullScreen();
          } catch {
            // user denied
          }
        }

        setStatus('active');
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(
            err.response?.data?.error || 'Failed to load exam.',
          );
          setStatus('error');
        }
      }
    }
    initExam();
    return () => {
      isMounted = false;
    };
  }, [exam.id, onComplete]);

  // --- 2. Track Visitation ---
  useEffect(() => {
    if (questions[currentQIndex]) {
      setVisited(prev => {
        const next = new Set(prev);
        next.add(questions[currentQIndex].id);
        return next;
      });
    }
  }, [currentQIndex, questions]);

  // Keep active section in sync with current question
  useEffect(() => {
    if (
      questions.length &&
      currentQIndex >= 0 &&
      currentQIndex < questions.length
    ) {
      setActiveSection(getSectionName(questions[currentQIndex]));
    }
  }, [currentQIndex, questions]);

  // --- 3. Timer & Keyboard ---
  useEffect(() => {
    if (status !== 'active') return;
    if (timeLeft <= 0) {
      if (timeLeft === 0 && questions.length > 0)
        submitAttempt(true, 'Time Limit');
      return;
    }
    const timer = setInterval(
      () => setTimeLeft(prev => Math.max(0, prev - 1)),
      1000,
    );
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight')
        setCurrentQIndex(prev => Math.min(prev + 1, questions.length - 1));
      if (e.key === 'ArrowLeft')
        setCurrentQIndex(prev => Math.max(0, prev - 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [timeLeft, status, questions.length]);

  // --- 4. Save & Proctoring ---
  const saveToBackend = useCallback(
    async (currentAnswers: Record<string, string>) => {
      if (!attemptId) return;
      setSaveStatus('saving');
      try {
        await api.post('/progress', {
          attempt_id: attemptId,
          tab_switches: warningsRef.current,
          answers: currentAnswers,
          snapshot: '',
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    },
    [attemptId],
  );

  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(
      () => saveToBackend(answersRef.current),
      SNAPSHOT_INTERVAL,
    );
    return () => clearInterval(interval);
  }, [status, saveToBackend]);

  const handleViolation = useCallback(
    (type: string) => {
      if (status !== 'active') return;
      setWarnings(prev => {
        const newW = prev + 1;
        saveToBackend(answersRef.current);
        if (newW >= MAX_WARNINGS)
          submitAttempt(true, `Violation: ${type}`);
        return newW;
      });
    },
    [status, saveToBackend],
  );

  useProctoring({
    isActive: status === 'active',
    onViolation: handleViolation,
  });

  useEffect(() => {
    const fsHandler = () => {
      const full = !!document.fullscreenElement;
      setIsFullScreen(full);
      if (!full && status === 'active')
        handleViolation('fullscreen_exit');
    };
    document.addEventListener('fullscreenchange', fsHandler);
    return () =>
      document.removeEventListener('fullscreenchange', fsHandler);
  }, [status, handleViolation]);

  // --- 5. Interactions ---
  const handleOptionClick = (qId: string, opt: string) => {
    if (status !== 'active') return;
    const q = questions.find(q => q.id === qId);
    if (!q) return;

    let newVal = '';
    if (q.type === 'multi-select') {
      const currentRaw = answers[qId] || '';
      let currentOpts = currentRaw ? currentRaw.split(',') : [];
      if (currentOpts.includes(opt))
        currentOpts = currentOpts.filter(o => o !== opt);
      else currentOpts.push(opt);
      newVal = currentOpts.sort().join(',');
    } else {
      newVal = opt;
    }

    const newAnswers = { ...answers, [qId]: newVal };
    setAnswers(newAnswers);

    if (autoSaveTimerRef.current)
      clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(
      () => saveToBackend(newAnswers),
      1000,
    );
  };

  const submitAttempt = async (forced: boolean, reason?: string) => {
    if (status === 'submitting') return;

    if (!forced) {
      setShowSubmitModal(true);
      return;
    }

    setShowSubmitModal(false);
    setStatus('submitting');
    if (autoSaveTimerRef.current)
      clearTimeout(autoSaveTimerRef.current);
    await saveToBackend(answers);
    try {
      await api.post('/attempts/submit', { attempt_id: attemptId, reason });
      if (document.fullscreenElement)
        document.exitFullscreen().catch(() => { });
      onComplete();
    } catch {
      setErrorMessage('Submission failed. Please check connection.');
      setStatus('active');
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${sec
      .toString()
      .padStart(2, '0')}`;
  };

  const isSelected = (qId: string, opt: string, type: string) => {
    const val = answers[qId];
    if (!val) return false;
    if (type === 'multi-select') return val.split(',').includes(opt);
    return val === opt;
  };

  const getTextClass = () => {
    switch (textSize) {
      case 'sm':
        return 'text-sm';
      case 'lg':
        return 'text-lg';
      case 'xl':
        return 'text-xl';
      default:
        return 'text-base';
    }
  };

  const handleQuestionJump = (index: number) => {
    setCurrentQIndex(index);
    if (window.innerWidth < 1024) setShowSidebar(false);
  };

  // --- Visual Helpers ---
  const getTypeColor = (type: string) => {
    if (type === 'single-choice')
      return {
        ring: 'ring-sky-500',
        border: 'border-sky-500',
        bg: 'bg-sky-500',
        light: 'bg-sky-900/40',
        text: 'text-sky-400',
      };
    if (type === 'multi-select')
      return {
        ring: 'ring-violet-500',
        border: 'border-violet-500',
        bg: 'bg-violet-500',
        light: 'bg-violet-900/40',
        text: 'text-violet-400',
      };
    return {
      ring: 'ring-slate-500',
      border: 'border-slate-500',
      bg: 'bg-slate-500',
      light: 'bg-slate-900/40',
      text: 'text-slate-300',
    };
  };

  if (status === 'loading')
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950">
        <Loader2 className="w-10 h-10 animate-spin text-sky-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-100">
          Preparing your exam environment...
        </h2>
        <p className="text-xs text-slate-500 mt-2">
          Please do not refresh or close this window.
        </p>
      </div>
    );

  if (status === 'error')
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-950">
        <AlertOctagon className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-100 mb-2">
          Error Loading Exam
        </h2>
        <p className="text-slate-400 mb-6">{errorMessage}</p>
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-50 rounded-lg border border-slate-600"
        >
          Go Back
        </button>
      </div>
    );

  const currentQ = questions[currentQIndex];
  if (!currentQ) return null;

  // Filter palette questions by active section + paletteFilter
  const filteredQuestions = questions
    .map((q, idx) => ({
      ...q,
      originalIdx: idx,
      _section: getSectionName(q),
    }))
    .filter(q => {
      if (activeSection && q._section !== activeSection) return false;
      if (paletteFilter === 'unanswered') return !answers[q.id];
      if (paletteFilter === 'marked')
        return markedForReview.has(q.id);
      return true;
    });

  const progressPercent =
    (Object.keys(answers).length / questions.length) * 100;
  const typeColors = getTypeColor(currentQ.type);

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* HEADER */}
      <header className="h-16 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between px-3 lg:px-6 shadow-sm z-30 relative">
        {/* Left: Brand + Exam title */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-md bg-slate-950 border border-slate-700 flex flex-col justify-center">
            <span className="text-[10px] font-semibold text-slate-400 leading-none">
              ONLINE
            </span>
            <span className="text-xs font-bold tracking-wide text-slate-50 leading-tight">
              ASSESSMENT
            </span>
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xs uppercase text-slate-500 font-semibold">
              Exam
            </span>
            <h1 className="font-semibold text-sm text-slate-100 max-w-xs truncate">
              {exam.title}
            </h1>
          </div>
        </div>

        {/* Center: Timer + Save status */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-sm font-semibold border shadow-inner transition-colors
            ${timeLeft < 300
                ? 'bg-rose-900/40 border-rose-700 text-rose-100'
                : timeLeft < 900
                  ? 'bg-amber-900/40 border-amber-700 text-amber-100'
                  : 'bg-slate-900/70 border-slate-700 text-slate-100'
              }`}
          >
            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
          </div>

          {saveStatus === 'saving' ? (
            <div className="flex items-center gap-1 text-xs text-amber-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving</span>
            </div>
          ) : saveStatus === 'error' ? (
            <div className="flex items-center gap-1 text-xs text-rose-300">
              <WifiOff className="w-4 h-4 animate-pulse" />
              <span>Offline</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-emerald-300">
              <CloudCheck className="w-4 h-4" />
              <span>Saved</span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Question paper button */}
          <button
            onClick={() => setShowQuestionPaper(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-100 text-xs font-medium hover:bg-slate-800"
          >
            <FileText className="w-4 h-4 text-sky-300" />
            Question Paper
          </button>

          {/* Font controls */}
          <div className="hidden sm:flex items-center bg-slate-900 border border-slate-700 rounded-md">
            <button
              onClick={() =>
                setTextSize(s =>
                  s === 'xl' ? 'lg' : s === 'lg' ? 'base' : 'sm',
                )
              }
              className="px-2 py-1 hover:bg-slate-800 rounded-l-md transition disabled:opacity-30"
              disabled={textSize === 'sm'}
              title="Decrease font size"
            >
              <Type className="w-3 h-3 text-slate-300" />
            </button>
            <div className="w-px h-4 bg-slate-700" />
            <button
              onClick={() =>
                setTextSize(s =>
                  s === 'sm' ? 'base' : s === 'base' ? 'lg' : 'xl',
                )
              }
              className="px-2 py-1 hover:bg-slate-800 rounded-r-md transition disabled:opacity-30"
              disabled={textSize === 'xl'}
              title="Increase font size"
            >
              <Type className="w-4 h-4 text-slate-100" />
            </button>
          </div>

          {/* Sidebar toggle (mobile) */}
          <button
            className="p-2 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors lg:hidden"
            onClick={() => setShowSidebar(!showSidebar)}
            title={
              showSidebar
                ? 'Hide Question Palette'
                : 'Show Question Palette'
            }
          >
            {showSidebar ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Progress line */}
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-900">
          <div
            className="h-full bg-sky-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* CANDIDATE BAR + SECTION TABS */}
      <div className="bg-slate-950 border-b border-slate-900 px-3 lg:px-6 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] md:text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300">
          <span className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-sky-300" />
            <span className="font-medium">
              {candidate?.name || 'Candidate Name'}
            </span>
          </span>
          <span className="text-slate-400">
            ID:{' '}
            <span className="font-medium">
              {candidate?.candidateId || 'ID-000000'}
            </span>
          </span>
          <span className="text-slate-400">
            Center:{' '}
            <span className="font-medium">
              {candidate?.center || 'Exam Center'}
            </span>
          </span>
        </div>

        {/* Section tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
          {sections.map(sec => (
            <button
              key={sec}
              onClick={() => {
                setActiveSection(sec);
                const idx = questions.findIndex(
                  q => getSectionName(q) === sec,
                );
                if (idx !== -1) setCurrentQIndex(idx);
              }}
              className={`px-3 py-1.5 whitespace-nowrap rounded-md border text-[11px] font-semibold transition
                ${activeSection === sec
                  ? 'bg-sky-700/80 border-sky-400 text-slate-50'
                  : 'bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900'
                }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* WARNING BANNER */}
      {(!isFullScreen || warnings > 0) && (
        <div className="bg-slate-900 border-b border-amber-500 text-amber-100 px-4 py-2 text-xs md:text-sm font-medium flex justify-between items-center z-20">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <span>
              Warnings:{' '}
              <span className="font-semibold">{warnings}</span> /{' '}
              {MAX_WARNINGS}
            </span>
            {!isFullScreen && (
              <span className="hidden sm:inline text-rose-200 font-semibold ml-2">
                Fullscreen is mandatory.
              </span>
            )}
          </div>
          {!isFullScreen && (
            <button
              onClick={requestFullScreen}
              className="bg-sky-600 hover:bg-sky-500 text-white border border-sky-400 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
            >
              <Maximize2 className="w-3 h-3" /> Re-enter Fullscreen
            </button>
          )}
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {/* MAIN CONTENT */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Fullscreen blocker */}
          {!isFullScreen && (
            <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
              <div className="mb-5 flex items-center justify-center">
                <div className="bg-rose-900/60 p-4 rounded-full border border-rose-700">
                  <AlertOctagon className="w-10 h-10 text-rose-300" />
                </div>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-50 mb-2">
                Assessment Paused
              </h1>
              <p className="text-slate-400 mb-6 max-w-md text-sm">
                The test is paused because fullscreen mode was exited.
                Please return to fullscreen to continue your exam.
              </p>
              <button
                onClick={requestFullScreen}
                className="bg-sky-600 hover:bg-sky-500 text-white px-8 py-2.5 rounded-md font-semibold shadow-sm border border-sky-400"
              >
                Resume in Fullscreen
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-5">
              {/* QUESTION CARD */}
              <div
                className={`rounded-xl border border-slate-800 bg-slate-900/70 shadow-sm overflow-hidden ${markedForReview.has(currentQ.id)
                  ? 'outline outline-2 outline-violet-500/70'
                  : ''
                  }`}
              >
                {/* Question header bar */}
                <div className="px-4 md:px-6 py-3 border-b border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <h2 className="text-lg md:text-xl font-semibold text-slate-50">
                        Question {currentQIndex + 1}
                      </h2>
                      <span className="text-xs text-slate-500">
                        of {questions.length}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold border ${currentQ.complexity === 'hard'
                          ? 'bg-rose-950/50 text-rose-200 border-rose-700'
                          : currentQ.complexity === 'medium'
                            ? 'bg-amber-950/40 text-amber-200 border-amber-700'
                            : 'bg-emerald-950/40 text-emerald-200 border-emerald-700'
                          }`}
                      >
                        {currentQ.complexity || 'easy'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 ${currentQ.type === 'multi-select'
                          ? 'bg-violet-950/40 text-violet-200 border-violet-700'
                          : 'bg-sky-950/40 text-sky-200 border-sky-700'
                          }`}
                      >
                        {currentQ.type === 'multi-select' ? (
                          <ListFilter className="w-3 h-3" />
                        ) : (
                          <Circle className="w-3 h-3" />
                        )}
                        {currentQ.type.replace('-', ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-semibold border border-slate-700 text-slate-200">
                        Marks: {currentQ.points}
                      </span>
                      <span className="px-2 py-0.5 rounded-full font-semibold border border-slate-700 text-slate-300">
                        Section: {getSectionName(currentQ)}
                      </span>
                    </div>
                  </div>

                  {/* Mark for review button */}
                  <button
                    onClick={() => {
                      setMarkedForReview(prev => {
                        const next = new Set(prev);
                        next.has(currentQ.id)
                          ? next.delete(currentQ.id)
                          : next.add(currentQ.id);
                        return next;
                      });
                    }}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs md:text-sm font-semibold border transition ${markedForReview.has(currentQ.id)
                      ? 'bg-violet-900/70 border-violet-600 text-violet-50'
                      : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
                      }`}
                  >
                    <Flag
                      className={`w-4 h-4 ${markedForReview.has(currentQ.id)
                        ? 'fill-violet-300'
                        : ''
                        }`}
                    />
                    {markedForReview.has(currentQ.id)
                      ? 'Marked for Review'
                      : 'Mark for Review'}
                  </button>
                </div>

                {/* Question body */}
                <div className="px-4 md:px-6 lg:px-8 py-6 md:py-7">
                  {/* Question text */}
                  <div className="mb-6">
                    <p
                      className={`leading-relaxed text-slate-100 ${getTextClass()}`}
                    >
                      {currentQ.question_text}
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    {(currentQ.type === 'single-choice' ||
                      currentQ.type === 'multi-select') &&
                      ['A', 'B', 'C', 'D'].map(opt => {
                        const selected = isSelected(
                          currentQ.id,
                          opt,
                          currentQ.type,
                        );
                        const isSingle =
                          currentQ.type === 'single-choice';

                        const cardStyle = selected
                          ? `${typeColors.border} ${typeColors.light} shadow-sm`
                          : 'border-slate-800 bg-slate-900/80 hover:bg-slate-900 hover:border-slate-600';

                        const iconContainerClass = isSingle
                          ? 'rounded-full'
                          : 'rounded-md';
                        const iconStyle = selected
                          ? `${typeColors.bg} ${typeColors.border} text-white`
                          : 'border-slate-600 bg-slate-950 text-slate-400 group-hover:border-sky-500 group-hover:text-sky-300';

                        return (
                          <div
                            key={opt}
                            onClick={() =>
                              handleOptionClick(currentQ.id, opt)
                            }
                            className={`group relative flex items-center p-3.5 md:p-4 rounded-lg border cursor-pointer transition ${cardStyle}`}
                          >
                            <div
                              className={`w-9 h-9 border-2 flex items-center justify-center mr-4 shrink-0 transition ${iconContainerClass} ${iconStyle}`}
                            >
                              {selected ? (
                                isSingle ? (
                                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )
                              ) : (
                                <span className="font-semibold text-sm">
                                  {opt}
                                </span>
                              )}
                            </div>
                            <span
                              className={`font-medium ${getTextClass()} ${selected
                                ? 'text-slate-50'
                                : 'text-slate-200'
                                }`}
                            >
                              {
                                currentQ[
                                `option_${opt.toLowerCase()}` as keyof Question
                                ]
                              }
                            </span>
                          </div>
                        );
                      })}

                    {currentQ.type === 'true-false' &&
                      ['True', 'False'].map(txt => {
                        const val = txt === 'True' ? 'A' : 'B';
                        const selected = isSelected(
                          currentQ.id,
                          val,
                          'single-choice',
                        );
                        return (
                          <button
                            key={txt}
                            onClick={() =>
                              handleOptionClick(currentQ.id, val)
                            }
                            className={`w-full py-4 px-6 rounded-lg text-left flex items-center gap-4 border-2 transition text-base font-semibold
                              ${selected
                                ? txt === 'True'
                                  ? 'bg-emerald-900/40 border-emerald-500 text-emerald-100'
                                  : 'bg-rose-900/40 border-rose-500 text-rose-100'
                                : 'bg-slate-900/80 border-slate-800 text-slate-200 hover:border-slate-600'
                              }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected
                                ? 'border-current'
                                : 'border-slate-500'
                                }`}
                            >
                              {selected && (
                                <div className="w-2.5 h-2.5 bg-current rounded-full" />
                              )}
                            </div>
                            {txt}
                          </button>
                        );
                      })}

                    {currentQ.type === 'descriptive' && (
                      <textarea
                        value={answers[currentQ.id] || ''}
                        onChange={e => {
                          const newAns = {
                            ...answers,
                            [currentQ.id]: e.target.value,
                          };
                          setAnswers(newAns);
                          if (autoSaveTimerRef.current)
                            clearTimeout(autoSaveTimerRef.current);
                          autoSaveTimerRef.current = setTimeout(
                            () => saveToBackend(newAns),
                            1500,
                          );
                        }}
                        rows={7}
                        className={`w-full p-4 border-2 border-slate-800 rounded-lg bg-slate-950/80 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-600 shadow-sm ${getTextClass()}`}
                        placeholder="Type your answer here..."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM BAR */}
          <div className="h-16 bg-slate-900/95 border-t border-slate-800 px-3 md:px-6 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <button
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex(i => i - 1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-slate-900"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 border-l border-slate-700 pl-3">
                <Keyboard className="w-4 h-4" />
                Use{' '}
                <span className="px-1.5 py-0.5 border border-slate-700 rounded bg-slate-950">
                  ←
                </span>
                <span className="px-1.5 py-0.5 border border-slate-700 rounded bg-slate-950">
                  →
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const newAns = { ...answers };
                  delete newAns[currentQ.id];
                  setAnswers(newAns);
                  saveToBackend(newAns);
                }}
                className="hidden sm:inline-flex text-xs md:text-sm font-medium text-slate-400 hover:text-rose-300 hover:underline"
              >
                Clear Response
              </button>

              <button
                disabled={currentQIndex === questions.length - 1}
                onClick={() => setCurrentQIndex(i => i + 1)}
                className="inline-flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-md font-semibold bg-sky-600 hover:bg-sky-500 text-slate-50 shadow-sm disabled:bg-slate-700 disabled:opacity-60"
              >
                Save & Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>

        {/* SIDEBAR: QUESTION PALETTE */}
        <aside
          className={`fixed inset-y-0 right-0 w-72 bg-slate-950 border-l border-slate-800 transform transition-transform duration-300 z-30 flex flex-col
            ${showSidebar ? 'translate-x-0' : 'translate-x-full'}
            lg:relative lg:translate-x-0`}
        >
          {/* Palette header */}
          <div className="h-14 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/95">
            <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
              <MousePointerClick className="w-4 h-4 text-sky-400" />
              Question Palette
            </h3>
            <button
              className="lg:hidden text-slate-500 hover:text-slate-200"
              onClick={() => setShowSidebar(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Palette filter */}
          <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/90 flex gap-1 text-[11px] font-semibold">
            <button
              onClick={() => setPaletteFilter('all')}
              className={`flex-1 py-1.5 rounded-md ${paletteFilter === 'all'
                ? 'bg-slate-800 text-slate-50'
                : 'text-slate-400 hover:bg-slate-900'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setPaletteFilter('unanswered')}
              className={`flex-1 py-1.5 rounded-md ${paletteFilter === 'unanswered'
                ? 'bg-rose-900/60 text-rose-100'
                : 'text-slate-400 hover:bg-slate-900'
                }`}
            >
              Unanswered
            </button>
            <button
              onClick={() => setPaletteFilter('marked')}
              className={`flex-1 py-1.5 rounded-md ${paletteFilter === 'marked'
                ? 'bg-violet-900/60 text-violet-100'
                : 'text-slate-400 hover:bg-slate-900'
                }`}
            >
              Marked
            </button>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 text-[10px] uppercase font-semibold text-slate-400 grid grid-cols-2 gap-y-2 gap-x-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />{' '}
              Answered
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" />{' '}
              Marked
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />{' '}
              Visited
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-800" /> Not
              Visited
            </div>
          </div>

          {/* Palette grid */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {filteredQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-xs gap-2">
                <Filter className="w-6 h-6 opacity-40" />
                <span>No questions match this filter</span>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2.5">
                {filteredQuestions.map(q => {
                  const idx = (q as any).originalIdx as number;
                  let colorClass =
                    'bg-slate-950 text-slate-300 border border-slate-700 hover:border-sky-500';

                  if (visited.has(q.id))
                    colorClass =
                      'bg-amber-900/40 text-amber-100 border border-amber-700 hover:border-amber-500';
                  if (answers[q.id])
                    colorClass =
                      'bg-emerald-900/50 text-emerald-50 border border-emerald-500 shadow-sm';
                  if (markedForReview.has(q.id))
                    colorClass =
                      'bg-violet-900/50 text-violet-50 border border-violet-500 shadow-sm';

                  if (idx === currentQIndex)
                    colorClass =
                      'bg-sky-900/70 text-sky-50 border border-sky-400 ring-1 ring-sky-500';

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentQIndex(idx);
                        if (window.innerWidth < 1024)
                          setShowSidebar(false);
                      }}
                      className={`aspect-square rounded-md text-xs font-semibold flex items-center justify-center transition ${colorClass}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar footer */}
          <div className="px-4 py-4 border-t border-slate-800 bg-slate-950/95">
            <button
              onClick={() => submitAttempt(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-50 py-2.5 rounded-md font-semibold text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              Review & Submit
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-2">
              {Object.keys(answers).length} of {questions.length} answered
            </p>
          </div>
        </aside>

        {/* Review Modal */}
        <ReviewAndSubmitModal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          onSubmit={() => submitAttempt(true)}
          questions={questions}
          answers={answers}
          markedForReview={markedForReview}
          visited={visited}
          timeLeft={timeLeft}
          warnings={warnings}
          MAX_WARNINGS={MAX_WARNINGS}
          onQuestionJump={handleQuestionJump}
        />

        {/* QUESTION PAPER PANEL */}
        {showQuestionPaper && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
            <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl">
              {/* Header */}
              <div className="px-5 md:px-7 py-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-slate-900 border border-slate-700">
                    <FileText className="w-5 h-5 text-sky-300" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-semibold text-slate-50">
                      Question Paper View
                    </h2>
                    <p className="text-xs text-slate-400">
                      View all questions in text-only format. Click any
                      question to jump to it.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQuestionPaper(false)}
                  className="p-2 rounded-full hover:bg-slate-900 text-slate-400 hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 md:px-7 py-4 space-y-5 text-xs md:text-sm">
                {sections.map(sec => {
                  const secQuestions = questions.filter(
                    q => getSectionName(q) === sec,
                  );
                  if (!secQuestions.length) return null;

                  return (
                    <div key={sec} className="space-y-2">
                      <h3 className="text-sm md:text-base font-semibold text-slate-100 border-b border-slate-800 pb-1">
                        Section: {sec}
                      </h3>
                      <div className="space-y-1.5">
                        {secQuestions.map(q => {
                          const globalIdx = questions.indexOf(q);
                          const answered = !!answers[q.id];
                          const marked =
                            markedForReview.has(q.id);
                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                setCurrentQIndex(globalIdx);
                                setActiveSection(sec);
                                setShowQuestionPaper(false);
                              }}
                              className={`w-full text-left rounded-md px-3 py-2 border transition ${globalIdx === currentQIndex
                                ? 'bg-sky-900/60 border-sky-500 text-sky-50'
                                : 'bg-slate-950 border-slate-800 text-slate-200 hover:bg-slate-900'
                                }`}
                            >
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                                    Q{globalIdx + 1}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {q.type.replace('-', ' ')} •{' '}
                                    {q.points} Marks
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px]">
                                  {answered && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-100 border border-emerald-700">
                                      Answered
                                    </span>
                                  )}
                                  {marked && (
                                    <span className="px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-100 border border-violet-700">
                                      Marked
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-200 line-clamp-2">
                                {q.question_text}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
