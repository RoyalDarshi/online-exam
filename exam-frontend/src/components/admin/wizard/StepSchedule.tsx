// src/components/admin/wizard/StepSchedule.tsx
import React from "react";
import { Calendar, CheckCircle2, FileText, Timer, Trophy } from "lucide-react";

type Props = {
    meta: {
        title: string;
        desc: string;
        date: string;
        time: string;
        duration: number;
        passScore: number;
    };
    setMeta: (v: any) => void;
    loading: boolean;
    onSubmit: () => void;
    currentTotalMarks: number;
    enableNeg: boolean;
};

export const StepSchedule: React.FC<Props> = ({
    meta,
    setMeta,
    loading,
    onSubmit,
    currentTotalMarks,
    enableNeg,
}) => {
    return (
        <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">

            {/* Validation Success Banner */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl flex gap-4 items-start">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-bold text-emerald-800 dark:text-emerald-300">Design Validated Successfully</h3>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                        The question bank has sufficient questions for this configuration.
                        <br />
                        <strong>Total Marks: {currentTotalMarks}</strong> • Negative Marking: <strong>{enableNeg ? 'ON' : 'OFF'}</strong>
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-sky-600" /> Exam Schedule & Meta
                    </h2>
                </div>

                {/* Basic Info */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Exam Title</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input
                                className="w-full pl-10 p-3 rounded-lg border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                                placeholder="e.g. Mid-Term Physics Assessment"
                                value={meta.title}
                                onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description / Instructions</label>
                        <textarea
                            className="w-full p-3 rounded-lg border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none min-h-[100px]"
                            placeholder="Enter detailed instructions for candidates..."
                            value={meta.desc}
                            onChange={(e) => setMeta({ ...meta, desc: e.target.value })}
                        />
                    </div>
                </div>

                {/* Grid Options */}
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
                        <input
                            type="date"
                            className="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                            value={meta.date}
                            onChange={(e) => setMeta({ ...meta, date: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                        <input
                            type="time"
                            className="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                            value={meta.time}
                            onChange={(e) => setMeta({ ...meta, time: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            <Timer className="w-3 h-3" /> Duration (mins)
                        </label>
                        <input
                            type="number"
                            className="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                            value={meta.duration}
                            onChange={(e) => setMeta({ ...meta, duration: Number(e.target.value) })}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">
                            <Trophy className="w-3 h-3" /> Passing Score (%)
                        </label>
                        <input
                            type="number"
                            className="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                            value={meta.passScore}
                            onChange={(e) => setMeta({ ...meta, passScore: Number(e.target.value) })}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-8 border-t border-slate-200 dark:border-slate-800">
                <button
                    onClick={onSubmit}
                    disabled={loading}
                    className="
               bg-emerald-600 hover:bg-emerald-500 text-white 
               px-10 py-3 rounded-xl font-bold shadow-lg shadow-emerald-600/20 transition-all
               disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2
            "
                >
                    {loading ? "Creating Exam..." : "Launch Exam"}
                    {!loading && <CheckCircle2 className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
};