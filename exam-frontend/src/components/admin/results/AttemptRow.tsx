// src/components/AttemptRow.tsx
import React from "react";
import { Eye } from "lucide-react";
import type { Attempt } from "../../ExamResults";
import { StatusBadge } from "./StatusBadge";
import { ViolationBadge } from "./ViolationBadge";

type Props = {
    attempt: Attempt;
    onReviewClick: (review: Attempt) => void;
};

export const AttemptRow: React.FC<Props> = ({ attempt, onReviewClick }) => {
    const percent = attempt.total_points
        ? Math.round((attempt.score / attempt.total_points) * 100)
        : 0;

    return (
        <tr className="border-b border-slate-800/80 hover:bg-slate-900/70">
            {/* STUDENT */}
            <td className="px-4 sm:px-6 py-3 align-top">
                <div className="font-semibold text-slate-50 text-sm">
                    {attempt.student?.full_name || "Unknown"}
                </div>
                <div className="text-xs text-slate-400">
                    {attempt.student?.email}
                </div>
            </td>

            {/* SCORE */}
            <td className="px-4 sm:px-6 py-3 align-top text-sm text-slate-100">
                <div className="font-semibold">
                    {attempt.score}/{attempt.total_points}
                </div>
                <div className="text-xs text-slate-400">{percent}%</div>
            </td>

            {/* VIOLATIONS */}
            <td className="px-4 sm:px-6 py-3 align-top text-sm">
                <ViolationBadge tabSwitches={attempt.tab_switches} />
            </td>

            {/* STATUS */}
            <td className="px-4 sm:px-6 py-3 align-top text-sm">
                <StatusBadge
                    passed={attempt.passed}
                    isTerminated={attempt.is_terminated}
                />
            </td>

            {/* ACTION */}
            <td className="px-4 sm:px-6 py-3 align-top text-sm">
                <button
                    onClick={() => onReviewClick(attempt)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-700/80 hover:bg-sky-600 text-slate-50 border border-sky-500 shadow-sm"
                >
                    <Eye className="w-4 h-4" />
                    Review Sheet
                </button>
            </td>
        </tr>
    );
};
