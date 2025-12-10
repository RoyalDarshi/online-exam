import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import { useProctoring, requestFullScreen } from '../hooks/useProctoring';
import { Exam, Question } from '../types/models';
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
  XCircle,
  Keyboard,
  MousePointerClick,
  Maximize2,
  Type,
  Filter,
  Circle // Import Circle for radio effect
} from 'lucide-react';

type Props = {
  exam: Exam;
  onComplete: () => void;
  onCancel: () => void;
};

const MAX_WARNINGS = 3;
const SNAPSHOT_INTERVAL = 30000;

export function ExamTaking({ exam, onComplete, onCancel }: Props) {
  // --- State ---
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [visited, setVisited] = useState<Set<string>>(new Set());

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const [status, setStatus] = useState<'loading' | 'idle' | 'active' | 'submitting' | 'error'>('loading');
  const [warnings, setWarnings] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preferences
  const [textSize, setTextSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('base');
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'unanswered' | 'marked'>('all');

  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const answersRef = useRef(answers);
  const warningsRef = useRef(warnings);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { warningsRef.current = warnings; }, [warnings]);

  useEffect(() => {
    if (window.innerWidth < 1024) setShowSidebar(false);
  }, []);

  // --- 1. API: Start Exam ---
  useEffect(() => {
    let isMounted = true;
    async function initExam() {
      try {
        const examRes = await api.get(`/exams/${exam.id}`);
        if (!isMounted) return;

        const qs = examRes.data.questions || [];
        setQuestions(qs);
        if (qs.length > 0) setVisited(new Set([qs[0].id]));

        const attemptRes = await api.post('/attempts/start', { exam_id: exam.id });
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
          try { await requestFullScreen(); } catch (e) { /* user denied */ }
        }

        setStatus('active');
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.response?.data?.error || "Failed to load exam.");
          setStatus('error');
        }
      }
    }
    initExam();
    return () => { isMounted = false; };
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

  // --- 3. Timer & Keyboard ---
  useEffect(() => {
    if (status !== 'active') return;
    if (timeLeft <= 0) {
      if (timeLeft === 0 && questions.length > 0) submitAttempt(true, 'Time Limit');
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') setCurrentQIndex(prev => Math.min(prev + 1, questions.length - 1));
      if (e.key === 'ArrowLeft') setCurrentQIndex(prev => Math.max(0, prev - 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [timeLeft, status, questions.length]);

  // --- 4. Save & Proctoring ---
  const saveToBackend = useCallback(async (currentAnswers: Record<string, string>) => {
    if (!attemptId) return;
    setSaveStatus('saving');
    try {
      await api.post('/progress', {
        attempt_id: attemptId,
        tab_switches: warningsRef.current,
        answers: currentAnswers,
        snapshot: ""
      });
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
    }
  }, [attemptId]);

  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => saveToBackend(answersRef.current), SNAPSHOT_INTERVAL);
    return () => clearInterval(interval);
  }, [status, saveToBackend]);

  const handleViolation = useCallback((type: string) => {
    if (status !== 'active') return;
    setWarnings(prev => {
      const newW = prev + 1;
      saveToBackend(answersRef.current);
      if (newW >= MAX_WARNINGS) submitAttempt(true, `Violation: ${type}`);
      return newW;
    });
  }, [status, saveToBackend]);

  useProctoring({ isActive: status === 'active', onViolation: handleViolation });

  useEffect(() => {
    const fsHandler = () => {
      const full = !!document.fullscreenElement;
      setIsFullScreen(full);
      if (!full && status === 'active') handleViolation('fullscreen_exit');
    };
    document.addEventListener('fullscreenchange', fsHandler);
    return () => document.removeEventListener('fullscreenchange', fsHandler);
  }, [status, handleViolation]);

  // --- 5. Interactions ---
  const handleOptionClick = (qId: string, opt: string) => {
    if (status !== 'active') return;
    const q = questions.find(q => q.id === qId);
    if (!q) return;

    let newVal = "";
    if (q.type === 'multi-select') {
      const currentRaw = answers[qId] || "";
      let currentOpts = currentRaw ? currentRaw.split(',') : [];
      if (currentOpts.includes(opt)) currentOpts = currentOpts.filter(o => o !== opt);
      else currentOpts.push(opt);
      newVal = currentOpts.sort().join(',');
    } else {
      newVal = opt;
    }

    const newAnswers = { ...answers, [qId]: newVal };
    setAnswers(newAnswers);

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => saveToBackend(newAnswers), 1000);
  };

  const submitAttempt = async (forced: boolean, reason?: string) => {
    if (status === 'submitting') return;
    if (!forced && !window.confirm("Are you sure you want to finish the exam?")) return;
    setStatus('submitting');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await saveToBackend(answers);
    try {
      await api.post('/attempts/submit', { attempt_id: attemptId });
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      onComplete();
    } catch (e) {
      setErrorMessage("Submission failed. Please check connection.");
      setStatus('active');
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const isSelected = (qId: string, opt: string, type: string) => {
    const val = answers[qId];
    if (!val) return false;
    if (type === 'multi-select') return val.split(',').includes(opt);
    return val === opt;
  };

  const getTextClass = () => {
    switch (textSize) {
      case 'sm': return 'text-sm';
      case 'lg': return 'text-xl';
      case 'xl': return 'text-2xl';
      default: return 'text-lg';
    }
  };

  // --- Visual Helpers ---
  const getTypeColor = (type: string) => {
    if (type === 'single-choice') return { ring: 'ring-blue-600', border: 'border-blue-600', bg: 'bg-blue-600', light: 'bg-blue-50/50', text: 'text-blue-600' };
    if (type === 'multi-select') return { ring: 'ring-purple-600', border: 'border-purple-600', bg: 'bg-purple-600', light: 'bg-purple-50/50', text: 'text-purple-600' };
    return { ring: 'ring-slate-600', border: 'border-slate-600', bg: 'bg-slate-600', light: 'bg-slate-50', text: 'text-slate-600' };
  };

  if (status === 'loading') return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
      <h2 className="text-xl font-semibold text-gray-700">Loading Exam Environment...</h2>
    </div>
  );

  if (status === 'error') return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <AlertOctagon className="w-12 h-12 text-rose-600 mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Exam</h2>
      <p className="text-gray-600 mb-6">{errorMessage}</p>
      <button onClick={onCancel} className="px-6 py-2 bg-gray-800 text-white rounded-lg">Go Back</button>
    </div>
  );

  const currentQ = questions[currentQIndex];
  if (!currentQ) return null;

  const filteredQuestions = questions.map((q, idx) => ({ ...q, originalIdx: idx })).filter(q => {
    if (paletteFilter === 'unanswered') return !answers[q.id];
    if (paletteFilter === 'marked') return markedForReview.has(q.id);
    return true;
  });

  const progressPercent = ((Object.keys(answers).length) / questions.length) * 100;
  const typeColors = getTypeColor(currentQ.type);

  return (
    <div className="h-screen flex flex-col bg-[#F3F4F6] font-sans text-slate-900 overflow-hidden">

      {/* 1. HEADER */}
      <header className="h-16 bg-white/90 backdrop-blur-md border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 shadow-sm z-30 shrink-0 relative">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-2 rounded-lg shadow-md flex items-center justify-center">
            <span className="font-bold text-white leading-none tracking-widest text-xs">EXAM</span>
          </div>
          <h1 className="hidden md:block font-bold text-slate-700 text-lg truncate max-w-xs">{exam.title}</h1>
        </div>

        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-lg font-bold border shadow-inner transition-colors
               ${timeLeft < 300 ? 'bg-rose-50 border-rose-200 text-rose-600 animate-pulse' : 'bg-gray-50 border-gray-200 text-slate-700'}`}>
            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
          </div>

          {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 text-amber-500 animate-spin" title="Saving..." /> :
            saveStatus === 'error' ? <WifiOff className="w-4 h-4 text-rose-500 animate-pulse" title="Offline" /> :
              <CloudCheck className="w-4 h-4 text-emerald-500" title="Saved" />}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => setTextSize(s => s === 'xl' ? 'lg' : s === 'lg' ? 'base' : 'sm')}
              className="p-1.5 hover:bg-white hover:shadow-sm rounded transition disabled:opacity-30"
              disabled={textSize === 'sm'}
              title="Decrease Font Size"
            >
              <Type className="w-3 h-3" />
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1"></div>
            <button
              onClick={() => setTextSize(s => s === 'sm' ? 'base' : s === 'base' ? 'lg' : 'xl')}
              className="p-1.5 hover:bg-white hover:shadow-sm rounded transition disabled:opacity-30"
              disabled={textSize === 'xl'}
              title="Increase Font Size"
            >
              <Type className="w-4 h-4" />
            </button>
          </div>
          <button
            className={`p-2 rounded-lg transition-colors ${showSidebar ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-gray-100'}`}
            onClick={() => setShowSidebar(!showSidebar)}
            title={showSidebar ? "Hide Sidebar" : "Show Question Map"}
          >
            {showSidebar ? <Maximize2 className="w-5 h-5" /> : <ListFilter className="w-5 h-5" />}
          </button>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gray-100">
          <div className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      {/* 2. WARNING BANNER */}
      {(!isFullScreen || warnings > 0) && (
        <div className="bg-rose-600 text-white px-4 py-2 text-sm font-bold flex justify-between items-center z-20 shadow-md animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Warnings: {warnings}/{MAX_WARNINGS}</span>
            {!isFullScreen && <span className="hidden sm:inline"> | Fullscreen required!</span>}
          </div>
          {!isFullScreen && (
            <button onClick={requestFullScreen} className="bg-white/10 hover:bg-white/20 text-white border border-white/30 px-3 py-1 rounded text-xs uppercase font-bold transition flex items-center gap-2">
              <Maximize2 className="w-3 h-3" /> Fullscreen
            </button>
          )}
        </div>
      )}

      {/* 3. MAIN WORKSPACE */}
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-[#F8FAFC]">

          {!isFullScreen && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
              <div className="bg-rose-50 p-6 rounded-full mb-4 ring-4 ring-rose-100 animate-pulse"><AlertOctagon className="w-12 h-12 text-rose-500" /></div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Assessment Paused</h1>
              <p className="text-slate-500 mb-6 max-w-sm">Focus mode is mandatory. Return to fullscreen to continue.</p>
              <button onClick={requestFullScreen} className="bg-slate-900 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-slate-800 transition-all">Resume Assessment</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 scroll-smooth">
            <div className="max-w-4xl mx-auto space-y-6">

              <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300
                 ${markedForReview.has(currentQ.id) ? 'ring-2 ring-purple-400 ring-offset-2' : ''}`}>

                <div className="bg-gray-50/80 border-b border-gray-100 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-2xl font-bold text-slate-800">Question {currentQIndex + 1}</h2>
                      <span className="text-sm font-medium text-slate-400">of {questions.length}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border
                               ${currentQ.complexity === 'Hard' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          currentQ.complexity === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {currentQ.complexity || 'Easy'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border flex items-center gap-1.5
                                ${currentQ.type === 'multi-select' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {currentQ.type === 'multi-select' ? <ListFilter className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                        {currentQ.type.replace('-', ' ')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wide border bg-slate-100 text-slate-700 border-slate-200">
                        +{currentQ.points} Pts
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMarkedForReview(prev => {
                        const next = new Set(prev);
                        next.has(currentQ.id) ? next.delete(currentQ.id) : next.add(currentQ.id);
                        return next;
                      });
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition border shadow-sm active:scale-95
                        ${markedForReview.has(currentQ.id)
                        ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'}`}
                  >
                    <Flag className={`w-4 h-4 ${markedForReview.has(currentQ.id) ? 'fill-current' : ''}`} />
                    {markedForReview.has(currentQ.id) ? 'Marked' : 'Mark for Review'}
                  </button>
                </div>

                <div className="p-6 md:p-8 lg:p-10">
                  <div className="prose prose-slate max-w-none mb-10">
                    <p className={`leading-relaxed text-slate-800 font-medium ${getTextClass()}`}>{currentQ.question_text}</p>
                  </div>

                  <div className="space-y-3">
                    {(currentQ.type === "single-choice" || currentQ.type === "multi-select") &&
                      ["A", "B", "C", "D"].map((opt) => {
                        const selected = isSelected(currentQ.id, opt, currentQ.type);

                        // Visuals: Single (Radio) vs Multi (Checkbox)
                        const isSingle = currentQ.type === 'single-choice';

                        // Card Styling
                        const cardStyle = selected
                          ? `${typeColors.border} ${typeColors.light} shadow-sm z-10`
                          : `border-slate-200 hover:border-slate-300 bg-white hover:shadow-md hover:-translate-y-0.5`;

                        // Icon Styling (Circle vs Square)
                        const iconContainerClass = isSingle ? 'rounded-full' : 'rounded-lg';
                        const iconStyle = selected
                          ? `${typeColors.bg} ${typeColors.border} text-white scale-110`
                          : `border-slate-300 bg-slate-50 text-slate-400 group-hover:bg-white group-hover:${typeColors.border} group-hover:${typeColors.text}`;

                        return (
                          <div
                            key={opt}
                            onClick={() => handleOptionClick(currentQ.id, opt)}
                            className={`group relative flex items-center p-4 md:p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ease-out ${cardStyle}`}
                          >
                            <div className={`w-10 h-10 border-2 flex items-center justify-center mr-5 shrink-0 transition-all duration-200 ${iconContainerClass} ${iconStyle}`}>
                              {selected ? (
                                isSingle ? <div className="w-2.5 h-2.5 bg-white rounded-full" /> : <Check className="w-5 h-5" />
                              ) : (
                                <span className="font-bold text-lg">{opt}</span>
                              )}
                            </div>
                            <span className={`font-medium transition-colors ${selected ? 'text-slate-900' : 'text-slate-600'} ${getTextClass()}`}>
                              {currentQ[`option_${opt.toLowerCase()}` as keyof Question]}
                            </span>
                          </div>
                        );
                      })}

                    {currentQ.type === "true-false" && ["True", "False"].map((txt) => {
                      const val = txt === "True" ? "A" : "B";
                      const selected = isSelected(currentQ.id, val, "single-choice");
                      return (
                        <button
                          key={txt}
                          onClick={() => handleOptionClick(currentQ.id, val)}
                          className={`w-full py-5 px-8 rounded-xl font-bold text-xl border-2 transition-all text-left flex items-center gap-4 hover:shadow-md hover:-translate-y-0.5
                                    ${selected
                              ? txt === "True" ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm" : "bg-rose-50 border-rose-500 text-rose-800 shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:border-blue-400"
                            }`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-current scale-110' : 'border-slate-300'}`}>
                            {selected && <div className="w-3 h-3 bg-current rounded-full" />}
                          </div>
                          {txt}
                        </button>
                      );
                    })}

                    {currentQ.type === "descriptive" && (
                      <textarea
                        value={answers[currentQ.id] || ""}
                        onChange={(e) => {
                          const newAns = { ...answers, [currentQ.id]: e.target.value };
                          setAnswers(newAns);
                          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
                          autoSaveTimerRef.current = setTimeout(() => saveToBackend(newAns), 1500);
                        }}
                        rows={8}
                        className={`w-full p-5 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition shadow-sm resize-none text-slate-700 placeholder-slate-400 ${getTextClass()}`}
                        placeholder="Type your answer here..."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-20 bg-white border-t border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)] z-20">
            <div className="flex items-center gap-4">
              <button
                disabled={currentQIndex === 0}
                onClick={() => setCurrentQIndex(i => i - 1)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent transition"
              >
                <ChevronLeft className="w-5 h-5" /> Previous
              </button>

              <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-medium px-4 border-l border-slate-200 h-8">
                <Keyboard className="w-4 h-4" /> Use <span className="bg-slate-100 border border-slate-200 rounded px-1">←</span> <span className="bg-slate-100 border border-slate-200 rounded px-1">→</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const newAns = { ...answers };
                  delete newAns[currentQ.id];
                  setAnswers(newAns);
                  saveToBackend(newAns);
                }}
                className="hidden sm:block text-sm font-semibold text-slate-400 hover:text-rose-500 transition hover:underline"
              >
                Clear
              </button>

              <button
                disabled={currentQIndex === questions.length - 1}
                onClick={() => setCurrentQIndex(i => i + 1)}
                className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none transition transform active:scale-95"
              >
                Next <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </main>

        <aside className={`fixed inset-y-0 right-0 w-80 bg-white border-l shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${showSidebar ? 'translate-x-0' : 'translate-x-full'} lg:relative lg:translate-x-0 ${!showSidebar ? 'lg:hidden' : ''}`}>

          <div className="p-4 border-b border-slate-100 flex justify-between items-center h-16 shrink-0 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-blue-500" /> Question Palette
            </h3>
            <button className="lg:hidden text-slate-400 hover:text-slate-600 p-1" onClick={() => setShowSidebar(false)}><X className="w-5 h-5" /></button>
          </div>

          <div className="p-2 bg-white border-b border-slate-100 flex gap-1">
            <button onClick={() => setPaletteFilter('all')} className={`flex-1 py-1.5 text-xs font-bold rounded ${paletteFilter === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}>All</button>
            <button onClick={() => setPaletteFilter('unanswered')} className={`flex-1 py-1.5 text-xs font-bold rounded ${paletteFilter === 'unanswered' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`}>Unanswered</button>
            <button onClick={() => setPaletteFilter('marked')} className={`flex-1 py-1.5 text-xs font-bold rounded ${paletteFilter === 'marked' ? 'bg-purple-50 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}>Marked</button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] uppercase font-bold text-slate-500 p-3 bg-white border-b border-slate-100">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Answered</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-purple-500" /> Marked</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-400" /> Visited</div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-200" /> Unseen</div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-200">
            {filteredQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm"><Filter className="w-8 h-8 mb-2 opacity-20" /> No questions found</div>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                {filteredQuestions.map((q) => {
                  const idx = q.originalIdx;
                  let colorClass = 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'; // Default

                  if (visited.has(q.id)) colorClass = 'bg-amber-50 text-amber-700 border-amber-200'; // Visited (Skipped)
                  if (answers[q.id]) colorClass = 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-200'; // Answered
                  if (markedForReview.has(q.id)) colorClass = 'bg-purple-500 text-white border-purple-500 shadow-purple-200'; // Marked

                  if (idx === currentQIndex) colorClass = 'ring-2 ring-blue-500 border-transparent bg-blue-50 text-blue-700 font-extrabold';

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentQIndex(idx);
                        if (window.innerWidth < 1024) setShowSidebar(false);
                      }}
                      className={`aspect-square rounded-lg text-sm font-bold border transition-all flex items-center justify-center relative shadow-sm hover:shadow-md active:scale-95 ${colorClass}`}
                    >
                      {idx + 1}
                      {markedForReview.has(q.id) && !answers[q.id] && idx !== currentQIndex && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-slate-100 bg-slate-50">
            <button onClick={() => submitAttempt(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3.5 rounded-xl font-bold transition shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Submit Exam
            </button>
            <p className="text-center text-xs text-slate-400 mt-3 font-medium">
              {Object.keys(answers).length} of {questions.length} questions answered
            </p>
          </div>
        </aside>

      </div>
    </div>
  );
}