import React from "react";
import {
    X,
    CheckCircle2,
    AlertTriangle,
    Flag,
    ListFilter,
    Check,
    Circle,
    Clock,
    ShieldAlert,
    ArrowRight,
} from "lucide-react";
import { Question } from "../../../types/models";

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    questions: Question[];
    answers: Record<string, string>;
    markedForReview: Set<string>;
    visited: Set<string>;
    timeLeft: number;
    warnings: number;
    MAX_WARNINGS: number;
    onQuestionJump: (index: number) => void;
};

const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
};

const ReviewAndSubmitModal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    questions,
    answers,
    markedForReview,
    visited,
    timeLeft,
    warnings,
    MAX_WARNINGS,
    onQuestionJump,
}) => {
    if (!isOpen) return null;

    const totalQuestions = questions.length;
    const answeredCount = Object.keys(answers).filter((qId) => answers[qId]).length;
    const markedCount = markedForReview.size;
    const unansweredCount = totalQuestions - answeredCount;
    const skippedCount = questions.filter(
        (q) => visited.has(q.id) && !answers[q.id] && !markedForReview.has(q.id)
    ).length;
    const unseenCount = totalQuestions - visited.size;

    const getQuestionStatus = (q: Question, index: number) => {
        const isAnswered = !!answers[q.id];
        const isMarked = markedForReview.has(q.id);
        const isVisited = visited.has(q.id);

        let status: { icon: React.ReactNode; text: string; color: string };

        if (isAnswered && isMarked) {
            status = {
                icon: <CheckCircle2 className="w-3 h-3 text-violet-600 dark:text-violet-300" />,
                text: "Answered & Marked",
                color:
                    "bg-violet-100 border border-violet-300 text-violet-800 dark:bg-violet-950/60 dark:border-violet-800 dark:text-violet-100",
            };
        } else if (isAnswered) {
            status = {
                icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-300" />,
                text: "Answered",
                color:
                    "bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-100",
            };
        } else if (isMarked) {
            status = {
                icon: <Flag className="w-3 h-3 text-violet-600 dark:text-violet-300" />,
                text: "Marked",
                color:
                    "bg-violet-100 border border-violet-300 text-violet-800 dark:bg-violet-950/60 dark:border-violet-800 dark:text-violet-100",
            };
        } else if (isVisited) {
            status = {
                icon: <ArrowRight className="w-3 h-3 text-amber-600 dark:text-amber-300" />,
                text: "Visited",
                color:
                    "bg-amber-100 border border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-100",
            };
        } else {
            status = {
                icon: <Circle className="w-3 h-3 text-slate-500 dark:text-slate-500" />,
                text: "Not Visited",
                color:
                    "bg-slate-100 border border-slate-300 text-slate-700 dark:bg-slate-950/60 dark:border-slate-800 dark:text-slate-300",
            };
        }

        return (
            <button
                key={q.id}
                onClick={() => {
                    onQuestionJump(index);
                    onClose();
                }}
                className={`flex items-center gap-2 p-2.5 rounded-md text-xs md:text-sm font-medium transition-colors text-left hover:bg-slate-200 dark:hover:bg-slate-900 ${status.color}`}
            >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {status.icon}
                </div>
                <span className="truncate">Question {index + 1}</span>
                <span className="ml-auto hidden sm:inline-block text-[10px] uppercase tracking-wide opacity-80">
                    {status.text}
                </span>
            </button>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 md:p-6">
            <div className="bg-white border border-slate-300 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden dark:bg-slate-950 dark:border-slate-800">
                {/* Header */}
                <div className="px-5 md:px-7 py-4 border-b border-slate-300 flex items-center justify-between bg-slate-50 dark:bg-slate-950 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-emerald-100 border border-emerald-300 dark:bg-emerald-900/50 dark:border-emerald-700">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-50">
                                Review & Confirm Submission
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Check your progress before submitting.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-900 dark:hover:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 md:px-7 py-5 space-y-6 bg-white dark:bg-slate-950">
                    {/* Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-50 border border-slate-300 rounded-lg p-3 md:p-4 dark:bg-slate-900/80 dark:border-slate-800">
                        <SummaryItem label="Total Questions" value={totalQuestions} icon={<ListFilter className="w-4 h-4 text-sky-600 dark:text-sky-300" />} />
                        <SummaryItem label="Answered" value={answeredCount} icon={<Check className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />} />
                        <SummaryItem label="Unanswered" value={unansweredCount} icon={<X className="w-4 h-4 text-rose-600 dark:text-rose-300" />} />
                        <SummaryItem label="Marked" value={markedCount} icon={<Flag className="w-4 h-4 text-violet-600 dark:text-violet-300" />} />
                        <SummaryItem label="Skipped" value={skippedCount} icon={<ArrowRight className="w-4 h-4 text-amber-600 dark:text-amber-300" />} />
                        <SummaryItem label="Not Visited" value={unseenCount} icon={<Circle className="w-4 h-4 text-slate-500" />} />
                    </div>

                    {/* Time + Warnings */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-300 rounded-lg px-3 py-3 dark:bg-slate-900/80 dark:border-slate-800">
                            <div className="p-2 rounded-full bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-700">
                                <Clock className="w-5 h-5 text-sky-600 dark:text-sky-300" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide dark:text-slate-400">
                                    Time Remaining
                                </p>
                                <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{formatTime(timeLeft)}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-300 rounded-lg px-3 py-3 dark:bg-slate-900/80 dark:border-slate-800">
                            <div className="p-2 rounded-full bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-700">
                                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-300" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide dark:text-slate-400">
                                    System Warnings
                                </p>
                                <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                                    {warnings} / {MAX_WARNINGS}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Alerts */}
                    {(unansweredCount > 0 || warnings > 0) && (
                        <div className="p-3 md:p-4 bg-amber-100 border border-amber-300 rounded-lg flex gap-3 text-xs md:text-sm text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-100">
                            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-300" />
                            <div className="space-y-1">
                                <p className="font-semibold">Review before submitting:</p>
                                {unansweredCount > 0 && <p>- {unansweredCount} unanswered question(s).</p>}
                                {warnings > 0 && <p>- {warnings}/{MAX_WARNINGS} system warnings recorded.</p>}
                            </div>
                        </div>
                    )}

                    {/* Critical warnings */}
                    {warnings >= MAX_WARNINGS - 1 && (
                        <div className="p-3 md:p-4 bg-rose-100 border border-rose-300 rounded-lg flex gap-3 text-xs md:text-sm text-rose-800 dark:bg-rose-950/50 dark:border-rose-700 dark:text-rose-100">
                            <ShieldAlert className="w-4 h-4 md:w-5 md:h-5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-300" />
                            <div className="space-y-1">
                                <p className="font-semibold">Critical Warning</p>
                                <p>You are close to the maximum allowed system violations.</p>
                            </div>
                        </div>
                    )}

                    {/* Question Status List */}
                    <div className="space-y-3">
                        <h3 className="text-sm md:text-base font-semibold text-slate-900 border-b border-slate-300 pb-2 dark:text-slate-100 dark:border-slate-800">
                            Question-wise Status
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {questions.map((q, index) => getQuestionStatus(q, index))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 md:px-7 py-4 border-t border-slate-300 bg-slate-50 flex flex-col sm:flex-row justify-between gap-2 dark:border-slate-800 dark:bg-slate-950">
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        After submission, no further changes are allowed.
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                            Return to Exam
                        </button>

                        <button
                            onClick={onSubmit}
                            className="px-4 md:px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm & Submit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* Summary Item component */
const SummaryItem: React.FC<{
    label: string;
    value: string | number;
    icon: React.ReactNode;
}> = ({ label, value, icon }) => (
    <div className="flex items-center gap-3 p-2.5 bg-white border border-slate-300 rounded-md dark:bg-slate-950/70 dark:border-slate-800">
        <div className="p-2 rounded-full bg-slate-100 border border-slate-300 dark:bg-slate-900 dark:border-slate-700">
            {icon}
        </div>
        <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
            </p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
                {value}
            </p>
        </div>
    </div>
);

export default ReviewAndSubmitModal;
