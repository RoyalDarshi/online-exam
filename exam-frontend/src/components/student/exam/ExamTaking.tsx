// src/components/ExamTaking.tsx
import React, { useContext } from "react";
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
  Sun,
  Moon,
} from "lucide-react";

import { Exam, Question } from "../../../types/models";
import { useExam, MAX_WARNINGS } from "../../../hooks/useExam";
import ReviewAndSubmitModal from "./ReviewAndSubmitModal";
import { requestFullScreen } from "../../../hooks/useProctoring";
import { ThemeContext } from "../../../contexts/ThemeContext";
import { useExamGuard } from "../../../hooks/useExamGuard";

type CandidateInfo = {
  name: string;
  candidateId: string;
  center: string;
};

type Props = {
  exam: Exam;
  onComplete: () => void;
  onCancel: () => void;
  candidate?: CandidateInfo;
};

const getSectionName = (q: Question): string => {
  const anyQ: any = q;
  return anyQ.section || anyQ.section_name || anyQ.topic || "General";
};

const formatTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${m.toString().padStart(2, "0")}:${sec
    .toString()
    .padStart(2, "0")}`;
};

export function ExamTaking({ exam, onComplete, onCancel, candidate }: Props) {
  const {
    questions,
    answers,
    markedForReview,
    visited,
    timeLeft,
    currentQIndex,
    status,
    warnings,
    isFullScreen,
    errorMessage,
    textSize,
    paletteFilter,
    saveStatus,
    showSubmitModal,
    showQuestionPaper,
    activeSection,
    currentQuestion,
    sections,
    filteredQuestions,
    progressPercent,
    setTextSize,
    setPaletteFilter,
    setCurrentQIndex,
    setActiveSection,
    setShowQuestionPaper,
    toggleMarkCurrent,
    handleOptionClick,
    clearCurrentAnswer,
    goNext,
    goPrevious,
    openSubmitModal,
    closeSubmitModal,
    confirmSubmit,
  } = useExam(exam, onComplete);

  const [showSidebar, setShowSidebar] = React.useState(true);
  const { theme, toggleTheme } = useContext(ThemeContext);

  // ExamGuard status during exam (polling every 5s)
  const guardActive = useExamGuard(true);

  React.useEffect(() => {
    if (window.innerWidth < 1024) setShowSidebar(false);
  }, []);

  const getTextClass = () => {
    switch (textSize) {
      case "sm":
        return "text-sm";
      case "lg":
        return "text-lg";
      case "xl":
        return "text-xl";
      default:
        return "text-base";
    }
  };

  const isSelected = (qId: string, opt: string, type: string) => {
    const val = answers[qId];
    if (!val) return false;
    if (type === "multi-select") return val.split(",").includes(opt);
    return val === opt;
  };

  const getTypeColor = (type: string) => {
    if (type === "single-choice")
      return {
        border: "border-sky-500",
        bg: "bg-sky-500",
        light: "bg-sky-100 dark:bg-sky-900/40",
      };
    if (type === "multi-select")
      return {
        border: "border-violet-500",
        bg: "bg-violet-500",
        light: "bg-violet-100 dark:bg-violet-900/40",
      };
    return {
      border: "border-slate-500",
      bg: "bg-slate-500",
      light: "bg-slate-100 dark:bg-slate-900/40",
    };
  };

  // LOADING
  if (status === "loading") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-10 h-10 animate-spin text-sky-500 mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Preparing your exam environment...
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Please do not refresh or close this window.
        </p>
      </div>
    );
  }

  // ERROR
  if (status === "error") {
    
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <AlertOctagon className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Error Loading Exam
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {errorMessage}
        </p>
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-slate-50 rounded-lg border border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  const currentQ = currentQuestion;
  if (!currentQ) return null;

  const typeColors = getTypeColor(currentQ.type);

  // ---------- MAIN UI ----------
  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden">
      {/* HEADER */}
      <header className="h-16 bg-white/95 border-b border-slate-200 flex items-center justify-between px-3 lg:px-6 shadow-sm z-30 relative dark:bg-slate-900/95 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-md bg-slate-100 border border-slate-300 flex flex-col justify-center dark:bg-slate-950 dark:border-slate-700">
            <span className="text-[10px] font-semibold text-slate-500 leading-none dark:text-slate-400">
              ONLINE
            </span>
            <span className="text-xs font-bold tracking-wide text-slate-900 leading-tight dark:text-slate-50">
              ASSESSMENT
            </span>
          </div>
          <div className="hidden md:flex flex-col">
            <span className="text-xs uppercase text-slate-500 font-semibold dark:text-slate-400">
              Exam
            </span>
            <h1 className="font-semibold text-sm text-slate-900 max-w-xs truncate dark:text-slate-100">
              {exam.title}
            </h1>
          </div>
        </div>

        {/* Timer + save */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-sm font-semibold border shadow-inner transition-colors
            ${timeLeft < 300
                ? "bg-rose-100 border-rose-500 text-rose-800 dark:bg-rose-900/40 dark:border-rose-700 dark:text-rose-100"
                : timeLeft < 900
                  ? "bg-amber-100 border-amber-500 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-100"
                  : "bg-slate-100 border-slate-300 text-slate-900 dark:bg-slate-900/70 dark:border-slate-700 dark:text-slate-100"
              }`}
          >
            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
          </div>

          {saveStatus === "saving" ? (
            <div className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving</span>
            </div>
          ) : saveStatus === "error" ? (
            <div className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-300">
              <WifiOff className="w-4 h-4 animate-pulse" />
              <span>Offline</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
              <CloudCheck className="w-4 h-4" />
              <span>Saved</span>
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setShowQuestionPaper(true)}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium
              bg-white border-slate-300 text-slate-800 hover:bg-slate-100
              dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <FileText className="w-4 h-4 text-sky-500 dark:text-sky-300" />
            Question Paper
          </button>

          {/* Font size */}
          <div className="hidden sm:flex items-center bg-slate-100 border border-slate-300 rounded-md dark:bg-slate-900 dark:border-slate-700">
            <button
              onClick={() =>
                setTextSize(
                  textSize === "xl"
                    ? "lg"
                    : textSize === "lg"
                      ? "base"
                      : "sm"
                )
              }
              className="px-2 py-1 hover:bg-slate-200 rounded-l-md transition disabled:opacity-30 dark:hover:bg-slate-800"
              disabled={textSize === "sm"}
              title="Decrease font size"
            >
              <Type className="w-3 h-3 text-slate-600 dark:text-slate-300" />
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-700" />
            <button
              onClick={() =>
                setTextSize(
                  textSize === "sm"
                    ? "base"
                    : textSize === "base"
                      ? "lg"
                      : "xl"
                )
              }
              className="px-2 py-1 hover:bg-slate-200 rounded-r-md transition disabled:opacity-30 dark:hover:bg-slate-800"
              disabled={textSize === "xl"}
              title="Increase font size"
            >
              <Type className="w-4 h-4 text-slate-900 dark:text-slate-100" />
            </button>
          </div>

          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium
              bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200
              dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
            title="Toggle theme"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-4 h-4" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            className="p-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors lg:hidden dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={() => setShowSidebar(!showSidebar)}
            title={
              showSidebar ? "Hide Question Palette" : "Show Question Palette"
            }
          >
            {showSidebar ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>

        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-slate-200 dark:bg-slate-900">
          <div
            className="h-full bg-sky-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Candidate + sections */}
      <div className="bg-slate-100 border-b border-slate-200 px-3 lg:px-6 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] md:text-xs dark:bg-slate-950 dark:border-slate-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <User className="w-3 h-3 text-sky-500 dark:text-sky-300" />
            <span className="font-medium">
              {candidate?.name || "Candidate Name"}
            </span>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            ID:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {candidate?.candidateId || "ID-000000"}
            </span>
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Center:{" "}
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {candidate?.center || "Exam Center"}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-400 dark:scrollbar-thumb-slate-700">
          {sections.map((sec) => (
            <button
              key={sec}
              onClick={() => {
                setActiveSection(sec);
                const idx = questions.findIndex(
                  (q) => getSectionName(q) === sec
                );
                if (idx !== -1) setCurrentQIndex(idx);
              }}
              className={`px-3 py-1.5 whitespace-nowrap rounded-md border text-[11px] font-semibold transition
                ${activeSection === sec
                  ? "bg-sky-600 border-sky-500 text-white"
                  : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* Warning banner (fullscreen + ExamGuard status) */}
      {(!isFullScreen || warnings > 0 || !guardActive) && (
        <div className="bg-amber-50 border-b border-amber-400 text-amber-900 px-4 py-2 text-xs md:text-sm font-medium flex justify-between items-center z-20 dark:bg-slate-900 dark:border-amber-500 dark:text-amber-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            <span>
              Warnings:{" "}
              <span className="font-semibold">{warnings}</span> / {MAX_WARNINGS}
            </span>
            {!guardActive && (
              <span className="hidden sm:inline text-rose-700 font-semibold ml-2 dark:text-rose-200">
                ExamGuard disconnected. Exam is paused until it reconnects.
              </span>
            )}
            {!isFullScreen && guardActive && (
              <span className="hidden sm:inline text-rose-700 font-semibold ml-2 dark:text-rose-200">
                Fullscreen is mandatory.
              </span>
            )}
          </div>

          {!isFullScreen && guardActive && (
            <button
              onClick={requestFullScreen}
              className="bg-sky-600 hover:bg-sky-500 text-white border border-sky-500 px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
            >
              <Maximize2 className="w-3 h-3" /> Re-enter Fullscreen
            </button>
          )}
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        {/* BLOCKER: ExamGuard disconnected */}
          {!guardActive && (
            <div className="absolute inset-0 z-50 bg-rose-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
              <div className="mb-5 flex items-center justify-center">
                <div className="bg-rose-900/60 p-4 rounded-full border border-rose-500">
                  <ShieldAlert className="w-10 h-10 text-rose-200" />
                </div>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-rose-50 mb-2">
                ExamGuard Disconnected
              </h1>
              <p className="text-rose-100 mb-4 max-w-md text-sm">
                The secure exam environment has been lost. Please ensure{" "}
                <b>ExamGuard.exe</b> is running on this system. The test will
                remain paused until ExamGuard reconnects.
              </p>
              <p className="text-rose-200 text-xs opacity-80">
                Once ExamGuard is running again, this screen will disappear and
                you can continue the test.
              </p>
            </div>
          )}

          {/* BLOCKER: fullscreen off (only if ExamGuard is active) */}
          {guardActive && !isFullScreen && (
            <div className="absolute inset-0 z-40 bg-slate-100/90 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
              <div className="mb-5 flex items-center justify-center">
                <div className="bg-rose-100 p-4 rounded-full border border-rose-300 dark:bg-rose-900/60 dark:border-rose-700">
                  <AlertOctagon className="w-10 h-10 text-rose-600 dark:text-rose-300" />
                </div>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 mb-2 dark:text-slate-50">
                Assessment Paused
              </h1>
              <p className="text-slate-600 mb-6 max-w-md text-sm dark:text-slate-400">
                The test is paused because fullscreen mode was exited. Please
                return to fullscreen to continue your exam.
              </p>
              <button
                onClick={requestFullScreen}
                className="bg-sky-600 hover:bg-sky-500 text-white px-8 py-2.5 rounded-md font-semibold shadow-sm border border-sky-500"
              >
                Resume in Fullscreen
              </button>
            </div>
          )}
        {/* MAIN AREA */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">

          {/* Question + options */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50 dark:bg-slate-950">
            <div className="max-w-4xl mx-auto space-y-5">
              <div
                /*${markedForReview.has(currentQ.id)
                  ? "outline outline-2 outline-violet-400/80 dark:outline-violet-500/70"
                  : ""
                  }*/
                className={`rounded-xl border bg-white border-slate-200 shadow-sm overflow-hidden dark:bg-slate-900/70 dark:border-slate-800`}
              >
                {/* Question header */}
                <div className="px-4 md:px-6 py-4 border-b border-slate-200 bg-slate-50 
                  flex flex-col sm:flex-row sm:items-center justify-between gap-4
                  dark:border-slate-800 dark:bg-slate-900/60">

                {/* Left Section */}
                <div className="space-y-1.5">
                  {/* Question Heading */}
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-50">
                      Question {currentQIndex + 1}
                    </h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      / {questions.length}
                    </span>
                  </div>

                  {/* Metadata Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">

                    {/* Complexity */}
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium border shadow-sm capitalize
                      ${currentQ.complexity === "hard"
                        ? "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-200 dark:border-rose-700"
                        : currentQ.complexity === "medium"
                        ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700"
                        : "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-700"
                      }`}
                    >
                      {currentQ.complexity || "easy"}
                    </span>

                    {/* Type */}
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium border shadow-sm flex items-center gap-1 capitalize
                      ${currentQ.type === "multi-select"
                        ? "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-700"
                        : "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-700"
                      }`}
                    >
                      {currentQ.type === "multi-select" ? (
                        <ListFilter className="w-3 h-3" />
                      ) : (
                        <Circle className="w-3 h-3" />
                      )}
                      {currentQ.type.replace("-", " ")}
                    </span>

                    {/* Marks */}
                    <span className="px-2 py-0.5 rounded-full font-medium border border-slate-300 shadow-sm
                      text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      Marks: {currentQ.marks}
                    </span>

                    {/* Negative Marks */}
                    <span className="px-2 py-0.5 rounded-full font-medium border border-slate-300 shadow-sm
                      text-slate-700 dark:border-slate-700 dark:text-slate-200">
                      Negative: {currentQ.negative_marks}
                    </span>

                    {/* Section */}
                    <span className="px-2 py-0.5 rounded-full font-medium border border-slate-300 shadow-sm
                      text-slate-700 dark:border-slate-700 dark:text-slate-300">
                      Section: {getSectionName(currentQ)}
                    </span>
                  </div>
                </div>

                {/* Mark for Review Button */}
                <button
                  onClick={toggleMarkCurrent}
                  className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs md:text-sm 
                    font-semibold border shadow-sm transition-all duration-200
                    ${markedForReview.has(currentQ.id)
                      ? "bg-violet-600 border-violet-500 text-white dark:bg-violet-900/70 dark:border-violet-600 dark:text-violet-50"
                      : "bg-white border-slate-300 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                    }`}
                >
                  <Flag
                    className={`w-4 h-4 ${markedForReview.has(currentQ.id) ? "fill-violet-200" : ""}`}
                  />
                  {markedForReview.has(currentQ.id)
                    ? "Marked for Review"
                    : "Mark for Review"}
                </button>
              </div>



                {/* Question body */}
                <div className="px-4 md:px-6 lg:px-8 py-6 md:py-7 bg-white dark:bg-slate-900/80">
                  <div className="mb-6">
                    <p
                      className={`leading-relaxed text-slate-900 dark:text-slate-100 ${getTextClass()}`}
                    >
                      {currentQ.question_text}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {(currentQ.type === "single-choice" ||
                      currentQ.type === "multi-select") &&
                      ["A", "B", "C", "D"].map((opt) => {
                        const selected = isSelected(
                          currentQ.id,
                          opt,
                          currentQ.type
                        );
                        const isSingle = currentQ.type === "single-choice";

                        const cardStyle = selected
                          ? `${typeColors.border} ${typeColors.light} shadow-sm`
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:bg-slate-900 dark:hover:border-slate-600";

                        const iconContainerClass = isSingle
                          ? "rounded-full"
                          : "rounded-md";
                        const iconStyle = selected
                          ? `${typeColors.bg} ${typeColors.border} text-white`
                          : "border-slate-400 bg-white text-slate-500 group-hover:border-sky-500 group-hover:text-sky-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-400";

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
                                ? "text-slate-900 dark:text-slate-50"
                                : "text-slate-800 dark:text-slate-200"
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

                    {currentQ.type === "true-false" &&
                      ["True", "False"].map((txt) => {
                        const val = txt === "True" ? "A" : "B";
                        const selected = isSelected(
                          currentQ.id,
                          val,
                          "single-choice"
                        );
                        return (
                          <button
                            key={txt}
                            onClick={() =>
                              handleOptionClick(currentQ.id, val)
                            }
                            className={`w-full py-4 px-6 rounded-lg text-left flex items-center gap-4 border-2 transition text-base font-semibold
                              ${selected
                                ? txt === "True"
                                  ? "bg-emerald-100 border-emerald-500 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-500 dark:text-emerald-100"
                                  : "bg-rose-100 border-rose-500 text-rose-800 dark:bg-rose-900/40 dark:border-rose-500 dark:text-rose-100"
                                : "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 dark:bg-slate-900/80 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
                              }`}
                          >
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selected
                                ? "border-current"
                                : "border-slate-400 dark:border-slate-500"
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

                    {currentQ.type === "descriptive" && (
                      <textarea
                        value={answers[currentQ.id] || ""}
                        onChange={(e) =>
                          handleOptionClick(currentQ.id, e.target.value)
                        }
                        rows={7}
                        className={`w-full p-4 border-2 rounded-lg bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-600 shadow-sm border-slate-200 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder-slate-500 dark:border-slate-800 ${getTextClass()}`}
                        placeholder="Type your answer here..."
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="h-16 bg-white border-t border-slate-200 px-3 md:px-6 flex items-center justify-between text-sm dark:bg-slate-900/95 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <button
                disabled={currentQIndex === 0}
                onClick={goPrevious}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium border bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 border-l border-slate-200 pl-3 dark:text-slate-500 dark:border-slate-700">
                <Keyboard className="w-4 h-4" />
                Use{" "}
                <span className="px-1.5 py-0.5 border border-slate-300 rounded bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                  ←
                </span>
                <span className="px-1.5 py-0.5 border border-slate-300 rounded bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                  →
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={clearCurrentAnswer}
                className="hidden sm:inline-flex text-xs md:text-sm font-medium text-slate-500 hover:text-rose-500 hover:underline dark:text-slate-400 dark:hover:text-rose-300"
              >
                Clear Response
              </button>

              <button
                disabled={currentQIndex === questions.length - 1}
                onClick={goNext}
                className="inline-flex items-center gap-2 px-5 md:px-6 py-2.5 rounded-md font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-sm disabled:bg-slate-400 disabled:opacity-60 dark:disabled:bg-slate-700"
              >
                Save & Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </main>

        {/* SIDEBAR PALETTE */}
        <aside
          className={`fixed inset-y-0 right-0 w-72 bg-white border-l border-slate-200 transform transition-transform duration-300 z-30 flex flex-col
            ${showSidebar ? "translate-x-0" : "translate-x-full"}
            lg:relative lg:translate-x-0 dark:bg-slate-950 dark:border-slate-800`}
        >
          <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-950/95">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2 text-sm dark:text-slate-100">
              <MousePointerClick className="w-4 h-4 text-sky-500 dark:text-sky-400" />
              Question Palette
            </h3>
            <button
              className="lg:hidden text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-200"
              onClick={() => setShowSidebar(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex gap-1 text-[11px] font-semibold dark:border-slate-800 dark:bg-slate-950/90">
            <button
              onClick={() => setPaletteFilter("all")}
              className={`flex-1 py-1.5 rounded-md ${paletteFilter === "all"
                ? "bg-slate-800 text-slate-50 dark:bg-slate-800"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
                }`}
            >
              All
            </button>
            <button
              onClick={() => setPaletteFilter("unanswered")}
              className={`flex-1 py-1.5 rounded-md ${paletteFilter === "unanswered"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-100"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
                }`}
            >
              Unanswered
            </button>
            <button
              onClick={() => setPaletteFilter("marked")}
              className={`flex-1 py-1.5 rounded-md ${paletteFilter === "marked"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-100"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
                }`}
            >
              Marked
            </button>
          </div>

          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-semibold text-slate-500 grid grid-cols-2 gap-y-2 gap-x-3 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />{" "}
              Answered
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Marked
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Visited
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-800" />{" "}
              Not Visited
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 bg-white dark:bg-slate-950">
            {filteredQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-xs gap-2 dark:text-slate-500">
                <Filter className="w-6 h-6 opacity-40" />
                <span>No questions match this filter</span>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2.5">
                {filteredQuestions.map((q) => {
                  const idx = (q as any).originalIdx as number;
                  let colorClass =
                    "bg-slate-50 text-slate-700 border border-slate-300 hover:border-sky-500 hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-300 dark:border-slate-700";

                  if (visited.has(q.id))
                    colorClass =
                      "bg-amber-100 text-amber-800 border border-amber-400 hover:border-amber-500 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700";
                  if (answers[q.id])
                    colorClass =
                      "bg-emerald-100 text-emerald-800 border border-emerald-500 shadow-sm dark:bg-emerald-900/50 dark:text-emerald-50 dark:border-emerald-500";
                  if (markedForReview.has(q.id))
                    colorClass =
                      "bg-violet-100 text-violet-800 border border-violet-500 shadow-sm dark:bg-violet-900/50 dark:text-violet-50 dark:border-violet-500";

                  if (idx === currentQIndex)
                    colorClass =
                      "bg-sky-100 text-sky-800 border border-sky-500 ring-1 ring-sky-400 dark:bg-sky-900/70 dark:text-sky-50 dark:border-sky-400 dark:ring-sky-500";

                  return (
                    <button
                      key={q.id}
                      onClick={() => {
                        setCurrentQIndex(idx);
                        if (window.innerWidth < 1024) setShowSidebar(false);
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

          <div className="px-4 py-4 border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/95">
            <button
              onClick={openSubmitModal}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-md font-semibold text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-100" />
              Review & Submit
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-2 dark:text-slate-400">
              {Object.keys(answers).length} of {questions.length} answered
            </p>
          </div>
        </aside>

        {/* REVIEW MODAL */}
        <ReviewAndSubmitModal
          isOpen={showSubmitModal}
          onClose={closeSubmitModal}
          onSubmit={() => confirmSubmit()}
          questions={questions}
          answers={answers}
          markedForReview={markedForReview}
          visited={visited}
          timeLeft={timeLeft}
          warnings={warnings}
          MAX_WARNINGS={MAX_WARNINGS}
          onQuestionJump={(index) => setCurrentQIndex(index)}
        />

        {/* QUESTION PAPER MODAL */}
        {showQuestionPaper && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
            <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl dark:bg-slate-950 dark:border-slate-800">
              <div className="px-5 md:px-7 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-slate-100 border border-slate-300 dark:bg-slate-900 dark:border-slate-700">
                    <FileText className="w-5 h-5 text-sky-500 dark:text-sky-300" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-50">
                      Question Paper View
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      View all questions in text-only format. Click any question
                      to jump to it.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowQuestionPaper(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 dark:hover:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 md:px-7 py-4 space-y-5 text-xs md:text-sm bg-white dark:bg-slate-950">
                {sections.map((sec) => {
                  const secQuestions = questions.filter(
                    (q) => getSectionName(q) === sec
                  );
                  if (!secQuestions.length) return null;

                  return (
                    <div key={sec} className="space-y-2">
                      <h3 className="text-sm md:text-base font-semibold text-slate-900 border-b border-slate-200 pb-1 dark:text-slate-100 dark:border-slate-800">
                        Section: {sec}
                      </h3>
                      <div className="space-y-1.5">
                        {secQuestions.map((q) => {
                          const globalIdx = questions.indexOf(q);
                          const answered = !!answers[q.id];
                          const marked = markedForReview.has(q.id);
                          return (
                            <button
                              key={q.id}
                              onClick={() => {
                                setCurrentQIndex(globalIdx);
                                setShowQuestionPaper(false);
                              }}
                              className={`w-full text-left rounded-md px-3 py-2 border transition ${globalIdx === currentQIndex
                                ? "bg-sky-100 border-sky-500 text-sky-900 dark:bg-sky-900/60 dark:border-sky-500 dark:text-sky-50"
                                : "bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                                }`}
                            >
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                                    Q{globalIdx + 1}
                                  </span>
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {q.type.replace("-", " ")} • {q.marks}{" "}
                                    Marks
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px]">
                                  {answered && (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-100 dark:border-emerald-700">
                                      Answered
                                    </span>
                                  )}
                                  {marked && (
                                    <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-900/60 dark:text-violet-100 dark:border-violet-700">
                                      Marked
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-800 line-clamp-2 dark:text-slate-200">
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
