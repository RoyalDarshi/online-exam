// src/components/teacher/TeacherAnalytics.tsx
import React from "react";
import { TeacherQuestion } from "../TeacherDashboard";

type Props = {
    questions: TeacherQuestion[];
};

export function TeacherAnalytics({ questions }: Props) {
    const stats = questions.reduce((acc, q) => {
        acc.total++;
        const c = q.complexity.toLowerCase();
        if (c === 'easy') acc.easy++;
        if (c === 'medium') acc.medium++;
        if (c === 'hard') acc.hard++;

        const subj = q.subject || 'Unknown';
        acc.subjects[subj] = (acc.subjects[subj] || 0) + 1;

        return acc;
    }, { total: 0, easy: 0, medium: 0, hard: 0, subjects: {} as Record<string, number> });

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Questions" value={stats.total} color="bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-800" />
                <StatCard label="Easy" value={stats.easy} color="bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800" />
                <StatCard label="Medium" value={stats.medium} color="bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800" />
                <StatCard label="Hard" value={stats.hard} color="bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-200 dark:border-rose-800" />
            </div>

            {/* Subject Distribution */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Subject Distribution</h3>
                <div className="space-y-3">
                    {Object.entries(stats.subjects).map(([subject, count]) => (
                        <div key={subject}>
                            <div className="flex justify-between text-sm mb-1 text-slate-600 dark:text-slate-400">
                                <span>{subject}</span>
                                <span className="font-semibold">{count}</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                                <div
                                    className="bg-sky-600 h-2 rounded-full"
                                    style={{ width: `${(count / stats.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                    {questions.length === 0 && (
                        <p className="text-center text-slate-500 py-4">No data available</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className={`p-4 rounded-xl border ${color}`}>
            <p className="text-xs font-bold uppercase opacity-70">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
    );
}