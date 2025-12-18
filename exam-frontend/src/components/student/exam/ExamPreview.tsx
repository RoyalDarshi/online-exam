import React from "react";
import {
    ArrowLeft,
    BookOpen,
    PlayCircle,
    Info,
    AlertTriangle,
    ShieldAlert,
    Clock,
    CheckCircle2,
    HelpCircle,
    Trophy,
} from "lucide-react";

import StudentNavbar from "../StudentNavbar";
import { useAuth } from "../../../contexts/AuthContext";
import { Exam } from "../../../types/models";
import { useExamGuard } from "../../../hooks/useExamGuard";
import { useExamGuardLockdown } from "../../../hooks/useExamGuardLockdown";

interface Props {
    exam: Exam;
    onBack: () => void;
    onStart: () => void;
}

export function ExamPreview({ exam, onBack, onStart }: Props) {
    const { user, signOut } = useAuth();

    const [timeLeft, setTimeLeft] = React.useState<string>("");
    const [hasAcknowledged, setHasAcknowledged] = React.useState(false);

    // ExamGuard status (polling true)
    const examGuardActive = useExamGuard(true);
    useExamGuardLockdown();

    const now = Date.now();
    const start = new Date(exam.start_time).getTime();
    const end = new Date(exam.end_time).getTime();

    const isUpcoming = now < start;
    const isClosed = now > end;
    const isActive = now >= start && now <= end;

    // Countdown logic
    React.useEffect(() => {
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
    }, [exam.start_time, isUpcoming, start]);

    const fmt = (s?: string) =>
        s
            ? new Date(s).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            })
            : "Not specified";

    const negativeEnabled = !!exam.enable_negative_marking;
    const canStart = isActive && hasAcknowledged && examGuardActive;

    // Helper component for Difficulty Card
    const DifficultyCard = ({
        label,
        marks,
        negative,
        colorClass,
        bgClass,
        borderClass,
    }: {
        label: string;
        marks: number;
        negative: number;
        colorClass: string;
        bgClass: string;
        borderClass: string;
    }) => (
        <div
            className={`p-2 rounded-lg border ${bgClass} ${borderClass} flex flex-col items-center justify-center text-center`}
        >
            <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${colorClass}`}>
                {label}
            </span>
            <div className="w-full grid grid-cols-2 gap-2 mt-1">
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Correct</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-lg">+{marks}</span>
                </div>
                <div className="flex flex-col border-l border-slate-200 dark:border-slate-700/50">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Wrong</span>
                    <span className={`font-bold text-lg ${negativeEnabled ? "text-rose-500" : "text-slate-400"}`}>
                        {negativeEnabled ? `-${negative}` : "0"}
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
            <StudentNavbar user={user} onLogout={signOut} onHistory={() => { }} />

            <main className="max-w-4xl mx-auto px-4 py-2">
                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="
            mb-2 inline-flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2 border transition-colors
            bg-white text-slate-700 border-slate-300 hover:bg-slate-50
            dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800
          "
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Exams
                </button>

                {/* CLOSED STATE */}
                {isClosed && (
                    <div className="flex flex-col items-center justify-center py-2 px-4 rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 text-center shadow-sm">
                        <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-full mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                            Exam Window Closed
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md">
                            The scheduled time for this exam has passed. You can no longer attempt it.
                        </p>
                        <div className="flex gap-8 text-sm text-slate-500 dark:text-slate-400">
                            <div>
                                <span className="block text-xs uppercase tracking-wide opacity-70">Started</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{fmt(exam.start_time)}</span>
                            </div>
                            <div>
                                <span className="block text-xs uppercase tracking-wide opacity-70">Ended</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{fmt(exam.end_time)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ACTIVE / UPCOMING PREVIEW */}
                {!isClosed && (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

                        {/* Header Banner */}
                        <div className="p-3 md:p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/50">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                            {exam.subject || "General"}
                                        </span>
                                        {isActive && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                </span>
                                                Live Now
                                            </span>
                                        )}
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
                                        {exam.title}
                                    </h1>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-4">
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="w-4 h-4" />
                                            {exam.duration_minutes} Minutes
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Trophy className="w-4 h-4" />
                                            Pass: {exam.passing_score}%
                                        </span>
                                    </p>
                                </div>

                                {/* Countdown Box */}
                                {isUpcoming && (
                                    <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[220px]">
                                        <p className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                                            <Clock className="w-3 h-3" /> Starts In
                                        </p>
                                        <div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-sky-600 dark:text-sky-400">
                                            {timeLeft}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-2 md:p-4 space-y-4">

                            {/* ExamGuard Status */}
                            <div
                                className={`
                  p-2 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-colors
                  ${examGuardActive
                                        ? "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800"
                                        : "bg-rose-50/50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-800"
                                    }
                `}
                            >
                                <div
                                    className={`p-2 rounded-lg ${examGuardActive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                        }`}
                                >
                                    <ShieldAlert className="w-6 h-6" />
                                </div>
                                <div className="flex-1">
                                    <h3 className={`font-semibold ${examGuardActive ? "text-emerald-900 dark:text-emerald-200" : "text-rose-900 dark:text-rose-200"}`}>
                                        {examGuardActive ? "Secure Browser Active" : "Security Check Failed"}
                                    </h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                                        {examGuardActive
                                            ? "ExamGuard is running. Your environment is secure and ready."
                                            : "ExamGuard is not running. Please launch the application to proceed."}
                                    </p>
                                </div>
                                {!examGuardActive && (
                                    <div className="text-xs font-semibold px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 shadow-sm">
                                        Waiting for connection...
                                    </div>
                                )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Left Column: Marking & Stats */}
                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
                                            <BookOpen className="w-4 h-4 text-sky-600" />
                                            Marking Scheme
                                        </h3>

                                        {/* Visual Marking Grid */}
                                        <div className="grid grid-cols-3 gap-3">
                                            <DifficultyCard
                                                label="Easy"
                                                marks={exam.marks_easy}
                                                negative={exam.negative_mark_easy}
                                                colorClass="text-emerald-600 dark:text-emerald-400"
                                                bgClass="bg-emerald-50/50 dark:bg-emerald-950/20"
                                                borderClass="border-emerald-100 dark:border-emerald-900/50"
                                            />
                                            <DifficultyCard
                                                label="Medium"
                                                marks={exam.marks_medium}
                                                negative={exam.negative_mark_medium}
                                                colorClass="text-amber-600 dark:text-amber-400"
                                                bgClass="bg-amber-50/50 dark:bg-amber-950/20"
                                                borderClass="border-amber-100 dark:border-amber-900/50"
                                            />
                                            <DifficultyCard
                                                label="Hard"
                                                marks={exam.marks_hard}
                                                negative={exam.negative_mark_hard}
                                                colorClass="text-rose-600 dark:text-rose-400"
                                                bgClass="bg-rose-50/50 dark:bg-rose-950/20"
                                                borderClass="border-rose-100 dark:border-rose-900/50"
                                            />
                                        </div>

                                        <div className="mt-3 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                                            <Info className="w-4 h-4 shrink-0 text-slate-400" />
                                            <p>
                                                {negativeEnabled
                                                    ? "Negative marking is active. Marks will be deducted for incorrect answers based on difficulty."
                                                    : "Negative marking is disabled for this exam. No marks are deducted for wrong answers."}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="w-4 h-4 text-sky-600" />
                                            Candidate Details
                                        </h3>
                                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800 p-4">
                                            <div className="grid grid-cols-2 gap-y-2">
                                                <div>
                                                    <span className="block text-xs text-slate-500 mb-0.5">Name</span>
                                                    <span className="font-medium text-slate-900 dark:text-slate-200">{user?.full_name}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-slate-500 mb-0.5">Candidate ID</span>
                                                    <span className="font-mono text-sm font-medium text-slate-900 dark:text-slate-200">{user?.id}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Instructions */}
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-2">
                                        <HelpCircle className="w-4 h-4 text-sky-600" />
                                        Instructions
                                    </h3>
                                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                        <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-600 dark:text-slate-300">
                                            {[
                                                "Ensure you have a stable internet connection.",
                                                "Do not switch tabs or windows; this will be recorded.",
                                                "The timer starts immediately after clicking 'Start Test'.",
                                                "Questions can be marked for review.",
                                                "Click 'Submit' only when you have completed the test.",
                                                "In case of system failure, login again immediately."
                                            ].map((inst, i) => (
                                                <li key={i} className="px-4 py-3 flex gap-3">
                                                    <span className="text-sky-600 font-bold text-xs mt-0.5">{i + 1}.</span>
                                                    <span>{inst}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 dark:border-slate-600 checked:bg-sky-600 checked:border-sky-600 transition-all"
                                            checked={hasAcknowledged}
                                            onChange={(e) => setHasAcknowledged(e.target.checked)}
                                        />
                                        <CheckCircle2 className="pointer-events-none absolute h-3.5 w-3.5 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                                    </div>
                                    <span className="text-sm text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                                        I have read the instructions and agree to the terms.
                                    </span>
                                </label>

                                <button
                                    disabled={!canStart}
                                    onClick={onStart}
                                    className={`
                    relative overflow-hidden inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 shadow-md
                    ${canStart
                                            ? "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-200 dark:shadow-sky-900/20 translate-y-0 cursor-pointer"
                                            : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                                        }
                  `}
                                >
                                    <PlayCircle className={`w-5 h-5 ${canStart ? "animate-pulse" : ""}`} />
                                    {isActive ? (
                                        examGuardActive ? "START TEST" : "ExamGuard Required"
                                    ) : (
                                        `Opens at ${new Date(exam.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}