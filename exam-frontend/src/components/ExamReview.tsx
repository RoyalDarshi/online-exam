// src/components/ExamReview.tsx

import React, { useMemo, useState } from "react";
import {
    ArrowLeft,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    FileText,
    LayoutList,
    Clock,
    ShieldAlert,
    MousePointerClick,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { ExamAttempt } from "../types/models";

type ExamReviewMode = "student" | "admin";

type Props = {
    attempt: ExamAttempt;
    onBack: () => void;
    mode?: ExamReviewMode; // default: "student"
};

type PanelView = "review" | "paper";

const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
        });
    } catch {
        return value;
    }
};

// Normalize answers (supports: "A", "A,C", " some , csv ", direct text)
const normalizeAnswer = (raw?: string | null) => {
    if (!raw) return "";
    return raw
        .toString()
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .sort()
        .join(",");
};

const ExamReview: React.FC<Props> = ({ attempt, onBack, mode = "student" }) => {
    const a: any = attempt as any; // widen for extra backend fields
    const exam = a.exam || {};
    const questions: any[] = exam.questions || [];
    const answers: Record<string, string> = a.answers || {};

    const [currentIndex, setCurrentIndex] = useState(0);
    const [panel, setPanel] = useState<PanelView>("review");

    const totalQuestions = questions.length;
    const currentQ = questions[currentIndex];

    // ----------------- SUMMARY COUNTS -----------------
    const {
        answeredCount,
        unansweredCount,
        subjectiveCount,
        correctCount,
        incorrectCount,
    } = useMemo(() => {
        let answered = 0;
        let unanswered = 0;
        let subjective = 0;
        let correct = 0;
        let incorrect = 0;

        for (const q of questions) {
            const qId = q.id;
            const type = q.type;
            const userNorm = normalizeAnswer(answers[qId]);

            if (type === "descriptive") {
                subjective += 1;
                if (!userNorm) unanswered += 1;
                continue;
            }

            const anyQ: any = q;
            const correctRaw: string | null =
                anyQ.correct_option || anyQ.correct_answer || anyQ.answer || null;
            const correctNorm = normalizeAnswer(correctRaw || undefined);

            if (!userNorm) {
                unanswered += 1;
            } else {
                answered += 1;
                if (correctNorm && userNorm === correctNorm) {
                    correct += 1;
                } else if (correctNorm) {
                    incorrect += 1;
                }
            }
        }

        return {
            answeredCount: answered,
            unansweredCount: unanswered,
            subjectiveCount: subjective,
            correctCount: correct,
            incorrectCount: incorrect,
        };
    }, [questions, answers]);

    const score = a.score ?? 0;
    const totalPoints = a.total_points ?? 0;
    const percent =
        totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;

    const violations = a.tab_switches ?? 0;
    const isTerminated = !!a.is_terminated;
    const passed = !!a.passed;

    // ----------------- STATUS BADGE -----------------
    const statusBadge = (() => {
        if (isTerminated) {
            return {
                label: "TERMINATED",
                className:
                    "bg-rose-900/40 text-rose-100 border border-rose-700",
                icon: <ShieldAlert className="w-4 h-4" />,
            };
        }
        if (passed) {
            return {
                label: "PASSED",
                className:
                    "bg-emerald-900/40 text-emerald-100 border border-emerald-700",
                icon: <CheckCircle2 className="w-4 h-4" />,
            };
        }
        return {
            label: "FAILED",
            className: "bg-amber-900/40 text-amber-100 border border-amber-700",
            icon: <XCircle className="w-4 h-4" />,
        };
    })();

    // ----------------- QUESTION STATUS HELPERS -----------------
    const getQuestionStatus = (
        q: any
    ): "unanswered" | "correct" | "incorrect" | "subjective" => {
        const type = q.type;
        const qId = q.id;
        const userNorm = normalizeAnswer(answers[qId]);

        if (type === "descriptive") {
            return "subjective";
        }

        const anyQ: any = q;
        const correctRaw: string | null =
            anyQ.correct_option || anyQ.correct_answer || anyQ.answer || null;
        const correctNorm = normalizeAnswer(correctRaw || undefined);

        if (!userNorm) return "unanswered";
        if (!correctNorm) return "unanswered";

        if (userNorm === correctNorm) return "correct";
        return "incorrect";
    };

    const getQuestionStatusPaletteClass = (
        status: ReturnType<typeof getQuestionStatus>
    ) => {
        switch (status) {
            case "correct":
                return "bg-emerald-900/70 border-emerald-500 text-emerald-100";
            case "incorrect":
                return "bg-rose-900/70 border-rose-500 text-rose-100";
            case "unanswered":
                return "bg-amber-900/60 border-amber-400 text-amber-50";
            case "subjective":
                return "bg-slate-900/80 border-slate-500 text-slate-200";
        }
    };

    const handlePrev = () => {
        setPanel("review");
        setCurrentIndex((i) => Math.max(0, i - 1));
    };
    const handleNext = () => {
        setPanel("review");
        setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1));
    };

    // ---- CURRENT QUESTION DERIVED INFO ----
    const currentAny: any = currentQ || {};
    const currentUserRaw = currentQ ? answers[currentQ.id] : "";
    const currentUserNorm = normalizeAnswer(currentUserRaw);
    const currentCorrectRaw: string | null =
        currentAny.correct_option ||
        currentAny.correct_answer ||
        currentAny.answer ||
        null;
    const currentCorrectNorm = normalizeAnswer(currentCorrectRaw || undefined);
    const isObjective =
        currentQ &&
        ["single-choice", "multi-select", "true-false"].includes(currentQ.type);
    const questionStatus = currentQ ? getQuestionStatus(currentQ) : null;
    const questionIsCorrect = questionStatus === "correct";

    const currentStatusChip = (() => {
        if (!currentQ) return null;
        if (currentQ.type === "descriptive") {
            return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 text-xs font-semibold text-slate-100 border border-slate-600">
                    <FileText className="w-3 h-3" />
                    Subjective (Manual evaluation)
                </span>
            );
        }

        if (!currentUserNorm) {
            return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-900/70 text-xs font-semibold text-amber-100 border border-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    Not Answered
                </span>
            );
        }

        if (!currentCorrectNorm) {
            return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 text-xs font-semibold text-slate-100 border border-slate-600">
                    <FileText className="w-3 h-3" />
                    Answer Recorded
                </span>
            );
        }

        if (questionIsCorrect) {
            return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/70 text-xs font-semibold text-emerald-100 border border-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Correct
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-900/70 text-xs font-semibold text-rose-100 border border-rose-600">
                <XCircle className="w-3 h-3" />
                Incorrect
            </span>
        );
    })();

    // -------- RENDER --------
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col">
            {/* HEADER */}
            <header className="bg-slate-900/95 border-b border-slate-800 shadow-sm backdrop-blur-sm sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="inline-flex items-center gap-2 text-slate-300 hover:text-slate-50 text-sm font-semibold"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                        <div className="w-px h-5 bg-slate-700" />
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                                Exam Review
                            </p>
                            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-50 truncate">
                                {exam.title || "Exam"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-700 text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-sky-400" />
                            {formatDateTime(a.submitted_at)}
                        </div>
                        <span
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold ${statusBadge.className}`}
                        >
                            {statusBadge.icon}
                            {statusBadge.label}
                        </span>
                    </div>
                </div>

                {/* SUMMARY STRIP */}
                <div className="max-w-7xl mx-auto px-4 pb-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs sm:text-sm">
                        <div className="bg-sky-600 text-white rounded-xl px-3 py-2.5 flex flex-col justify-center shadow-lg shadow-sky-500/30">
                            <span className="text-[11px] uppercase tracking-wide text-sky-100">
                                Score
                            </span>
                            <span className="text-base sm:text-lg font-bold">
                                {score}/{totalPoints}{" "}
                                <span className="text-xs text-sky-100">({percent}%)</span>
                            </span>
                        </div>
                        <div className="bg-slate-900/80 rounded-xl px-3 py-2.5 border border-slate-700 flex flex-col justify-center">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">
                                Answered / Total
                            </span>
                            <span className="text-base sm:text-lg font-semibold text-slate-50">
                                {answeredCount}/{totalQuestions}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                Unanswered: {unansweredCount}
                            </span>
                        </div>
                        <div className="bg-slate-900/80 rounded-xl px-3 py-2.5 border border-slate-700 flex flex-col justify-center">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">
                                Correct / Incorrect
                            </span>
                            <span className="text-base sm:text-lg font-semibold text-slate-50">
                                {correctCount}/{incorrectCount}
                            </span>
                            <span className="text-[11px] text-slate-400">
                                Subjective: {subjectiveCount}
                            </span>
                        </div>
                        <div className="bg-slate-900/80 rounded-xl px-3 py-2.5 border border-slate-700 flex flex-col justify-center">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400">
                                Violations
                            </span>
                            <span className="text-base sm:text-lg font-semibold flex items-center gap-1">
                                {violations > 0 ? (
                                    <>
                                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                                        <span className="text-amber-200">{violations}</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                        <span className="text-emerald-200">Clean</span>
                                    </>
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* MAIN BODY */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 lg:py-6 flex flex-col lg:flex-row gap-4 lg:gap-6">
                {/* LEFT SECTION: REVIEW / QUESTION PAPER */}
                <section className="flex-1 flex flex-col gap-4">
                    {/* Top toggle Review vs Question Paper */}
                    <div className="bg-slate-900/70 rounded-xl border border-slate-800 shadow-sm flex items-center justify-between px-3 py-2 backdrop-blur">
                        <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                            <MousePointerClick className="w-4 h-4 text-sky-400" />
                            <span>
                                Question {totalQuestions ? currentIndex + 1 : 0} of{" "}
                                {totalQuestions}
                            </span>
                        </div>
                        <div className="inline-flex bg-slate-950/70 rounded-full p-1 text-xs border border-slate-800">
                            <button
                                onClick={() => setPanel("review")}
                                className={`px-3 py-1.5 rounded-full flex items-center gap-1 font-semibold transition ${panel === "review"
                                    ? "bg-slate-900 text-slate-50 shadow-sm"
                                    : "text-slate-400 hover:text-slate-100"
                                    }`}
                            >
                                <FileText className="w-3 h-3" />
                                Review
                            </button>
                            <button
                                onClick={() => setPanel("paper")}
                                className={`px-3 py-1.5 rounded-full flex items-center gap-1 font-semibold transition ${panel === "paper"
                                    ? "bg-slate-900 text-slate-50 shadow-sm"
                                    : "text-slate-400 hover:text-slate-100"
                                    }`}
                            >
                                <LayoutList className="w-3 h-3" />
                                Question Paper
                            </button>
                        </div>
                    </div>

                    {/* Panel content */}
                    {panel === "review" ? (
                        <div className="bg-slate-900/80 rounded-2xl shadow-lg border border-slate-800 flex flex-col h-full backdrop-blur-md">
                            {currentQ ? (
                                <>
                                    {/* Question header */}
                                    <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-slate-800 flex flex-wrap items-center gap-3 justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-600 text-white text-sm font-bold shadow-sm">
                                                {currentIndex + 1}
                                            </span>
                                            <div className="space-y-0.5">
                                                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                                                    {currentQ.type === "single-choice"
                                                        ? "Single Choice Question"
                                                        : currentQ.type === "multi-select"
                                                            ? "Multi Select Question"
                                                            : currentQ.type === "true-false"
                                                                ? "True / False Question"
                                                                : "Subjective Question"}
                                                </p>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                                    {typeof currentAny.points === "number" && (
                                                        <span>
                                                            Marks:{" "}
                                                            <span className="font-semibold text-slate-100">
                                                                {currentAny.points}
                                                            </span>
                                                        </span>
                                                    )}
                                                    {typeof currentAny.negative_marks === "number" &&
                                                        currentAny.negative_marks !== 0 && (
                                                            <span>
                                                                Negative:{" "}
                                                                <span className="font-semibold text-rose-300">
                                                                    {currentAny.negative_marks}
                                                                </span>
                                                            </span>
                                                        )}
                                                </div>
                                            </div>
                                        </div>

                                        {currentStatusChip}
                                    </div>

                                    {/* Question text & answers */}
                                    <div className="px-4 sm:px-6 py-4 flex-1 space-y-5 overflow-auto">
                                        {/* Question */}
                                        <div className="bg-slate-950/70 rounded-xl p-4 sm:p-5 border border-slate-800">
                                            <p className="text-sm sm:text-base text-slate-50 leading-relaxed whitespace-pre-wrap">
                                                {currentQ.question_text}
                                            </p>
                                        </div>

                                        {/* Options / Answers */}
                                        {isObjective && (
                                            <div className="space-y-3">
                                                {/* TRUE / FALSE */}
                                                {currentQ.type === "true-false"
                                                    ? ["True", "False"].map((label) => {
                                                        const val = label === "True" ? "A" : "B";
                                                        const isUserSelected = currentUserNorm
                                                            .split(",")
                                                            .includes(val);
                                                        const isCorrect =
                                                            currentCorrectNorm
                                                                .split(",")
                                                                .includes(val) && mode === "admin";

                                                        let bg = "bg-slate-900/90 border-slate-700";
                                                        if (mode === "admin") {
                                                            if (isCorrect && isUserSelected) {
                                                                bg =
                                                                    "bg-emerald-900/60 border-emerald-500 shadow-sm";
                                                            } else if (isCorrect) {
                                                                bg =
                                                                    "bg-emerald-900/40 border-emerald-500/70 shadow-sm";
                                                            } else if (isUserSelected) {
                                                                bg =
                                                                    "bg-rose-900/50 border-rose-500 shadow-sm";
                                                            }
                                                        } else {
                                                            if (isUserSelected && questionIsCorrect) {
                                                                bg =
                                                                    "bg-emerald-900/60 border-emerald-500 shadow-sm";
                                                            } else if (isUserSelected && !questionIsCorrect) {
                                                                bg =
                                                                    "bg-rose-900/50 border-rose-500 shadow-sm";
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={label}
                                                                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm sm:text-base ${bg}`}
                                                            >
                                                                <div className="w-7 h-7 rounded-full border-2 border-slate-500 flex items-center justify-center text-xs font-bold bg-slate-950 text-slate-100">
                                                                    {label === "True" ? "T" : "F"}
                                                                </div>
                                                                <span className="font-medium text-slate-50">
                                                                    {label}
                                                                </span>
                                                                <div className="ml-auto flex items-center gap-1 text-[11px] font-semibold">
                                                                    {mode === "admin" && isCorrect && (
                                                                        <span className="inline-flex items-center gap-1 text-emerald-200">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            Correct
                                                                        </span>
                                                                    )}
                                                                    {isUserSelected && mode === "admin" && !isCorrect && (
                                                                        <span className="inline-flex items-center gap-1 text-rose-200">
                                                                            <XCircle className="w-3 h-3" />
                                                                            Chosen
                                                                        </span>
                                                                    )}
                                                                    {isUserSelected && mode === "student" && (
                                                                        <span className="inline-flex items-center gap-1 text-slate-200">
                                                                            Your answer
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                    : // SINGLE / MULTI CHOICE
                                                    ["A", "B", "C", "D"].map((opt) => {
                                                        const text = currentQ[
                                                            `option_${opt.toLowerCase()}`
                                                        ];
                                                        if (!text) return null;

                                                        const isUserSelected = currentUserNorm
                                                            .split(",")
                                                            .includes(opt);
                                                        const isCorrect =
                                                            currentCorrectNorm
                                                                .split(",")
                                                                .includes(opt) && mode === "admin";

                                                        let bg = "bg-slate-900/90 border-slate-700";
                                                        if (mode === "admin") {
                                                            if (isCorrect && isUserSelected) {
                                                                bg =
                                                                    "bg-emerald-900/60 border-emerald-500 shadow-sm";
                                                            } else if (isCorrect) {
                                                                bg =
                                                                    "bg-emerald-900/40 border-emerald-500/70 shadow-sm";
                                                            } else if (isUserSelected) {
                                                                bg =
                                                                    "bg-rose-900/50 border-rose-500 shadow-sm";
                                                            }
                                                        } else {
                                                            if (isUserSelected && questionIsCorrect) {
                                                                bg =
                                                                    "bg-emerald-900/60 border-emerald-500 shadow-sm";
                                                            } else if (isUserSelected && !questionIsCorrect) {
                                                                bg =
                                                                    "bg-rose-900/50 border-rose-500 shadow-sm";
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={opt}
                                                                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm sm:text-base ${bg}`}
                                                            >
                                                                <div className="w-8 h-8 rounded-full border-2 border-slate-500 flex items-center justify-center text-sm font-bold bg-slate-950 text-slate-100">
                                                                    {opt}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-slate-50">
                                                                        {text as string}
                                                                    </p>
                                                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                                                                        {mode === "admin" && isCorrect && (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900 text-emerald-100 px-2 py-0.5 border border-emerald-500/80">
                                                                                <CheckCircle2 className="w-3 h-3" />
                                                                                Correct Option
                                                                            </span>
                                                                        )}
                                                                        {isUserSelected && mode === "admin" && !isCorrect && (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-900 text-rose-100 px-2 py-0.5 border border-rose-500/80">
                                                                                <XCircle className="w-3 h-3" />
                                                                                Your Choice
                                                                            </span>
                                                                        )}
                                                                        {isUserSelected && mode === "student" && (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-slate-100 px-2 py-0.5 border border-slate-600">
                                                                                Your Answer
                                                                            </span>
                                                                        )}
                                                                        {isUserSelected &&
                                                                            isCorrect &&
                                                                            mode === "admin" && (
                                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 text-emerald-950 px-2 py-0.5 border border-emerald-400">
                                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                                    Correct & Selected
                                                                                </span>
                                                                            )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        )}

                                        {/* SUBJECTIVE */}
                                        {currentQ.type === "descriptive" && (
                                            <div className="space-y-3">
                                                <div>
                                                    <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-1">
                                                        Your Answer
                                                    </p>
                                                    <div className="bg-slate-950/80 border border-slate-700 rounded-xl p-4 text-sm text-slate-100 whitespace-pre-wrap min-h-[120px]">
                                                        {currentUserRaw ? currentUserRaw : "Not answered."}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom nav */}
                                    <div className="px-4 sm:px-6 py-3 border-t border-slate-800 flex justify-between items-center bg-slate-950/80 rounded-b-2xl">
                                        <button
                                            onClick={handlePrev}
                                            disabled={currentIndex === 0}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-xs sm:text-sm font-semibold text-slate-100 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Previous
                                        </button>
                                        <div className="text-[11px] sm:text-xs text-slate-400">
                                            Question {currentIndex + 1} of {totalQuestions}
                                        </div>
                                        <button
                                            onClick={handleNext}
                                            disabled={currentIndex === totalQuestions - 1}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-slate-50 text-xs sm:text-sm font-semibold hover:bg-sky-500 shadow-sm shadow-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Next
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    No questions available for this attempt.
                                </div>
                            )}
                        </div>
                    ) : (
                        // QUESTION PAPER PANEL – text only list
                        <div className="bg-slate-900/80 rounded-2xl shadow-lg border border-slate-800 overflow-hidden flex flex-col h-full backdrop-blur-md">
                            <div className="px-4 sm:px-6 py-3 border-b border-slate-800 flex items-center gap-2">
                                <LayoutList className="w-4 h-4 text-slate-200" />
                                <h2 className="text-sm sm:text-base font-semibold text-slate-50">
                                    Question Paper
                                </h2>
                                <span className="ml-auto text-[11px] text-slate-400">
                                    {totalQuestions} Questions
                                </span>
                            </div>
                            <div className="flex-1 overflow-auto divide-y divide-slate-800/80">
                                {questions.map((q, idx) => {
                                    const status = getQuestionStatus(q);
                                    const anyQ: any = q;

                                    return (
                                        <button
                                            key={q.id}
                                            onClick={() => {
                                                setCurrentIndex(idx);
                                                setPanel("review");
                                            }}
                                            className="w-full text-left px-4 sm:px-6 py-3 hover:bg-slate-900 transition flex items-start gap-3"
                                        >
                                            <div className="mt-0.5">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sky-600 text-white text-xs font-bold">
                                                    {idx + 1}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-0.5">
                                                    {q.type === "single-choice"
                                                        ? "Single Choice"
                                                        : q.type === "multi-select"
                                                            ? "Multi Select"
                                                            : q.type === "true-false"
                                                                ? "True / False"
                                                                : "Subjective"}
                                                </p>
                                                <p className="text-sm text-slate-100 line-clamp-2">
                                                    {q.question_text}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                                    {typeof anyQ.points === "number" && (
                                                        <span>Marks: {anyQ.points}</span>
                                                    )}
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${getQuestionStatusPaletteClass(
                                                            status
                                                        )}`}
                                                    >
                                                        {status === "correct" && (
                                                            <CheckCircle2 className="w-3 h-3" />
                                                        )}
                                                        {status === "incorrect" && (
                                                            <XCircle className="w-3 h-3" />
                                                        )}
                                                        {status === "unanswered" && (
                                                            <AlertTriangle className="w-3 h-3" />
                                                        )}
                                                        {status === "subjective" && (
                                                            <FileText className="w-3 h-3" />
                                                        )}
                                                        {status === "correct"
                                                            ? "Correct"
                                                            : status === "incorrect"
                                                                ? "Incorrect"
                                                                : status === "unanswered"
                                                                    ? "Not Answered"
                                                                    : "Subjective"}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Mobile palette (below) */}
                    <div className="lg:hidden bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg backdrop-blur-sm">
                        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4 text-sky-400" />
                            <span className="text-xs font-semibold text-slate-100">
                                Question Palette
                            </span>
                        </div>
                        <div className="px-3 py-3 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-auto">
                            {questions.map((q, idx) => {
                                const status = getQuestionStatus(q);
                                const isCurrent = idx === currentIndex;
                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => {
                                            setCurrentIndex(idx);
                                            setPanel("review");
                                        }}
                                        className={`text-[10px] h-8 rounded-lg border flex items-center justify-center font-bold ${getQuestionStatusPaletteClass(
                                            status
                                        )} ${isCurrent ? "ring-2 ring-sky-500/70" : ""
                                            }`}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* RIGHT: ANSWER SHEET / PALETTE (Desktop) */}
                <aside className="hidden lg:flex w-80 flex-col bg-slate-900/80 rounded-2xl border border-slate-800 shadow-lg overflow-hidden backdrop-blur-md">
                    <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4 text-sky-400" />
                            <span className="text-sm font-semibold text-slate-50">
                                Question Palette
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                            {answeredCount}/{totalQuestions} Answered
                        </span>
                    </div>
                    <div className="px-3 py-3 grid grid-cols-4 gap-2 overflow-auto">
                        {questions.map((q, idx) => {
                            const status = getQuestionStatus(q);
                            const isCurrent = idx === currentIndex;
                            return (
                                <button
                                    key={q.id}
                                    onClick={() => {
                                        setCurrentIndex(idx);
                                        setPanel("review");
                                    }}
                                    className={`h-9 text-[11px] rounded-lg border font-bold flex items-center justify-center transition ${getQuestionStatusPaletteClass(
                                        status
                                    )} ${isCurrent ? "ring-2 ring-sky-500/70" : ""
                                        }`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                    <div className="px-4 py-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1 bg-slate-950/80">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />{" "}
                            Correct
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-rose-500 inline-block" />{" "}
                            Incorrect
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-amber-400 inline-block" />{" "}
                            Not Answered
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded bg-slate-400 inline-block" />{" "}
                            Subjective
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
};

export default ExamReview;
