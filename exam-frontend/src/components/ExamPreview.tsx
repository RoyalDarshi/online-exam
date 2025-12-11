import React, { useEffect, useState } from "react";
import {
    ArrowLeft,
    BookOpen,
    Clock,
    PlayCircle,
    Info,
    AlertTriangle,
    ShieldAlert,
} from "lucide-react";

import StudentNavbar from "./student/StudentNavbar";
import { useAuth } from "../contexts/AuthContext";
import { Exam } from "../types/models";
import { useExamGuard } from "../hooks/useExamGuard";
import { useExamGuardLockdown } from "../hooks/useExamGuardLockdown";

interface Props {
    exam: Exam;
    onBack: () => void;
    onStart: () => void;
}

export function ExamPreview({ exam, onBack, onStart }: Props) {
    const { user, signOut } = useAuth();

    const [timeLeft, setTimeLeft] = useState<string>("");
    const [hasAcknowledged, setHasAcknowledged] = useState(false);

    // ExamGuard status (polling true)
    const examGuardActive = useExamGuard(true);
    useExamGuardLockdown();


    const now = Date.now();
    const start = new Date(exam.start_time).getTime();
    const end = new Date(exam.end_time).getTime();

    const isUpcoming = now < start;
    const isClosed = now > end;
    const isActive = now >= start && now <= end;

    // Countdown only when upcoming
    useEffect(() => {
        if (!isUpcoming) return;

        const interval = setInterval(() => {
            const diff = start - Date.now();

            if (diff <= 0) {
                setTimeLeft("Starting now…");
                clearInterval(interval);
                return;
            }

            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);

            setTimeLeft(
                `${h.toString().padStart(2, "0")}h : ${m
                    .toString()
                    .padStart(2, "0")}m : ${s.toString().padStart(2, "0")}s`
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [exam.start_time]); // keep same as original

    const fmt = (s?: string) =>
        s ? new Date(s).toLocaleString() : "Not specified";

    const negativeEnabled = !!exam.enable_negative_marking;

    const canStart = isActive && hasAcknowledged && examGuardActive;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <StudentNavbar user={user} onLogout={signOut} onHistory={() => { }} />

            <main className="max-w-5xl mx-auto px-5 py-8">
                {/* Back */}
                <button
                    onClick={onBack}
                    className="
            mb-6 inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 border
            bg-white text-slate-700 border-slate-300 hover:bg-slate-100
            dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800
          "
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </button>

                {/* CLOSED STATE */}
                {isClosed && (
                    <section
                        className="
            p-8 rounded-2xl border shadow-sm text-center
            bg-white border-slate-200
            dark:bg-slate-900 dark:border-slate-800"
                    >
                        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                            Exam Window Closed
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                            You cannot start this exam.
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Start Time: {fmt(exam.start_time)}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            End Time: {fmt(exam.end_time)}
                        </p>
                    </section>
                )}

                {/* ACTIVE + UPCOMING → SAME PREVIEW */}
                {!isClosed && (
                    <section
                        className="
            p-6 md:p-7 rounded-2xl border shadow-sm
            bg-white border-slate-200
            dark:bg-slate-900 dark:border-slate-800"
                    >
                        {/* Header */}
                        <header className="mb-6 border-b border-slate-200 dark:border-slate-700 pb-3">
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <BookOpen className="w-6 h-6 text-sky-600 dark:text-sky-300" />
                                {exam.title}
                            </h1>
                        </header>

                        {/* ExamGuard status banner */}
                        <div
                            className={`
                mb-4 p-3 rounded-xl border flex items-center gap-3 text-sm
                ${examGuardActive
                                    ? "bg-emerald-50 border-emerald-400 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-100"
                                    : "bg-rose-50 border-rose-400 text-rose-800 dark:bg-rose-900/40 dark:border-rose-600 dark:text-rose-100"
                                }
              `}
                        >
                            <ShieldAlert className="w-5 h-5" />
                            <div className="flex-1">
                                {examGuardActive ? (
                                    <>
                                        <p className="font-semibold">ExamGuard is active.</p>
                                        <p className="text-xs opacity-80">
                                            Your system is secured. You can start the exam once the
                                            exam window opens.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-semibold">
                                            ExamGuard not detected on this system.
                                        </p>
                                        <p className="text-xs opacity-80">
                                            Please start <b>ExamGuard.exe</b>. The exam can only be
                                            started when ExamGuard is running.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* UPCOMING COUNTDOWN */}
                        {isUpcoming && (
                            <div
                                className="
                mb-6 p-4 rounded-xl border text-center
                bg-slate-50 border-slate-200
                dark:bg-slate-800/50 dark:border-slate-700"
                            >
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 tracking-wide uppercase">
                                    Exam starts in
                                </p>
                                <p className="text-xl font-bold text-sky-600 dark:text-sky-300">
                                    {timeLeft}
                                </p>
                            </div>
                        )}

                        {/* Candidate details */}
                        <div
                            className="
                mb-6 p-4 rounded-xl border
                bg-slate-50 border-slate-200
                dark:bg-slate-950/50 dark:border-slate-700"
                        >
                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        Candidate Name
                                    </span>
                                    <span className="font-medium text-slate-800 dark:text-slate-100">
                                        {user?.full_name}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        Candidate ID
                                    </span>
                                    <span className="font-medium text-slate-800 dark:text-slate-100">
                                        {user?.id}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        Duration
                                    </span>
                                    <span className="font-medium text-slate-800 dark:text-slate-100">
                                        {exam.duration_minutes} minutes
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        Passing Score
                                    </span>
                                    <span className="font-medium text-slate-800 dark:text-slate-100">
                                        {exam.passing_score}%
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Marking Scheme */}
                        <div
                            className="
                mb-6 p-4 rounded-xl border
                bg-white border-slate-200
                dark:bg-slate-950/50 dark:border-slate-700"
                        >
                            <h2 className="text-sm font-bold mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <Info className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                                Marking Scheme
                            </h2>

                            {negativeEnabled ? (
                                <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                                    <p>
                                        • Correct Answer: <b>+1</b>
                                    </p>
                                    <p>• Wrong (Easy): -{exam.negative_mark_easy}</p>
                                    <p>• Wrong (Medium): -{exam.negative_mark_medium}</p>
                                    <p>• Wrong (Hard): -{exam.negative_mark_hard}</p>
                                    <p>• Unattempted: 0</p>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Negative marking is disabled.
                                </p>
                            )}
                        </div>

                        {/* Instructions */}
                        <div
                            className="
                mb-6 p-4 rounded-xl border
                bg-white border-slate-200
                dark:bg-slate-950/50 dark:border-slate-700"
                        >
                            <h2 className="text-sm font-bold mb-3 text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                General Instructions
                            </h2>

                            <ol className="list-decimal ml-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
                                <li>Do not refresh or close the browser once exam starts.</li>
                                <li>Tab switching may be treated as a violation.</li>
                                <li>Timer will not stop once the test begins.</li>
                                <li>Read questions carefully before answering.</li>
                                <li>You can change answers before final submission.</li>
                                <li>If any issue occurs, contact the invigilator.</li>
                            </ol>
                        </div>

                        {/* Declaration + Start */}
                        <div
                            className="
                mt-4 pt-4 border-t border-slate-200 dark:border-slate-700
                flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                        >
                            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mt-1 accent-sky-600"
                                    checked={hasAcknowledged}
                                    onChange={(e) => setHasAcknowledged(e.target.checked)}
                                />
                                <span>I have read and understood the instructions.</span>
                            </label>

                            <button
                                disabled={!canStart}
                                onClick={onStart}
                                className={`
                  inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
                  shadow bg-sky-600 text-white hover:bg-sky-500
                  dark:bg-sky-600 dark:hover:bg-sky-500
                  disabled:opacity-60 disabled:cursor-not-allowed
                `}
                            >
                                <PlayCircle className="w-5 h-5" />
                                {examGuardActive ? "Start Test" : "Start Test (ExamGuard Required)"}
                            </button>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
