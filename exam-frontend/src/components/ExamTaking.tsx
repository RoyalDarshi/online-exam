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
  CloudCheck, // Make sure to import these icons or similar ones
  WifiOff
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

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const [status, setStatus] = useState<'loading' | 'idle' | 'active' | 'submitting' | 'error'>('loading');
  const [warnings, setWarnings] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- NEW: Connection Status & Smart Save ---
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Refs (For Performance) ---
  const answersRef = useRef(answers);
  const warningsRef = useRef(warnings);

  // Sync refs with state
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { warningsRef.current = warnings; }, [warnings]);

  // --- 1. API: Start Exam ---
  useEffect(() => {
    let isMounted = true;

    async function initExam() {
      try {
        // 1. Get Questions
        const examRes = await api.get(`/exams/${exam.id}`);
        if (!isMounted) return;
        if (examRes.data.questions) setQuestions(examRes.data.questions);

        // 2. Start/Resume Attempt
        const attemptRes = await api.post('/attempts/start', { exam_id: exam.id });
        if (!isMounted) return;

        const attempt = attemptRes.data;
        setAttemptId(attempt.id);

        // Resume state
        if (attempt.answers) setAnswers(attempt.answers);
        if (attempt.time_left) setTimeLeft(attempt.time_left);
        if (attempt.tab_switches) setWarnings(attempt.tab_switches);

        // Check if already done
        if (attempt.submitted_at || attempt.is_terminated) {
          onComplete();
          return;
        }

        // Fullscreen check
        if (!document.fullscreenElement) {
          try { await requestFullScreen(); } catch (e) { /* user denied */ }
        }

        setStatus('active');
      } catch (err: any) {
        console.error('Failed to start:', err);
        if (isMounted) {
          setErrorMessage(err.response?.data?.error || "Failed to load exam.");
          setStatus('error');
        }
      }
    }

    initExam();
    return () => { isMounted = false; };
  }, [exam.id, onComplete]);

  // --- TIMER ---
  useEffect(() => {
    if (status !== 'active') return;

    if (timeLeft <= 0) {
      if (timeLeft === 0 && questions.length > 0) submitAttempt(true, 'Time Limit');
      return;
    }

    const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, status, questions.length]);


  // --- SMART SAVE FUNCTION ---
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
      console.error("Save failed", err);
      setSaveStatus('error');
    }
  }, [attemptId]);

  // --- BACKGROUND INTERVAL (Backup) ---
  // Even with smart save, we keep a 30s backup interval just in case
  useEffect(() => {
    if (status !== 'active') return;
    const interval = setInterval(() => {
      saveToBackend(answersRef.current);
    }, SNAPSHOT_INTERVAL);
    return () => clearInterval(interval);
  }, [status, saveToBackend]);


  // --- PROCTORING ---
  const handleViolation = useCallback((type: string) => {
    if (status !== 'active') return;

    setWarnings(prev => {
      const newW = prev + 1;
      // Immediate report on violation
      saveToBackend(answersRef.current);
      if (newW >= MAX_WARNINGS) submitAttempt(true, `Violation: ${type}`);
      return newW;
    });
  }, [status, saveToBackend]);

  useProctoring({
    isActive: status === 'active',
    onViolation: handleViolation
  });

  useEffect(() => {
    const fsHandler = () => {
      const full = !!document.fullscreenElement;
      setIsFullScreen(full);
      if (!full && status === 'active') handleViolation('fullscreen_exit');
    };
    document.addEventListener('fullscreenchange', fsHandler);
    return () => document.removeEventListener('fullscreenchange', fsHandler);
  }, [status, handleViolation]);


  // --- INTERACTION HANDLERS ---

  const handleOptionClick = (qId: string, opt: string) => {
    if (status !== 'active') return;

    const q = questions.find(q => q.id === qId);
    if (!q) return;

    let newVal = "";

    // Toggle Logic (Multi) or Replace Logic (Single)
    if (q.type === 'multi-select') {
      const currentRaw = answers[qId] || "";
      let currentOpts = currentRaw ? currentRaw.split(',') : [];

      if (currentOpts.includes(opt)) {
        currentOpts = currentOpts.filter(o => o !== opt);
      } else {
        currentOpts.push(opt);
      }
      newVal = currentOpts.sort().join(',');
    } else {
      newVal = opt;
    }

    // 1. Update Local State Immediately (Fast UI)
    const newAnswers = { ...answers, [qId]: newVal };
    setAnswers(newAnswers);

    // 2. Debounce Save (Wait 1s before sending to server)
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      saveToBackend(newAnswers);
    }, 1000);
  };

  const handleSaveAndNext = async () => {
    // 1. Cancel pending debounce (we are saving NOW)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    // 2. Immediate Save
    await saveToBackend(answers);

    // 3. Navigate
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(i => i + 1);
    }
  };

  const submitAttempt = async (forced: boolean, reason?: string) => {
    if (status === 'submitting') return;
    if (!forced && !window.confirm("Are you sure you want to finish the exam?")) return;

    setStatus('submitting');

    // Final Save
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    await saveToBackend(answers);

    try {
      await api.post('/attempts/submit', { attempt_id: attemptId });
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      onComplete();
    } catch (e) {
      setErrorMessage("Submission failed. Please check connection.");
      setStatus('active'); // Allow retry
    }
  };

  // --- RENDER HELPERS ---
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

  const currentQ = questions[currentQIndex];

  // --- RENDER ---
  if (status === 'loading') return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
      <h2 className="text-xl font-semibold text-gray-700">Loading Exam Environment...</h2>
    </div>
  );

  if (status === 'error') return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <AlertOctagon className="w-12 h-12 text-red-600 mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Exam</h2>
      <p className="text-gray-600 mb-6">{errorMessage}</p>
      <button onClick={onCancel} className="px-6 py-2 bg-gray-800 text-white rounded-lg">Go Back</button>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 font-sans overflow-hidden">

      {/* HEADER */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 shadow-md z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 p-2 rounded">
            <span className="font-bold text-slate-300 block leading-none text-xs">EXAM</span>
            <span className="font-bold">{exam.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Status Indicator */}
          <div className="flex items-center gap-2 text-sm font-medium">
            {saveStatus === 'saving' && (
              <span className="text-yellow-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-green-400 flex items-center gap-1">
                <CloudCheck className="w-4 h-4" /> Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-400 flex items-center gap-1 animate-pulse">
                <WifiOff className="w-4 h-4" /> Offline
              </span>
            )}
          </div>

          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-lg font-bold border 
                    ${timeLeft < 300 ? 'bg-red-900/50 border-red-500 text-red-100' : 'bg-slate-800 border-slate-700'}`}>
            <Clock className="w-5 h-5" /> {formatTime(timeLeft)}
          </div>

          <button
            onClick={() => submitAttempt(false)}
            className="hidden md:block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-bold transition shadow-lg shadow-green-900/20"
          >
            Submit Exam
          </button>

          <button className="md:hidden p-2" onClick={() => setShowSidebar(!showSidebar)}>
            {showSidebar ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* WARNING BANNER */}
      {(!isFullScreen || warnings > 0) && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-bold flex justify-between items-center z-20">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Warnings: {warnings}/{MAX_WARNINGS}</span>
            {!isFullScreen && <span> | Fullscreen required!</span>}
          </div>
          {!isFullScreen && (
            <button onClick={requestFullScreen} className="bg-white text-red-600 px-3 py-1 rounded text-xs uppercase hover:bg-gray-100">
              Fix Now
            </button>
          )}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden relative">
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">

          {/* Fullscreen Blocker */}
          {!isFullScreen && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur flex flex-col items-center justify-center text-center p-4">
              <AlertOctagon className="w-16 h-16 text-red-500 mb-4 animate-pulse" />
              <h1 className="text-2xl font-bold text-gray-900">Exam Paused</h1>
              <p className="text-gray-500 mb-6">Please return to Fullscreen mode to continue.</p>
              <button onClick={requestFullScreen} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg">Resume</button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
              {/* Question Header */}
              <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-200">
                <div>
                  <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Question {currentQIndex + 1}</span>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm font-semibold text-gray-600">Marks: <span className="text-green-600">+{currentQ.points}</span></span>
                    {exam.enable_negative_marking && (
                      <span className="text-sm font-semibold text-gray-600">Neg: <span className="text-red-500">-{currentQ.negative_points}</span></span>
                    )}
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
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition
                            ${markedForReview.has(currentQ.id)
                      ? 'bg-purple-100 text-purple-700 border border-purple-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  <Flag className={`w-4 h-4 ${markedForReview.has(currentQ.id) ? 'fill-purple-700' : ''}`} />
                  {markedForReview.has(currentQ.id) ? 'Marked' : 'Mark for Review'}
                </button>
              </div>

              {/* Question Text */}
              <div className="prose max-w-none mb-8">
                <p className="text-xl text-gray-800 font-medium leading-relaxed">{currentQ.question_text}</p>
              </div>

              {/* Options Area */}
              <div className="grid gap-4">
                {(currentQ.type === "single-choice" || currentQ.type === "multi-select") &&
                  ["A", "B", "C", "D"].map((opt) => (
                    <div
                      key={opt}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOptionClick(currentQ.id, opt)}
                      className={`group flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${isSelected(currentQ.id, opt, currentQ.type)
                          ? `border-${currentQ.type === 'single-choice' ? 'blue' : 'purple'}-600 bg-${currentQ.type === 'single-choice' ? 'blue' : 'purple'}-50 ring-1`
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      <div className={`w-6 h-6 rounded-${currentQ.type === 'single-choice' ? 'full' : 'md'} border-2 flex items-center justify-center mr-4
                        ${isSelected(currentQ.id, opt, currentQ.type)
                          ? `border-${currentQ.type === 'single-choice' ? 'blue' : 'purple'}-600 bg-${currentQ.type === 'single-choice' ? 'blue' : 'purple'}-600 text-white`
                          : 'border-gray-400 bg-white'}`}>
                        {isSelected(currentQ.id, opt, currentQ.type) && (
                          currentQ.type === 'single-choice' ? <div className="w-2.5 h-2.5 bg-white rounded-full" /> : <Check className="w-4 h-4" />
                        )}
                      </div>
                      <span className="text-gray-700 font-medium text-lg">{currentQ[`option_${opt.toLowerCase()}` as keyof Question]}</span>
                    </div>
                  ))}

                {currentQ.type === "true-false" && ["True", "False"].map((txt) => {
                  const val = txt === "True" ? "A" : "B";
                  const selected = isSelected(currentQ.id, val, "single-choice");
                  return (
                    <button
                      key={txt}
                      onClick={() => handleOptionClick(currentQ.id, val)}
                      className={`w-full py-4 rounded-xl font-bold text-lg border-2 transition-all
                        ${selected
                          ? txt === "True" ? "bg-green-600 text-white border-green-700" : "bg-red-600 text-white border-red-700"
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                        }`}
                    >
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
                      // Debounce save for text input as well
                      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
                      autoSaveTimerRef.current = setTimeout(() => saveToBackend(newAns), 1500);
                    }}
                    rows={6}
                    className="w-full p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    placeholder="Write your answer here..."
                  />
                )}
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="h-20 bg-white border-t px-8 flex items-center justify-between shrink-0">
            <button
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex(i => i - 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>

            <button
              onClick={() => {
                const newAns = { ...answers };
                delete newAns[currentQ.id];
                setAnswers(newAns);
                saveToBackend(newAns);
              }}
              className="text-sm text-gray-400 underline hover:text-red-500"
            >
              Clear Response
            </button>

            <button
              disabled={currentQIndex === questions.length - 1}
              onClick={() => setCurrentQIndex(i => i + 1)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:bg-gray-400"
            >
              Save & Next <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </main>

        {/* Sidebar Palette */}
        <aside className={`fixed inset-y-0 right-0 w-80 bg-white border-l shadow-2xl transform transition-transform z-30 flex flex-col ${showSidebar ? 'translate-x-0' : 'translate-x-full'} md:relative md:translate-x-0`}>
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-gray-700">Question Palette</h3>
            <button className="md:hidden" onClick={() => setShowSidebar(false)}><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-600 p-4 bg-gray-50 border-b">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-600" /> Answered</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border border-gray-400" /> Not Visited</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-purple-600" /> Marked</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-600" /> Current</div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-3">
              {questions.map((q, idx) => {
                // Determine Palette Color
                let colorClass = 'bg-white text-gray-700 hover:bg-gray-100';
                if (answers[q.id]) colorClass = 'bg-green-600 text-white border-green-600';
                if (markedForReview.has(q.id)) colorClass = 'bg-purple-600 text-white border-purple-600';
                if (idx === currentQIndex) colorClass = 'ring-2 ring-blue-600 border-blue-600 bg-blue-50';

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentQIndex(idx);
                      if (window.innerWidth < 768) setShowSidebar(false);
                    }}
                    className={`h-10 w-10 rounded-lg text-sm font-bold border transition-all flex items-center justify-center relative ${colorClass}`}
                  >
                    {idx + 1}
                    {markedForReview.has(q.id) && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-600 rounded-full border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-4 border-t bg-gray-50 text-xs text-center text-gray-500">
            Answered: <b>{Object.keys(answers).length}</b> / {questions.length}
          </div>
        </aside>
      </div>
    </div>
  );
}