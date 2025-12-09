import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import { useProctoring, requestFullScreen } from '../hooks/useProctoring';
import { Exam, Question } from '../types/models';
import {
  Clock,
  Loader2,
  AlertTriangle,
  Maximize,
  AlertOctagon,
  ShieldAlert,
  Save,
  Flag,
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  Menu,
  X
} from 'lucide-react';

type Props = {
  exam: Exam;
  onComplete: () => void;
  onCancel: () => void;
  reviewMode?: boolean; // NEW
};

const MAX_WARNINGS = 3;
const SNAPSHOT_INTERVAL = 30000;

export function ExamTaking({ exam, onComplete, onCancel, reviewMode = false }: Props) {
  // --- State ---
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const [status, setStatus] = useState<'loading' | 'idle' | 'active' | 'submitting'>(
    reviewMode ? 'active' : 'loading'
  );
  const [warnings, setWarnings] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false); // Mobile sidebar toggle

  // --- Refs ---
  const runOnce = useRef(false);

  // --- 1. API: Start Exam (Fixed for Race Conditions) ---
  useEffect(() => {
    if (reviewMode) {
      // REVIEW MODE: Only questions & saved answers needed
      setQuestions(exam.questions);
      setAnswers(exam.answers || {});
      setStatus("active");
      return;
    }

    if (runOnce.current) return;
    runOnce.current = true;

    async function initExam() {
      try {
        // 1. Get Questions
        const examRes = await api.get(`/exams/${exam.id}`);
        if (examRes.data.questions) setQuestions(examRes.data.questions);

        // 2. Start/Resume Attempt
        const attemptRes = await api.post('/attempts/start', { exam_id: exam.id });
        const attempt = attemptRes.data;

        setAttemptId(attempt.id);

        // Resume state
        if (attempt.answers) setAnswers(attempt.answers);
        if (attempt.time_left) setTimeLeft(attempt.time_left);
        if (attempt.tab_switches) setWarnings(attempt.tab_switches);

        // Check if already done
        if (attempt.submitted_at || attempt.is_terminated) {
          alert(`Attempt finished.`);
          onComplete();
          return;
        }

        // Fullscreen check
        if (!document.fullscreenElement) {
          try { await requestFullScreen(); } catch (e) { }
        }

        setStatus('active');
      } catch (err: any) {
        console.error('Failed to start:', err);
        alert(err.response?.data?.error || "Failed to load exam.");
        setStatus('idle');
        onCancel();
      }
    }
    initExam();
  }, [exam.id, reviewMode]);

  // --- TIMER ---
  useEffect(() => {
    if (reviewMode) return; // Disable timer in review
    if (status !== 'active') return;

    if (timeLeft <= 0) {
      if (timeLeft === 0) submitAttempt(false, 'Time Limit');
      return;
    }

    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, status]);

  // --- AUTOSAVE ---
  const reportProgress = useCallback(
    async (currentWarnings: number, currentAnswers: Record<string, string>) => {
      if (!attemptId || reviewMode) return;
      try {
        await api.post('/progress', {
          attempt_id: attemptId,
          tab_switches: currentWarnings,
          answers: currentAnswers,
          snapshot: ""
        });
      } catch (err) { }
    },
    [attemptId, reviewMode]
  );

  useEffect(() => {
    if (status !== 'active' || reviewMode) return;
    const interval = setInterval(() => reportProgress(warnings, answers), SNAPSHOT_INTERVAL);
    return () => clearInterval(interval);
  }, [warnings, answers, status, reviewMode, reportProgress]);

  // --- PROCTORING ---
  const handleViolation = useCallback(
    (type: string) => {
      if (status !== 'active' || reviewMode) return;
      setWarnings(prev => {
        const newW = prev + 1;
        reportProgress(newW, answers);
        if (newW >= MAX_WARNINGS) submitAttempt(true, `Violation: ${type}`);
        return newW;
      });
    },
    [status, answers, reportProgress, reviewMode]
  );

  useProctoring({
    isActive: status === 'active' && !reviewMode,
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
  }, [status, handleViolation, reviewMode]);

  const handleOptionClick = (qId: string, opt: string) => {
    if (status !== 'active' || reviewMode) return;

    const q = questions.find(q => q.id === qId);
    if (!q) return;

    let newVal = "";

    if (q.type === 'multi-select') {
      // Toggle Logic
      const currentRaw = answers[qId] || "";
      let currentOpts = currentRaw ? currentRaw.split(',') : [];

      if (currentOpts.includes(opt)) {
        // Remove
        currentOpts = currentOpts.filter(o => o !== opt);
      } else {
        // Add
        currentOpts.push(opt);
      }
      // Sort to ensure consistency (A,B not B,A)
      newVal = currentOpts.sort().join(',');
    } else {
      // Single Choice Logic (Replace)
      newVal = opt;
    }
    // Update State
    const newAnswers = { ...answers, [qId]: newVal };
    setAnswers(newAnswers);

    // Trigger Save
    reportProgress(warnings, newAnswers);
  };

  // Helper to check if selected
  const isSelected = (qId: string, opt: string, type: string) => {
    const val = answers[qId];
    if (!val) return false;
    if (type === 'multi-select') return val.split(',').includes(opt);
    return val === opt;
  };

  // --- REVIEW MODE COLORING ---
  const getOptionColor = (q: Question, opt: string) => {
    if (!reviewMode) return "";

    const correct = q.correct_answer.split(",").sort().join(",");
    const user = (answers[q.id] || "").split(",").sort().join(",");

    const correctOpts = correct.split(",");
    const userOpts = user.split(",");

    const isCorrectOpt = correctOpts.includes(opt);
    const isUserOpt = userOpts.includes(opt);

    if (isCorrectOpt && isUserOpt)
      return "border-green-600 bg-green-50 ring-1 ring-green-300";

    if (isCorrectOpt && !isUserOpt)
      return "border-blue-600 bg-blue-50 ring-1 ring-blue-300";

    if (!isCorrectOpt && isUserOpt)
      return "border-red-600 bg-red-50 ring-1 ring-red-300";

    return "border-gray-200 bg-white";
  };

  const toggleReview = (qId: string) => {
    if (reviewMode) return;
    const newSet = new Set(markedForReview);
    newSet.has(qId) ? newSet.delete(qId) : newSet.add(qId);
    setMarkedForReview(newSet);
  };

  const submitAttempt = async (forced: boolean, reason?: string) => {
    if (status === 'submitting' || reviewMode) return;

    if (!forced && !window.confirm("Are you sure you want to finish the exam?")) return;

    setStatus('submitting');
    try {
      await api.post('/attempts/submit', { attempt_id: attemptId });
      if (document.fullscreenElement) document.exitFullscreen().catch(() => { });
      onComplete();
    } catch (e) {
      alert("Submission error.");
      setStatus('active');
    }
  };

  // --- Render Helpers ---

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Color logic for Question Palette
  const getPaletteColor = (qId: string, idx: number) => {
    if (idx === currentQIndex) return 'ring-2 ring-blue-600 border-blue-600 bg-blue-50'; // Current
    if (markedForReview.has(qId)) return 'bg-purple-600 text-white border-purple-600'; // Review
    if (answers[qId]) return 'bg-green-600 text-white border-green-600'; // Answered
    return 'bg-white text-gray-700 hover:bg-gray-100'; // Not Visited
  };

  const currentQ = questions[currentQIndex];

  if (status === 'loading') return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
      <h2 className="text-xl font-semibold text-gray-700">Loading Exam Environment...</h2>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 font-sans overflow-hidden">

      {/* --- HEADER --- */}
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-4 shadow-md z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 p-2 rounded">
            <span className="font-bold text-sm text-slate-300 block leading-none text-xs">EXAM</span>
            <span className="font-bold">{exam.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Timer */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-lg font-bold border 
                ${timeLeft < 300 ? 'bg-red-900/50 border-red-500 text-red-100' : 'bg-slate-800 border-slate-700'}`}>
            <Clock className="w-5 h-5" /> {formatTime(timeLeft)}
          </div>

          <button
            onClick={() => submitAttempt(false)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-bold transition shadow-lg shadow-green-900/20"
          >
            Submit Exam
          </button>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden p-2" onClick={() => setShowSidebar(!showSidebar)}>
            {showSidebar ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* --- WARNING BANNER --- */}
      {(!isFullScreen || warnings > 0) && (
        <div className="bg-red-600 text-white px-4 py-2 text-sm font-bold flex justify-between items-center z-20">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Warnings: {warnings}/{MAX_WARNINGS}</span>
            {!isFullScreen && <span> | Please return to Fullscreen!</span>}
          </div>
          {!isFullScreen && (
            <button onClick={requestFullScreen} className="bg-white text-red-600 px-3 py-1 rounded text-xs uppercase hover:bg-gray-100">
              Fix Now
            </button>
          )}
        </div>
      )}

      {/* --- MAIN LAYOUT --- */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* --- LEFT: QUESTION AREA --- */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {!isFullScreen && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur flex flex-col items-center justify-center">
              <AlertOctagon className="w-20 h-20 text-red-500 mb-4 animate-pulse" />
              <h1 className="text-2xl font-bold text-gray-900">Exam Paused</h1>
              <p className="text-gray-500 mb-6">Fullscreen mode is required to continue.</p>
              <button onClick={requestFullScreen} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold">Resume</button>
            </div>
          )}

          {/* Question Container */}
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
                  onClick={() => toggleReview(currentQ.id)}
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
                <p className="text-xl text-gray-800 font-medium leading-relaxed">
                  {currentQ.question_text}
                </p>
              </div>

              {/* Options */}
              <div className="grid gap-4">

                {/* SINGLE CHOICE */}
                {currentQ.type === "single-choice" &&
                  ["A", "B", "C", "D"].map((opt) => (
                    <div
                      key={opt}
                      onClick={() => handleOptionClick(currentQ.id, opt)}
                      className={`group flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${reviewMode
                          ? getOptionColor(currentQ, opt)
                          : isSelected(currentQ.id, opt, "single-choice")
                            ? "border-blue-600 bg-blue-50 ring-1 ring-blue-200"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4
                        ${isSelected(currentQ.id, opt, "single-choice")
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-400 bg-white'}`}>
                        {isSelected(currentQ.id, opt, "single-choice") && (
                          <div className="w-2.5 h-2.5 bg-white rounded-full" />
                        )}
                      </div>

                      <span className="text-gray-700 font-medium text-lg">
                        {currentQ[`option_${opt.toLowerCase()}`]}
                      </span>
                    </div>
                  ))}

                {/* MULTI-SELECT */}
                {currentQ.type === "multi-select" &&
                  ["A", "B", "C", "D"].map((opt) => (
                    <div
                      key={opt}
                      onClick={() => handleOptionClick(currentQ.id, opt)}
                      className={`group flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                        ${reviewMode
                          ? getOptionColor(currentQ, opt)
                          : isSelected(currentQ.id, opt, "multi-select")
                            ? "border-purple-600 bg-purple-50 ring-1 ring-purple-200"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                      <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center mr-4
                        ${isSelected(currentQ.id, opt, "multi-select")
                          ? "border-purple-600 bg-purple-600 text-white"
                          : "border-gray-400 bg-white"}`}>
                        {isSelected(currentQ.id, opt, "multi-select") && (
                          <Check className="w-4 h-4" />
                        )}
                      </div>

                      <span className="text-gray-700 font-medium text-lg">
                        {currentQ[`option_${opt.toLowerCase()}`]}
                      </span>
                    </div>
                  ))}

                {/* TRUE / FALSE */}
                {currentQ.type === "true-false" && (
                  <div className="flex flex-col gap-4">
                    {["True", "False"].map((txt) => {
                      const val = txt === "True" ? "A" : "B";
                      const selected = isSelected(currentQ.id, val, "single-choice");

                      return (
                        <button
                          key={txt}
                          onClick={() => handleOptionClick(currentQ.id, val)}
                          className={`w-full py-4 rounded-xl font-bold text-lg border-2 transition-all
                            ${reviewMode
                              ? getOptionColor(currentQ, val)
                              : selected
                                ? txt === "True"
                                  ? "bg-green-600 text-white border-green-700"
                                  : "bg-red-600 text-white border-red-700"
                                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                            }`}
                        >
                          {txt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* DESCRIPTIVE */}
                {currentQ.type === "descriptive" && (
                  <textarea
                    value={answers[currentQ.id] || ""}
                    onChange={(e) => {
                      if (reviewMode) return;
                      const newAnswers = { ...answers, [currentQ.id]: e.target.value };
                      setAnswers(newAnswers);
                      reportProgress(warnings, newAnswers);
                    }}
                    rows={6}
                    className="w-full p-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    placeholder="Write your answer here..."
                    disabled={reviewMode}
                  />
                )}
              </div>

              {/* REVIEW MODE: SHOW ANSWER SUMMARY */}
              {reviewMode && (
                <div className="mt-6 p-4 rounded-xl bg-gray-50 border">
                  <p className="text-sm font-bold text-gray-700">
                    Your Answer: <span className="text-blue-700">{answers[currentQ.id] || "Not Attempted"}</span>
                  </p>
                  <p className="text-sm font-bold text-gray-700 mt-2">
                    Correct Answer: <span className="text-green-700">{currentQ.correct_answer}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Control Bar */}
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
                // Clear selection logic if needed
                const newAns = { ...answers };
                delete newAns[currentQ.id];
                setAnswers(newAns);
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

        {/* --- RIGHT: PALETTE SIDEBAR --- */}
        <aside className={`
            fixed inset-y-0 right-0 w-80 bg-white border-l shadow-2xl transform transition-transform z-30 flex flex-col
            ${showSidebar ? 'translate-x-0' : 'translate-x-full'} md:relative md:translate-x-0
        `}>
          {/* Legend */}
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-bold text-gray-700 mb-3">Question Palette</h3>
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-600">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-600" /> Answered</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-white border border-gray-400" /> Not Visited</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-purple-600" /> Marked for Review</div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-600" /> Current</div>
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-5 gap-3">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => {
                    setCurrentQIndex(idx);
                    if (window.innerWidth < 768) setShowSidebar(false);
                  }}
                  className={`
                                h-10 w-10 rounded-lg text-sm font-bold border transition-all flex items-center justify-center relative
                                ${getPaletteColor(q.id, idx)}
                            `}
                >
                  {idx + 1}
                  {/* Small mark indicator */}
                  {markedForReview.has(q.id) && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-purple-600 rounded-full border border-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Footer */}
          <div className="p-4 border-t bg-gray-50 text-xs text-center text-gray-500">
            Answered: <b>{Object.keys(answers).length}</b> / {questions.length}
          </div>
        </aside>
      </div>
    </div>
  );
}