import React from "react";
import {
  ArrowLeft,
  BookOpen,
  Play,
  ShieldAlert,
  Clock,
  CheckCircle2,
  HelpCircle,
  Trophy,
  Wifi,
  AlertOctagon,
  Download,
  ShieldCheck,
  AlertCircle,
  Hash,
  Camera, // Imported
  Mic, // Imported
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
  const [timeLeft, setTimeLeft] = React.useState<string>("--:--:--");
  const [hasAcknowledged, setHasAcknowledged] = React.useState(false);

  // New state for media permissions
  const [mediaPermitted, setMediaPermitted] = React.useState(false);
  const [mediaError, setMediaError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(t);
  }, []);

  const EXAMGUARD_DOWNLOAD_URL = "/ExamGuard.exe";
  const examGuardActive = useExamGuard(true);
  useExamGuardLockdown();

  const start = new Date(exam.start_time).getTime();
  const end = new Date(exam.end_time).getTime();

  const isUpcoming = now < start;
  const isClosed = now > end;
  const isActive = now >= start && now <= end;

  // Precision Timer
  React.useEffect(() => {
    if (!isUpcoming) return;

    const interval = setInterval(() => {
      const diff = start - Date.now();

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        clearInterval(interval);
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setTimeLeft(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
          .toString()
          .padStart(2, "0")}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [start, isUpcoming]);

  // Function to request Camera/Mic access with better error handling
  const checkMediaPermissions = async () => {
    try {
      setMediaError(null);

      // Check for HTTPS (required for getUserMedia unless on localhost)
      if (
        window.location.protocol !== "https:" &&
        window.location.hostname !== "localhost" &&
        window.location.hostname !== "127.0.0.1"
      ) {
        throw new Error("SECURE_CONNECTION_REQUIRED");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // If successful, set state to true
      setMediaPermitted(true);

      // Stop tracks immediately to release hardware until actual exam starts
      stream.getTracks().forEach((track) => track.stop());
    } catch (err: any) {
      console.error("Media permission error:", err);
      setMediaPermitted(false);

      let msg = "An unexpected error occurred accessing media devices.";

      // Handle specific error cases
      if (err.message === "SECURE_CONNECTION_REQUIRED") {
        msg = "Camera access requires a secure (HTTPS) connection.";
      } else if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        msg =
          "Permission blocked. Click the lock icon 🔒 in your URL bar to allow access.";
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        msg = "No camera or microphone hardware found.";
      } else if (
        err.name === "NotReadableError" ||
        err.name === "TrackStartError"
      ) {
        msg = "Hardware is in use by another application (Zoom, Teams, etc.).";
      }

      setMediaError(msg);
    }
  };

  // Updated 'canStart' to include mediaPermitted
  const canStart =
    isActive && hasAcknowledged && examGuardActive && mediaPermitted;
  const negativeEnabled = !!exam.enable_negative_marking;

  // --- Sub-components for Bento Grid ---

  const InfoCard = ({ icon: Icon, label, value, sub }: any) => (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between h-full relative overflow-hidden group hover:border-sky-200 dark:hover:border-sky-800 transition-colors">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
        <Icon className="w-16 h-16" />
      </div>
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {value}
        </div>
        {sub && (
          <div className="text-xs text-slate-500 font-medium mt-1">{sub}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-sky-500/30 pb-32 relative">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#64748b 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      ></div>

      <StudentNavbar user={user} onLogout={signOut} onHistory={() => {}} />

      <main className="max-w-7xl mx-auto px-4 py-2 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
          <button
            onClick={onBack}
            className="group flex items-center gap-3 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <ArrowLeft className="w-5 h-5" />
            </div>
            Back to Dashboard
          </button>

          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 py-2 px-4 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
              Connection Stable
            </span>
          </div>
        </div>

        {isClosed ? (
          // CLOSED STATE
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <AlertOctagon className="w-10 h-10 text-slate-500" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
              Exam Ended
            </h1>
            <p className="text-slate-500">
              This assessment is no longer accepting submissions.
            </p>
          </div>
        ) : (
          // BENTO GRID LAYOUT
          <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {/* 1. Main Title Card (Span 2) */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[200px]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-sky-50 dark:bg-sky-900/10 rounded-bl-full -mr-10 -mt-10 pointer-events-none" />

              <div className="relative">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                    {exam.subject}
                  </span>
                  {isActive && (
                    <span className="px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                      Live
                    </span>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white leading-tight tracking-tight">
                  {exam.title}
                </h1>
              </div>

              <div className="flex items-center gap-4 mt-6 text-sm text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> {exam.duration_minutes}m
                  Duration
                </span>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <span className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4" /> {exam.passing_score}% Passing
                </span>
              </div>
            </div>

            {/* 2. Timer / Countdown Card (Span 1) */}
            <div className="md:col-span-1 bg-slate-900 dark:bg-black p-6 rounded-[2rem] border border-slate-800 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 opacity-50" />
              <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">
                  {isActive ? "TIME REMAINING" : "STARTS IN"}
                </p>
                <div className="font-mono text-5xl md:text-5xl lg:text-5xl font-bold text-sky-400 tracking-tight tabular-nums">
                  {isActive ? "Running..." : timeLeft}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {new Date(exam.start_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* 3. Candidate ID Card (Span 1) */}
            <div className="md:col-span-1 bg-sky-50 dark:bg-sky-900/10 p-6 rounded-[2rem] border border-sky-100 dark:border-sky-800/50 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-sky-900 flex items-center justify-center text-sky-600 shadow-sm">
                  <Hash className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold uppercase text-sky-800 dark:text-sky-300 tracking-wider">
                  Candidate
                </div>
              </div>
              <div className="font-bold text-slate-900 dark:text-white truncate">
                {user?.full_name}
              </div>
              <div className="font-mono text-xs text-slate-500 truncate mt-1">
                ID: {user?.id}
              </div>
            </div>

            {/* 4. Stats Row (Span 4) */}
            <div className="md:col-span-1">
              <InfoCard
                icon={HelpCircle}
                label="Questions"
                value="MCQ"
                sub="Single Correct"
              />
            </div>
            <div className="md:col-span-1">
              <InfoCard
                icon={AlertCircle}
                label="Negative Marking"
                value={negativeEnabled ? "Active" : "Disabled"}
                sub={negativeEnabled ? "Read scheme carefully" : "No deduction"}
              />
            </div>

            {/* 5. ExamGuard Status (Span 2) */}
            <div
              className={`md:col-span-2 p-6 rounded-[2rem] border relative overflow-hidden transition-all
                ${
                  examGuardActive
                    ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900"
                    : "bg-rose-50/50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900"
                }
            `}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 h-full">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-2xl shrink-0 ${
                      examGuardActive
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-rose-100 text-rose-600"
                    }`}
                  >
                    {examGuardActive ? (
                      <ShieldCheck className="w-6 h-6" />
                    ) : (
                      <ShieldAlert className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3
                      className={`font-bold text-base ${
                        examGuardActive
                          ? "text-emerald-900 dark:text-emerald-200"
                          : "text-rose-900 dark:text-rose-200"
                      }`}
                    >
                      {examGuardActive
                        ? "Secure Browser Active"
                        : "Security Check Required"}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
                      {examGuardActive
                        ? "System is locked and ready for examination."
                        : "ExamGuard must be running to start the test."}
                    </p>
                  </div>
                </div>
                {!examGuardActive && (
                  <a
                    href={EXAMGUARD_DOWNLOAD_URL}
                    className="shrink-0 inline-flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                )}
              </div>
            </div>

            {/* 6. Media Permissions Check (NEW - Span 2) */}
            <div
              className={`md:col-span-2 p-6 rounded-[2rem] border relative overflow-hidden transition-all
                ${
                  mediaPermitted
                    ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900"
                    : "bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900"
                }
            `}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 h-full">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-2xl shrink-0 ${
                      mediaPermitted
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {mediaPermitted ? (
                      <Camera className="w-6 h-6" />
                    ) : (
                      <Mic className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3
                      className={`font-bold text-base ${
                        mediaPermitted
                          ? "text-emerald-900 dark:text-emerald-200"
                          : "text-amber-900 dark:text-amber-200"
                      }`}
                    >
                      {mediaPermitted
                        ? "Hardware Ready"
                        : "Hardware Access Required"}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">
                      {mediaError ? (
                        <span className="text-rose-600 font-medium">
                          {mediaError}
                        </span>
                      ) : mediaPermitted ? (
                        "Camera and Microphone permissions granted."
                      ) : (
                        "You must enable Camera & Mic to proceed."
                      )}
                    </p>
                  </div>
                </div>
                {!mediaPermitted && (
                  <button
                    onClick={checkMediaPermissions}
                    className="shrink-0 inline-flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-sm cursor-pointer"
                  >
                    <Camera className="w-4 h-4" /> Enable Devices
                  </button>
                )}
              </div>
            </div>

            {/* 7. Marking Scheme (Span 2) */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Grading Logic
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    l: "Easy",
                    m: exam.marks_easy,
                    n: exam.negative_mark_easy,
                    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
                  },
                  {
                    l: "Medium",
                    m: exam.marks_medium,
                    n: exam.negative_mark_medium,
                    color: "bg-amber-50 text-amber-700 border-amber-100",
                  },
                  {
                    l: "Hard",
                    m: exam.marks_hard,
                    n: exam.negative_mark_hard,
                    color: "bg-rose-50 text-rose-700 border-rose-100",
                  },
                ].map((item) => (
                  <div
                    key={item.l}
                    className={`p-4 rounded-2xl border ${item.color} dark:bg-opacity-10 dark:border-opacity-20`}
                  >
                    <div className="text-[10px] font-black uppercase opacity-70 mb-1">
                      {item.l}
                    </div>
                    <div className="text-lg font-bold">+{item.m}</div>
                    <div className="text-[10px] font-medium opacity-80">
                      {negativeEnabled ? `-${item.n} wrong` : "0 deduction"}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 8. Instructions (Span 2) */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <Wifi className="w-4 h-4" /> Protocols
              </h3>
              <ul className="space-y-3">
                {[
                  "Do not switch tabs or minimize the window.",
                  "Webcam and microphone must remain enabled.",
                  "Timer continues even if you disconnect.",
                  "Submit only when you have answered all questions.",
                ].map((rule, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* --- FLOATING ACTION DOCK --- */}
      {!isClosed && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
          <div className="w-full max-w-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 p-2 pl-6 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 ring-1 ring-slate-900/5">
            <label className="flex items-center gap-3 cursor-pointer group py-2">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border-2 border-slate-300 dark:border-slate-600 checked:bg-sky-600 checked:border-sky-600 transition-all"
                  checked={hasAcknowledged}
                  onChange={(e) => setHasAcknowledged(e.target.checked)}
                />
                <CheckCircle2 className="pointer-events-none absolute h-3.5 w-3.5 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 transition-colors">
                I agree to the terms
              </span>
            </label>

            <button
              disabled={!canStart}
              onClick={onStart}
              className={`
                relative overflow-hidden flex items-center gap-3 px-8 py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-300
                ${
                  canStart
                    ? "bg-slate-900 dark:bg-sky-600 text-white shadow-lg shadow-slate-900/20 dark:shadow-sky-900/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                }
              `}
            >
              <div className="relative z-10 flex items-center gap-2">
                {isActive ? (
                  <>
                    <Play
                      className={`w-4 h-4 ${canStart ? "fill-current" : ""}`}
                    />
                    <span>START EXAM</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>NOT STARTED</span>
                  </>
                )}
              </div>
              {canStart && (
                <div className="absolute inset-0 bg-white/10 animate-pulse" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
