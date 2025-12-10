// src/components/AttemptCard.tsx
import React from "react";
import { Eye } from "lucide-react";
import api from "../../../lib/api";
import { ExamAttempt } from "../../../types/models";
import { ResultBadge } from "./ResultBadge";
import { StatsGrid } from "./StatsGrid";

type Props = {
    attempt: ExamAttempt;
    onOpenReview?: (attempt: ExamAttempt) => void;
};

export const AttemptCard: React.FC<Props> = ({ attempt, onOpenReview }) => {
    const handleViewReview = async () => {
        if (!onOpenReview) return;
        const res = await api.get(`/attempts/${attempt.id}`);
        onOpenReview(res.data);
    };

    return (
        <article className="bg-slate-900/80 border border-slate-800 rounded-xl shadow-md shadow-slate-900/40 p-4 sm:p-5">
            {/* Top row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-semibold text-slate-50">
                        {attempt.exam.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Attempted:{" "}
                        {new Date(attempt.started_at).toLocaleString()}
                    </p>
                </div>
                <ResultBadge
                    passed={attempt.passed}
                    isTerminated={attempt.is_terminated}
                />
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
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-slate-50 border border-sky-500 shadow-sm"
                    >
                        <Eye className="w-4 h-4" />
                        View Detailed Review
                    </button>
                )}
            </div>
        </article>
    );
};
