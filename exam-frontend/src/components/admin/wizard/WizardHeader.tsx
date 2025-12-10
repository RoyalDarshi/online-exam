import React from "react";
import { ArrowLeft, ChevronRight, Calculator } from "lucide-react";

type Props = {
    step: number;
    onBack: () => void;
    currentMarks: number;
    targetMarks: number;
    showStats: boolean;
};

export const WizardHeader: React.FC<Props> = ({
    step,
    onBack,
    currentMarks,
    targetMarks,
    showStats,
}) => {
    const percent =
        targetMarks > 0 ? Math.round((currentMarks / targetMarks) * 100) : 0;

    return (
        <header className="bg-gradient-to-r from-sky-600 to-sky-500 dark:from-sky-700 dark:to-sky-600 text-slate-50 border-b border-sky-700/60 dark:border-sky-500/60">
            <div className="px-4 sm:px-6 md:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Left: Back + title + steps */}
                <div className="flex items-start gap-3 md:gap-4">
                    <button
                        onClick={onBack}
                        className="mt-0.5 p-2 rounded-full bg-sky-500/40 hover:bg-sky-500/70 text-sky-50 shadow-sm border border-sky-300/40 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
                            Create Exam From Question Bank
                        </h1>
                        <div className="mt-1 flex items-center gap-2 text-[11px] sm:text-xs font-medium text-sky-100/90">
                            <span
                                className={
                                    step === 1
                                        ? "font-semibold text-white"
                                        : "opacity-80"
                                }
                            >
                                1. Structure & Design
                            </span>
                            <ChevronRight className="w-3 h-3 opacity-70" />
                            <span
                                className={
                                    step === 2
                                        ? "font-semibold text-white"
                                        : "opacity-80"
                                }
                            >
                                2. Schedule & Meta
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: stats */}
                {showStats && (
                    <div className="flex items-center gap-3 bg-sky-500/30 border border-sky-200/40 rounded-xl px-3 sm:px-4 py-2 shadow-sm">
                        <div className="p-2 rounded-lg bg-sky-600/60 border border-sky-300/40">
                            <Calculator className="w-5 h-5 text-slate-50" />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase tracking-wider text-sky-100/90 font-semibold">
                                Projected Marks
                            </div>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <span
                                    className={`font-mono text-lg font-bold ${currentMarks === targetMarks
                                        ? "text-emerald-200"
                                        : "text-amber-100"
                                        }`}
                                >
                                    {currentMarks}
                                </span>
                                <span className="text-sky-100/80 text-sm">
                                    / {targetMarks}
                                </span>
                                {targetMarks > 0 && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-sky-600/70 border border-sky-200/40 text-sky-50 font-semibold">
                                        {percent}%
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};
