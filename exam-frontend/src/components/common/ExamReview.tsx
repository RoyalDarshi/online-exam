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
import { ExamAttempt } from "../../types/models";

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
                    "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-700",
                icon: <ShieldAlert className="w-4 h-4" />,
            };
        }
        if (passed) {
            return {
                label: "PASSED",
                className:
                    "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700",
                icon: <CheckCircle2 className="w-4 h-4" />,
            };
        }
        return {
            label: "FAILED",
            className:
                "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700",
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
                return "bg-emerald-100 text-emerald-800 border border-emerald-400 dark:bg-emerald-900/70 dark:text-emerald-100 dark:border-emerald-500";
            case "incorrect":
                return "bg-rose-100 text-rose-800 border border-rose-400 dark:bg-rose-900/70 dark:text-rose-100 dark:border-rose-500";
            case "unanswered":
                return "bg-amber-100 text-amber-800 border border-amber-400 dark:bg-amber-900/60 dark:text-amber-50 dark:border-amber-400";
            case "subjective":
                return "bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-900/80 dark:text-slate-200 dark:border-slate-500";
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
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-800 border border-slate-300 dark:bg-slate-900/80 dark:text-slate-100 dark:border-slate-600">
                    <FileText className="w-3 h-3" />
                    Subjective (Manual evaluation)
                </span>
            );
        }

        if (!currentUserNorm) {
            return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-xs font-semibold text-amber-800 border border-amber-300 dark:bg-amber-900/70 dark:text-amber-100 dark:border-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    Not Answered
                </span>
            );
        }

        if (!currentCorrectNorm) {
            return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-800 border border-slate-300 dark:bg-slate-900/80 dark:text-slate-100 dark:border-slate-600">
                    <FileText className="w-3 h-3" />
                    Answer Recorded
                </span>
            );
        }

        if (questionIsCorrect) {
            return (
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800 border border-emerald-300 dark:bg-emerald-900/70 dark:text-emerald-100 dark:border-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    Correct
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-100 text-xs font-semibold text-rose-800 border border-rose-300 dark:bg-rose-900/70 dark:text-rose-100 dark:border-rose-600">
                <XCircle className="w-3 h-3" />
                Incorrect
            </span>
        );
    })();

    // -------- RENDER --------
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col">
            {/* HEADER */}
            <header className="bg-white/95 border-b border-slate-200 shadow-sm backdrop-blur-sm sticky top-0 z-30 dark:bg-slate-900/95 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-semibold dark:text-slate-300 dark:hover:text-slate-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                        <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold dark:text-slate-400">
                                Exam Review
                            </p>
                            <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 truncate dark:text-slate-50">
                                {exam.title || "Exam"}
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-300 text-xs sm:text-sm font-semibold text-slate-800 flex items-center gap-2 dark:bg-slate-950/80 dark:border-slate-700 dark:text-slate-200">
                            <Clock className="w-3 h-3 text-sky-500 dark:text-sky-400" />
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
                        {/* Score card */}
                        <div className="bg-sky-600 text-white rounded-xl px-3 py-2.5 flex flex-col justify-center shadow-lg shadow-sky-500/30">
                            <span className="text-[11px] uppercase tracking-wide text-sky-100">
                                Score
                            </span>
                            <span className="text-base sm:text-lg font-bold">
                                {score}/{totalPoints}{" "}
                                <span className="text-xs text-sky-100">({percent}%)</span>
                            </span>
                        </div>

                        <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-200 flex flex-col justify-center dark:bg-slate-900/80 dark:border-slate-700">
                            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Answered / Total
                            </span>
                            <span className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                                {answeredCount}/{totalQuestions}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Unanswered: {unansweredCount}
                            </span>
                        </div>

                        <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-200 flex flex-col justify-center dark:bg-slate-900/80 dark:border-slate-700">
                            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Correct / Incorrect
                            </span>
                            <span className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                                {correctCount}/{incorrectCount}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Subjective: {subjectiveCount}
                            </span>
                        </div>

                        <div className="bg-white rounded-xl px-3 py-2.5 border border-slate-200 flex flex-col justify-center dark:bg-slate-900/80 dark:border-slate-700">
                            <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Violations
                            </span>
                            <span className="text-base sm:text-lg font-semibold flex items-center gap-1">
                                {violations > 0 ? (
                                    <>
                                        <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                        <span className="text-amber-700 dark:text-amber-200">
                                            {violations}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                                        <span className="text-emerald-700 dark:text-emerald-200">
                                            Clean
                                        </span>
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
                    <div className="bg-white/80 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between px-3 py-2 backdrop-blur dark:bg-slate-900/70 dark:border-slate-800">
                        <div className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <MousePointerClick className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                            <span>
                                Question {totalQuestions ? currentIndex + 1 : 0} of{" "}
                                {totalQuestions}
                            </span>
                        </div>
                        <div className="inline-flex bg-slate-100 rounded-full p-1 text-xs border border-slate-200 dark:bg-slate-950/70 dark:border-slate-800">
                            <button
                                onClick={() => setPanel("review")}
                                className={`px-3 py-1.5 rounded-full flex items-center gap-1 font-semibold transition ${panel === "review"
                                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50"
                                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                    }`}
                            >
                                <FileText className="w-3 h-3" />
                                Review
                            </button>
                            <button
                                onClick={() => setPanel("paper")}
                                className={`px-3 py-1.5 rounded-full flex items-center gap-1 font-semibold transition ${panel === "paper"
                                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-50"
                                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                                    }`}
                            >
                                <LayoutList className="w-3 h-3" />
                                Question Paper
                            </button>
                        </div>
                    </div>

                    {/* Panel content */}
                    {panel === "review" ? (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 flex flex-col h-full backdrop-blur-md dark:bg-slate-900/80 dark:border-slate-800">
                            {currentQ ? (
                                <>
                                    {/* Question header */}
                                    <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-slate-200 flex flex-wrap items-center gap-3 justify-between bg-slate-50 dark:bg-slate-900/80 dark:border-slate-800">
                                        <div className="flex items-center gap-3">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-sky-600 text-white text-sm font-bold shadow-sm">
                                                {currentIndex + 1}
                                            </span>
                                            <div className="space-y-0.5">
                                                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold dark:text-slate-400">
                                                    {currentQ.type === "single-choice"
                                                        ? "Single Choice Question"
                                                        : currentQ.type === "multi-select"
                                                            ? "Multi Select Question"
                                                            : currentQ.type === "true-false"
                                                                ? "True / False Question"
                                                                : "Subjective Question"}
                                                </p>
                                                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                    {typeof currentAny.points === "number" && (
                                                        <span>
                                                            Marks:{" "}
                                                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                                {currentAny.points}
                                                            </span>
                                                        </span>
                                                    )}
                                                    {typeof currentAny.negative_marks === "number" &&
                                                        currentAny.negative_marks !== 0 && (
                                                            <span>
                                                                Negative:{" "}
                                                                <span className="font-semibold text-rose-600 dark:text-rose-300">
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
                                    <div className="px-4 sm:px-6 py-4 flex-1 space-y-5 overflow-auto bg-white dark:bg-slate-900/80">
                                        {/* Question */}
                                        <div className="bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200 dark:bg-slate-950/70 dark:border-slate-800">
                                            <p className="text-sm sm:text-base text-slate-900 leading-relaxed whitespace-pre-wrap dark:text-slate-50">
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

                                                        let bg =
                                                            "bg-slate-50 border-slate-200 dark:bg-slate-900/90 dark:border-slate-700";
                                                        if (mode === "admin") {
                                                            if (isCorrect && isUserSelected) {
                                                                bg =
                                                                    "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-500";
                                                            } else if (isCorrect) {
                                                                bg =
                                                                    "bg-emerald-50 border-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-500/70";
                                                            } else if (isUserSelected) {
                                                                bg =
                                                                    "bg-rose-100 border-rose-400 dark:bg-rose-900/50 dark:border-rose-500";
                                                            }
                                                        } else {
                                                            if (isUserSelected && questionIsCorrect) {
                                                                bg =
                                                                    "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-500";
                                                            } else if (isUserSelected && !questionIsCorrect) {
                                                                bg =
                                                                    "bg-rose-100 border-rose-400 dark:bg-rose-900/50 dark:border-rose-500";
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={label}
                                                                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm sm:text-base ${bg}`}
                                                            >
                                                                <div className="w-7 h-7 rounded-full border-2 border-slate-400 flex items-center justify-center text-xs font-bold bg-white text-slate-800 dark:border-slate-500 dark:bg-slate-950 dark:text-slate-100">
                                                                    {label === "True" ? "T" : "F"}
                                                                </div>
                                                                <span className="font-medium text-slate-900 dark:text-slate-50">
                                                                    {label}
                                                                </span>
                                                                <div className="ml-auto flex items-center gap-1 text-[11px] font-semibold">
                                                                    {mode === "admin" && isCorrect && (
                                                                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-200">
                                                                            <CheckCircle2 className="w-3 h-3" />
                                                                            Correct
                                                                        </span>
                                                                    )}
                                                                    {isUserSelected &&
                                                                        mode === "admin" &&
                                                                        !isCorrect && (
                                                                            <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-200">
                                                                                <XCircle className="w-3 h-3" />
                                                                                Chosen
                                                                            </span>
                                                                        )}
                                                                    {isUserSelected &&
                                                                        mode === "student" && (
                                                                            <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200">
                                                                                Your answer
                                                                            </span>
                                                                        )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                    : // SINGLE / MULTI CHOICE
                                                    ["A", "B", "C", "D"].map((opt) => {
                                                        const text =
                                                            currentQ[
                                                            `option_${opt.toLowerCase()}` as keyof typeof currentQ
                                                            ];
                                                        if (!text) return null;

                                                        const isUserSelected = currentUserNorm
                                                            .split(",")
                                                            .includes(opt);
                                                        const isCorrect =
                                                            currentCorrectNorm
                                                                .split(",")
                                                                .includes(opt) && mode === "admin";

                                                        let bg =
                                                            "bg-slate-50 border-slate-200 dark:bg-slate-900/90 dark:border-slate-700";
                                                        if (mode === "admin") {
                                                            if (isCorrect && isUserSelected) {
                                                                bg =
                                                                    "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-500";
                                                            } else if (isCorrect) {
                                                                bg =
                                                                    "bg-emerald-50 border-emerald-300 dark:bg-emerald-900/40 dark:border-emerald-500/70";
                                                            } else if (isUserSelected) {
                                                                bg =
                                                                    "bg-rose-100 border-rose-400 dark:bg-rose-900/50 dark:border-rose-500";
                                                            }
                                                        } else {
                                                            if (isUserSelected && questionIsCorrect) {
                                                                bg =
                                                                    "bg-emerald-100 border-emerald-400 dark:bg-emerald-900/60 dark:border-emerald-500";
                                                            } else if (isUserSelected && !questionIsCorrect) {
                                                                bg =
                                                                    "bg-rose-100 border-rose-400 dark:bg-rose-900/50 dark:border-rose-500";
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={opt}
                                                                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm sm:text-base ${bg}`}
                                                            >
                                                                <div className="w-8 h-8 rounded-full border-2 border-slate-400 flex items-center justify-center text-sm font-bold bg-white text-slate-800 dark:border-slate-500 dark:bg-slate-950 dark:text-slate-100">
                                                                    {opt}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-slate-900 dark:text-slate-50">
                                                                        {text as string}
                                                                    </p>
                                                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold">
                                                                        {mode === "admin" && isCorrect && (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 px-2 py-0.5 border dark:border-emerald-400 dbg-emerald-900 dark:text-emerald-100 dark:border-emerald-500/80">
                                                                                <CheckCircle2 className="w-3 h-3" />
                                                                                Correct Option
                                                                            </span>
                                                                        )}
                                                                        {isUserSelected &&
                                                                            mode === "admin" &&
                                                                            !isCorrect && (
                                                                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 border border-rose-400 dark:bg-rose-900 dark:text-rose-100 dark:border-rose-500/80">
                                                                                    <XCircle className="w-3 h-3" />
                                                                                    Your Choice
                                                                                </span>
                                                                            )}
                                                                        {isUserSelected && mode === "student" && (
                                                                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-800 px-2 py-0.5 border border-slate-300 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600">
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
                                                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1 dark:text-slate-400">
                                                        Your Answer
                                                    </p>
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-900 whitespace-pre-wrap min-h-[120px] dark:bg-slate-950/80 dark:border-slate-700 dark:text-slate-100">
                                                        {currentUserRaw ? currentUserRaw : "Not answered."}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Bottom nav */}
                                    <div className="px-4 sm:px-6 py-3 border-t border-slate-200 flex justify-between items-center bg-slate-50 rounded-b-2xl dark:bg-slate-950/80 dark:border-slate-800">
                                        <button
                                            onClick={handlePrev}
                                            disabled={currentIndex === 0}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Previous
                                        </button>
                                        <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                            Question {currentIndex + 1} of {totalQuestions}
                                        </div>
                                        <button
                                            onClick={handleNext}
                                            disabled={currentIndex === totalQuestions - 1}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-xs sm:text-sm font-semibold hover:bg-sky-500 shadow-sm shadow-sky-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Next
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="p-8 text-center text-slate-500 text-sm dark:text-slate-400">
                                    No questions available for this attempt.
                                </div>
                            )}
                        </div>
                    ) : (
                        // QUESTION PAPER PANEL – text only list
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col h-full backdrop-blur-md dark:bg-slate-900/80 dark:border-slate-800">
                            <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
                                <LayoutList className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                                <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-50">
                                    Question Paper
                                </h2>
                                <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
                                    {totalQuestions} Questions
                                </span>
                            </div>
                            <div className="flex-1 overflow-auto divide-y divide-slate-200 dark:divide-slate-800/80 bg-white dark:bg-slate-900/80">
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
                                            className="w-full text-left px-4 sm:px-6 py-3 hover:bg-slate-50 transition flex items-start gap-3 dark:hover:bg-slate-900"
                                        >
                                            <div className="mt-0.5">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sky-600 text-white text-xs font-bold">
                                                    {idx + 1}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-0.5 dark:text-slate-400">
                                                    {q.type === "single-choice"
                                                        ? "Single Choice"
                                                        : q.type === "multi-select"
                                                            ? "Multi Select"
                                                            : q.type === "true-false"
                                                                ? "True / False"
                                                                : "Subjective"}
                                                </p>
                                                <p className="text-sm text-slate-900 line-clamp-2 dark:text-slate-100">
                                                    {q.question_text}
                                                </p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                                    {typeof anyQ.points === "number" && (
                                                        <span>Marks: {anyQ.points}</span>
                                                    )}
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${getQuestionStatusPaletteClass(
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
                    <div className="lg:hidden bg-white rounded-2xl border border-slate-200 shadow-lg backdrop-blur-sm dark:bg-slate-900/80 dark:border-slate-800">
                        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                            <MousePointerClick className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                                Question Palette
                            </span>
                        </div>
                        <div className="px-3 py-3 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-auto bg-white dark:bg-slate-900/80">
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
                                        className={`text-[10px] h-8 rounded-lg flex items-center justify-center font-bold ${getQuestionStatusPaletteClass(
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
                <aside className="hidden lg:flex w-80 flex-col bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden backdrop-blur-md dark:bg-slate-900/80 dark:border-slate-800">
                    <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <MousePointerClick className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                                Question Palette
                            </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {answeredCount}/{totalQuestions} Answered
                        </span>
                    </div>
                    <div className="px-3 py-3 grid grid-cols-4 gap-2 overflow-auto bg-white dark:bg-slate-900/80">
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
                                    className={`h-9 text-[11px] rounded-lg font-bold flex items-center justify-center transition ${getQuestionStatusPaletteClass(
                                        status
                                    )} ${isCurrent ? "ring-2 ring-sky-500/70" : ""}`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                    <div className="px-4 py-3 border-t border-slate-200 text-[11px] text-slate-500 space-y-1 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
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
