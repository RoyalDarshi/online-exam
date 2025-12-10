// ExamPreview.tsx — TCS iON Modern Navy Theme
import React, { useEffect, useState } from "react";
import { Exam } from "../lib/supabase";
import {
    ArrowLeft,
    Clock,
    CalendarDays,
    CheckCircle,
    AlertTriangle,
    PlayCircle,
} from "lucide-react";

type Props = {
    exam: Exam;
    onBack: () => void;
    onStart: () => void;
};

export function ExamPreview({ exam, onBack, onStart }: Props) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const startTime = exam.start_time
        ? new Date(exam.start_time).getTime()
        : null;
    const hasStart = !!startTime;
    const diffMs = hasStart ? startTime! - now : 0;

    const canStart = !hasStart || diffMs <= 0;

    const totalSec = Math.max(0, Math.floor(diffMs / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    const formattedStart = exam.start_time
        ? new Date(exam.start_time).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
        })
        : "Not scheduled";

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 shadow-xl overflow-hidden">

                {/* HEADER */}
                <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between bg-slate-900">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-300 hover:text-slate-100 text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </button>

                    <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-sky-300">
                        ONLINE ASSESSMENT
                    </span>
                </div>

                {/* BODY */}
                <div className="p-6 space-y-6">

                    {/* TITLE */}
                    <div>
                        <h1 className="text-2xl font-bold text-slate-100">
                            {exam.title}
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">
                            {exam.description}
                        </p>
                    </div>

                    {/* INFO CARDS */}
                    <div className="grid sm:grid-cols-3 gap-4 text-sm">
                        {/* Duration */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-sky-900/40 border border-sky-700 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-sky-300" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-[11px] uppercase font-semibold">
                                    Duration
                                </p>
                                <p className="font-semibold text-slate-200">
                                    {exam.duration_minutes} mins
                                </p>
                            </div>
                        </div>

                        {/* Passing Score */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-900/40 border border-emerald-700 flex items-center justify-center">
                                <CheckCircle className="w-4 h-4 text-emerald-300" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-[11px] uppercase font-semibold">
                                    Passing Score
                                </p>
                                <p className="font-semibold text-slate-200">
                                    {exam.passing_score}%
                                </p>
                            </div>
                        </div>

                        {/* Start Time */}
                        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-900/40 border border-indigo-700 flex items-center justify-center">
                                <CalendarDays className="w-4 h-4 text-indigo-300" />
                            </div>
                            <div>
                                <p className="text-slate-500 text-[11px] uppercase font-semibold">
                                    Start Time
                                </p>
                                <p className="font-semibold text-slate-200 text-xs sm:text-sm">
                                    {formattedStart}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* COUNTDOWN */}
                    {hasStart && (
                        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">

                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-300 mt-1" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-100">
                                        {canStart ? "Exam window is open" : "Exam will start soon"}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Please ensure a stable connection. Timer is server-validated.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center min-w-[140px]">
                                {!canStart && (
                                    <>
                                        <p className="text-[10px] uppercase text-slate-500 font-semibold">
                                            Starts in
                                        </p>
                                        <div className="mt-1 flex gap-1 text-base font-mono">
                                            {[h, m, s].map((v, idx) => (
                                                <React.Fragment key={idx}>
                                                    <span className="px-2 py-1 rounded-md bg-slate-950 border border-slate-700 text-slate-100">
                                                        {String(v).padStart(2, "0")}
                                                    </span>
                                                    {idx < 2 && (
                                                        <span className="px-0.5 text-slate-500">:</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {canStart && (
                                    <span className="text-xs font-medium text-emerald-300 bg-emerald-900/40 px-3 py-1 rounded-full mt-1">
                                        You can start now
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* RULES */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 space-y-1">
                        <p className="font-semibold text-slate-100 mb-1">
                            Before you start:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Keep your camera on; activity may be monitored.</li>
                            <li>Do not switch tabs or windows during the exam.</li>
                            <li>Internet must remain stable; time continues on server.</li>
                            <li>You cannot modify answers after submitting.</li>
                        </ul>
                    </div>

                    {/* ACTIONS */}
                    <div className="flex justify-between items-center pt-1">
                        <button
                            onClick={onBack}
                            className="text-sm text-slate-400 hover:text-slate-200"
                        >
                            Go Back
                        </button>

                        <button
                            disabled={!canStart}
                            onClick={onStart}
                            className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition
                ${canStart
                                    ? "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20"
                                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                                }`}
                        >
                            <PlayCircle className="w-5 h-5" />
                            {canStart ? "Start Exam" : "Wait"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
