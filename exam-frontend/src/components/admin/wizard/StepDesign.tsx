import React, { useState } from "react";
import {
    BookOpen,
    Target,
    Settings2,
    Percent,
    Hash,
    AlertTriangle,
} from "lucide-react";

type Props = {
    subjects: any[];
    subject: string;
    setSubject: (v: string) => void;
    totalQuestions: number;
    setTotalQuestions: (v: number) => void;
    targetTotalMarks: number;
    setTargetTotalMarks: (v: number) => void;
    pts: { easy: number; medium: number; hard: number };
    setPts: (v: any) => void;
    enableNeg: boolean;
    setEnableNeg: (v: boolean) => void;
    neg: { easy: number; medium: number; hard: number };
    setNeg: (v: any) => void;
    counts: { easy: number; medium: number; hard: number };
    setCounts: (v: any) => void;
    loading: boolean;
    onNext: () => void;
    currentTotalQs: number;
};

export const StepDesign: React.FC<Props> = ({
    subjects,
    subject,
    setSubject,
    totalQuestions,
    setTotalQuestions,
    targetTotalMarks,
    setTargetTotalMarks,
    pts,
    setPts,
    enableNeg,
    setEnableNeg,
    neg,
    setNeg,
    counts,
    setCounts,
    loading,
    onNext,
    currentTotalQs,
}) => {
    const [distMode, setDistMode] = useState<"percent" | "count">("percent");
    console.log(subjects)
    const handleDistChange = (
        type: "easy" | "medium" | "hard",
        val: number
    ) => {
        let newCounts = { ...counts };

        if (distMode === "count") {
            newCounts[type] = val;
        } else {
            const count = Math.round((totalQuestions * val) / 100);
            newCounts[type] = count;
        }
        setCounts(newCounts);
    };

    return (
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 h-full">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-5 space-y-6 lg:space-y-8">
                {/* Subject & scope */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                        <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        Subject & Scope
                    </h3>

                    <select
                        className="w-full p-3 rounded-lg border bg-slate-50 text-slate-900 border-slate-200 outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                    >
                        <option value="">Select a Subject...</option>
                        {subjects.map((s) => (
                            <option key={s.subject} value={s.subject}>
                                {s.subject}
                            </option>
                        ))}
                    </select>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                                Total Marks
                            </label>
                            <input
                                type="number"
                                className="w-full bg-transparent font-bold text-slate-900 dark:text-slate-50 outline-none"
                                value={targetTotalMarks}
                                onChange={(e) => setTargetTotalMarks(Number(e.target.value))}
                            />
                        </div>
                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-1">
                                Total Questions
                            </label>
                            <input
                                type="number"
                                className="w-full bg-transparent font-bold text-slate-900 dark:text-slate-50 outline-none"
                                value={totalQuestions}
                                onChange={(e) => setTotalQuestions(Number(e.target.value))}
                            />
                        </div>
                    </div>
                </section>

                {/* Scoring rules */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                        <Settings2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        Scoring Rules
                    </h3>

                    <div className="space-y-3 text-sm">
                        {["easy", "medium", "hard"].map((level) => (
                            <div
                                key={level}
                                className="flex items-center justify-between gap-3"
                            >
                                <span
                                    className={`font-semibold capitalize w-20 ${level === "easy"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : level === "medium"
                                            ? "text-amber-600 dark:text-amber-400"
                                            : "text-rose-600 dark:text-rose-400"
                                        }`}
                                >
                                    {level}
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="w-16 p-1 text-center border rounded bg-white border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                                        value={pts[level as keyof typeof pts]}
                                        onChange={(e) =>
                                            setPts({ ...pts, [level]: Number(e.target.value) })
                                        }
                                    />
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        pts
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-7 flex flex-col space-y-6 lg:space-y-8">
                {/* Distribution */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                            <Target className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                            Question Distribution
                        </h3>

                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setDistMode("percent")}
                                className={`px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-md flex items-center gap-1 transition ${distMode === "percent"
                                    ? "bg-white dark:bg-slate-700 shadow text-sky-600 dark:text-sky-300"
                                    : "text-slate-500 dark:text-slate-400"
                                    }`}
                            >
                                <Percent className="w-3 h-3" /> %
                            </button>
                            <button
                                onClick={() => setDistMode("count")}
                                className={`px-3 py-1 text-[11px] sm:text-xs font-semibold rounded-md flex items-center gap-1 transition ${distMode === "count"
                                    ? "bg-white dark:bg-slate-700 shadow text-sky-600 dark:text-sky-300"
                                    : "text-slate-500 dark:text-slate-400"
                                    }`}
                            >
                                <Hash className="w-3 h-3" /> #
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {[
                            { key: "easy", color: "emerald", label: "Easy" },
                            { key: "medium", color: "amber", label: "Medium" },
                            { key: "hard", color: "rose", label: "Hard" },
                        ].map((item) => (
                            <div key={item.key} className="flex items-center gap-4">
                                <div
                                    className={`w-20 text-sm font-semibold text-${item.color}-600 dark:text-${item.color}-400`}
                                >
                                    {item.label}
                                </div>

                                {distMode === "percent" ? (
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        className={`flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer accent-${item.color}-600`}
                                        value={
                                            totalQuestions
                                                ? Math.round(
                                                    (counts[item.key as keyof typeof counts] /
                                                        totalQuestions) *
                                                    100
                                                ) || 0
                                                : 0
                                        }
                                        onChange={(e) =>
                                            handleDistChange(
                                                item.key as any,
                                                Number(e.target.value)
                                            )
                                        }
                                    />
                                ) : (
                                    <input
                                        type="number"
                                        className="flex-1 border border-slate-200 dark:border-slate-700 p-2 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                        value={counts[item.key as keyof typeof counts]}
                                        onChange={(e) =>
                                            handleDistChange(
                                                item.key as any,
                                                Number(e.target.value)
                                            )
                                        }
                                    />
                                )}

                                <div className="w-24 text-right font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                                    {counts[item.key as keyof typeof counts]} Qs
                                </div>
                            </div>
                        ))}

                        <div
                            className={`mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-right text-xs font-semibold ${currentTotalQs === totalQuestions
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                                }`}
                        >
                            Total Selected: {currentTotalQs} / {totalQuestions}
                        </div>
                    </div>
                </section>

                {/* Negative marking */}
                <section className="bg-rose-50/80 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/40 p-5">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-200 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableNeg}
                                onChange={(e) => setEnableNeg(e.target.checked)}
                                className="w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                            />
                            Enable Negative Marking
                        </label>
                        <AlertTriangle className="w-4 h-4 text-rose-400 dark:text-rose-300" />
                    </div>

                    {enableNeg && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                            {["easy", "medium", "hard"].map((level) => (
                                <div key={level}>
                                    <label className="block text-[11px] uppercase font-semibold text-rose-700 dark:text-rose-300 mb-1">
                                        {level} Penalty
                                    </label>
                                    <input
                                        type="number"
                                        step="0.25"
                                        className="w-full border border-rose-200 dark:border-rose-800 bg-white dark:bg-rose-950/40 text-rose-900 dark:text-rose-100 p-2 rounded text-center text-sm font-semibold"
                                        value={neg[level as keyof typeof neg]}
                                        onChange={(e) =>
                                            setNeg({ ...neg, [level]: Number(e.target.value) })
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Next button */}
                <div className="flex justify-end">
                    <button
                        onClick={onNext}
                        disabled={loading || !subject}
                        className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl font-semibold text-sm sm:text-base bg-sky-600 hover:bg-sky-500 text-white shadow-sm shadow-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Verifying..." : "Validate & Continue"}
                    </button>
                </div>
            </div>
        </div>
    );
};
