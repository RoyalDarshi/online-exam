// src/components/StatsGrid.tsx
import React from "react";
import { ExamAttempt } from "../../../types/models";

type Props = {
    attempt: ExamAttempt;
};

export const StatsGrid: React.FC<Props> = ({ attempt }) => {
    const percent =
        attempt.total_points > 0
            ? Math.round((attempt.score / attempt.total_points) * 100)
            : 0;

    return (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center text-xs sm:text-sm">
            <StatCard
                label="Score"
                value={attempt.score}
                tone="sky"
            />
            <StatCard
                label="Percent"
                value={`${percent}%`}
                tone="cyan"
            />
            <StatCard
                label="Total Marks"
                value={attempt.total_points}
                tone="violet"
            />
            <StatCard
                label="Pass %"
                value={`${attempt.exam.passing_score}%`}
                tone="slate"
            />
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

type Tone =
    | "sky"
    | "cyan"
    | "violet"
    | "slate"
    | "emerald"
    | "rose";

const toneClasses: Record<Tone, string> = {
    sky: "bg-sky-950/40 border-sky-800 text-sky-200",
    cyan: "bg-cyan-950/40 border-cyan-800 text-cyan-200",
    violet: "bg-violet-950/40 border-violet-800 text-violet-200",
    slate: "bg-slate-900/60 border-slate-700 text-slate-200",
    emerald: "bg-emerald-950/40 border-emerald-800 text-emerald-200",
    rose: "bg-rose-950/40 border-rose-800 text-rose-200",
};

const StatCard: React.FC<{
    label: string;
    value: string | number;
    tone: Tone;
}> = ({ label, value, tone }) => (
    <div
        className={`p-3 rounded-lg border text-xs sm:text-sm ${toneClasses[tone]}`}
    >
        <p className="font-semibold opacity-80">{label}</p>
        <p className="text-base sm:text-lg font-bold mt-0.5">{value}</p>
    </div>
);
