// src/components/AttemptTable.tsx
import React from "react";
import { Loader2 } from "lucide-react";
import type { Attempt } from "../../ExamResults";
import { AttemptRow } from "./AttemptRow";

type Props = {
    attempts: Attempt[];
    loading: boolean;
    onReviewClick: (attempt: Attempt) => void;
};

export const AttemptTable: React.FC<Props> = ({
    attempts,
    loading,
    onReviewClick,
}) => {
    if (loading) {
        return (
            <div className="py-10 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
            </div>
        );
    }

    if (!attempts.length) {
        return (
            <div className="py-10 text-center text-sm text-slate-400">
                No attempts found for this exam yet.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-950 border-b border-slate-800/80">
                    <tr>
                        <th className="px-4 sm:px-6 py-3 text-left font-semibold text-slate-300 uppercase text-[10px]">
                            Student
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left font-semibold text-slate-300 uppercase text-[10px]">
                            Score
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left font-semibold text-slate-300 uppercase text-[10px]">
                            Violations
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left font-semibold text-slate-300 uppercase text-[10px]">
                            Status
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left font-semibold text-slate-300 uppercase text-[10px]">
                            Action
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {attempts.map((attempt) => (
                        <AttemptRow
                            key={attempt.id}
                            attempt={attempt}
                            onReviewClick={onReviewClick}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};
