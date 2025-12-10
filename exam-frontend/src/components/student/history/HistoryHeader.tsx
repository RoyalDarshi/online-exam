// src/components/HistoryHeader.tsx
import React from "react";
import { ChevronLeft, History } from "lucide-react";

type Props = {
    onBack: () => void;
};

export const HistoryHeader: React.FC<Props> = ({ onBack }) => {
    return (
        <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-400 hover:text-slate-100"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </button>
                    <div className="h-6 w-px bg-slate-700 hidden sm:block" />
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-sky-400" />
                        <div>
                            <h1 className="text-sm sm:text-lg font-semibold text-slate-50">
                                Exam History
                            </h1>
                            <p className="text-[11px] text-slate-400">
                                View your previous attempts and open detailed reviews.
                            </p>
                        </div>
                    </div>
                </div>

                <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-slate-950 border border-slate-700 text-sky-300">
                    CANDIDATE
                </span>
            </div>
        </header>
    );
};
