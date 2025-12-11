// src/components/StudentAttemptHistory.tsx
import React, { useEffect, useState } from "react";
import {
    ChevronLeft,
    History,
    Loader2,
    Eye,
    CheckCircle2,
    XCircle,
    AlertTriangle
} from "lucide-react";
import api from "../../lib/api";
import { ExamAttempt } from "../../types/models";

// ============================================================================
// SUB-COMPONENT: ResultBadge
// ============================================================================

type ResultBadgeProps = {
    passed: boolean;
    isTerminated: boolean;
};

const ResultBadge: React.FC<ResultBadgeProps> = ({ passed, isTerminated }) => {
    if (isTerminated) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                TERMINATED
            </span>
        );
    }

    if (passed) {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PASSED
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
        </span>
    );
};

// ============================================================================
// SUB-COMPONENT: StatsGrid
// ============================================================================

type Tone = "sky" | "cyan" | "violet" | "slate" | "emerald" | "rose";

// Updated for Dual Theme: Light mode uses pastel backgrounds, Dark mode uses translucent deep backgrounds
const toneClasses: Record<Tone, string> = {
    sky: "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-200",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-200",
    violet: "bg-violet-50 border-violet-200 text-violet-700 dark:bg-violet-950/40 dark:border-violet-800 dark:text-violet-200",
    slate: "bg-slate-100 border-slate-200 text-slate-700 dark:bg-slate-900/60 dark:border-slate-700 dark:text-slate-200",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200",
    rose: "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200",
};

const StatCard: React.FC<{
    label: string;
    value: string | number;
    tone: Tone;
}> = ({ label, value, tone }) => (
    <div className={`p-3 rounded-lg border text-xs sm:text-sm ${toneClasses[tone]}`}>
        <p className="font-semibold opacity-90 dark:opacity-80">{label}</p>
        <p className="text-base sm:text-lg font-bold mt-0.5">{value}</p>
    </div>
);

type StatsGridProps = {
    attempt: ExamAttempt;
};

const StatsGrid: React.FC<StatsGridProps> = ({ attempt }) => {
    const percent =
        attempt.total_points > 0
            ? Math.round((attempt.score / attempt.total_points) * 100)
            : 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center text-xs sm:text-sm">
            <StatCard label="Score" value={attempt.score} tone="sky" />
            <StatCard label="Percent" value={`${percent}%`} tone="cyan" />
            <StatCard label="Total Marks" value={attempt.total_points} tone="violet" />
            <StatCard label="Pass %" value={`${attempt.exam.passing_score}%`} tone="slate" />
            <StatCard
                label="Status"
                value={attempt.passed ? "Passed" : "Failed"}
                tone={attempt.passed ? "emerald" : "rose"}
            />
            <StatCard
                label="Cheating?"
                value={attempt.is_terminated ? "Yes" : "No"}
                tone={attempt.is_terminated ? "rose" : "emerald"}
            />
        </div>
    );
};

// ============================================================================
// SUB-COMPONENT: AttemptCard
// ============================================================================

type AttemptCardProps = {
    attempt: ExamAttempt;
    onOpenReview?: (attempt: ExamAttempt) => void;
};

const AttemptCard: React.FC<AttemptCardProps> = ({ attempt, onOpenReview }) => {
    const handleViewReview = async () => {
        if (!onOpenReview) return;
        try {
            const res = await api.get(`/attempts/${attempt.id}`);
            onOpenReview(res.data);
        } catch (error) {
            console.error("Failed to fetch review details", error);
        }
    };

    return (
        <article className="
      rounded-xl border shadow-sm p-4 sm:p-5 transition
      bg-white border-slate-200 shadow-slate-200/50
      dark:bg-slate-900/80 dark:border-slate-800 dark:shadow-slate-900/40
    ">
            {/* Top row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                        {attempt.exam.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Attempted: {new Date(attempt.started_at).toLocaleString()}
                    </p>
                </div>
                <ResultBadge passed={attempt.passed} isTerminated={attempt.is_terminated} />
            </div>

            {/* Stats */}
            <div className="mb-4">
                <StatsGrid attempt={attempt} />
            </div>

            {/* Footer */}
            <div className="flex justify-end">
                {onOpenReview && (
                    <button
                        onClick={handleViewReview}
                        className="
              inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-sm border
              bg-sky-600 text-white border-sky-600 hover:bg-sky-500
              dark:bg-sky-600 dark:text-slate-50 dark:border-sky-500 dark:hover:bg-sky-500
            "
                    >
                        <Eye className="w-4 h-4" />
                        View Detailed Review
                    </button>
                )}
            </div>
        </article>
    );
};

// ============================================================================
// SUB-COMPONENT: HistoryHeader
// ============================================================================

type HistoryHeaderProps = {
    onBack: () => void;
};

const HistoryHeader: React.FC<HistoryHeaderProps> = ({ onBack }) => {
    return (
        <header className="
      border-b sticky top-0 z-10 backdrop-blur-sm
      bg-white/80 border-slate-200 
      dark:bg-slate-900/95 dark:border-slate-800
    ">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="
              inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-colors
              text-slate-600 hover:text-slate-900
              dark:text-slate-400 dark:hover:text-slate-100
            "
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </button>

                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                        <div>
                            <h1 className="text-sm sm:text-lg font-semibold text-slate-900 dark:text-slate-50">
                                Exam History
                            </h1>
                            <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400">
                                View previous attempts & reviews
                            </p>
                        </div>
                    </div>
                </div>

                <span className="
          px-3 py-1 rounded-full text-[10px] font-semibold border
          bg-slate-50 border-slate-200 text-slate-600
          dark:bg-slate-950 dark:border-slate-700 dark:text-sky-300
        ">
                    CANDIDATE
                </span>
            </div>
        </header>
    );
};

// ============================================================================
// MAIN COMPONENT: StudentAttemptHistory
// ============================================================================

type Props = {
    onBack: () => void;
    onOpenReview?: (attempt: ExamAttempt) => void;
};

export function StudentAttemptHistory({ onBack, onOpenReview }: Props) {
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    async function loadHistory() {
        try {
            const res = await api.get("/student/attempts");
            setAttempts(res.data || []);
        } catch (err) {
            console.error("Failed to load attempt history", err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="w-7 h-7 animate-spin text-sky-600 dark:text-sky-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <HistoryHeader onBack={onBack} />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {attempts.length === 0 ? (
                    <div className="mt-10 text-center">
                        <div className="
              inline-flex items-center justify-center w-16 h-16 rounded-full mb-4
              bg-slate-100 dark:bg-slate-900
            ">
                            <History className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No History Found</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            You haven't completed any exams yet.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-5">
                        {attempts.map((attempt) => (
                            <AttemptCard
                                key={attempt.id}
                                attempt={attempt}
                                onOpenReview={onOpenReview}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}