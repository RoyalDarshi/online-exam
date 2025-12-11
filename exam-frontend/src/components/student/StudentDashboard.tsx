// StudentDashboard.tsx — Dual Theme (Dark + Light L2 Premium)
import React from "react";
import api from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";

import {
  Clock,
  PlayCircle,
  List,
} from "lucide-react";

import { Exam, ExamAttempt } from "../../types/models";
import { ExamTaking } from "./exam/ExamTaking";
import { ExamPreview } from "./exam/ExamPreview";
import ExamReview from "../common/ExamReview";
import StudentNavbar from "./StudentNavbar";
import { StudentAttemptHistory } from "./StudentAttemptHistory";

type View = "list" | "preview" | "taking" | "review" | "history";

export function StudentDashboard() {
  const { signOut, user } = useAuth();

  const [exams, setExams] = React.useState<Exam[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [view, setView] = React.useState<View>("list");
  const [selectedExam, setSelectedExam] = React.useState<Exam | null>(null);
  const [reviewAttempt, setReviewAttempt] = React.useState<ExamAttempt | null>(null);

  React.useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    try {
      const res = await api.get("/exams");
      setExams(res.data || []);
    } catch (e) {
      console.error("Error loading exams:", e);
    } finally {
      setLoading(false);
    }
  }

  const openReviewFromHistory = (attempt: ExamAttempt) => {
    setReviewAttempt(attempt);
    setView("review");
  };

  const handleComplete = async () => {
    try {
      const myAttempts = await api.get("/student/attempts");
      const latest = myAttempts.data[0];
      if (!latest) {
        alert("Unable to load attempt for review.");
        setView("list");
        return;
      }
      const attemptDetails = await api.get(`/attempts/${latest.id}`);
      setReviewAttempt(attemptDetails.data);
      setView("review");
    } catch (err) {
      console.error(err);
      alert("Error loading review page");
      setView("list");
    }
  };

  // VIEW: Taking Exam
  if (view === "taking" && selectedExam) {
    return (
      <ExamTaking
        exam={selectedExam}
        onComplete={handleComplete}
        onCancel={() => setView("list")}
        candidate={{
          name: user?.full_name || "",
          candidateId: user?.id || "",
          center: "Center 01 - Kolkata",
        }}
      />
    );
  }

  // VIEW: Exam Preview
  if (view === "preview" && selectedExam) {
    return (
      <ExamPreview
        exam={selectedExam}
        onBack={() => setView("list")}
        onStart={() => setView("taking")}
      />
    );
  }

  // VIEW: Review
  if (view === "review" && reviewAttempt) {
    return (
      <ExamReview
        attempt={reviewAttempt}
        onBack={() => {
          setReviewAttempt(null);
          setView("list");
        }}
      />
    );
  }

  // VIEW: History
  if (view === "history") {
    return (
      <StudentAttemptHistory
        onBack={() => setView("list")}
        onOpenReview={openReviewFromHistory}
      />
    );
  }

  // VIEW: MAIN DASHBOARD (LIST)
  return (
    <div
      className="
        min-h-screen
        bg-slate-50
        dark:bg-slate-950
      "
    >
      {/* STUDENT NAVBAR */}
      <StudentNavbar
        user={user}
        onLogout={signOut}
        onHistory={() => setView("history")}
      />

      {/* BODY */}
      <main className="max-w-7xl mx-auto px-5 py-8">
        <h2
          className="
            text-lg font-semibold flex items-center gap-2 mb-6
            text-slate-700
            dark:text-slate-200
          "
        >
          <List className="w-5 h-5 text-sky-600 dark:text-sky-300" />
          Available Exams
        </h2>

        {/* LOADING */}
        {loading && (
          <p className="text-slate-500 dark:text-slate-400">
            Loading exams...
          </p>
        )}

        {/* EMPTY */}
        {!loading && exams.length === 0 && (
          <div
            className="
              border rounded-xl text-center py-10
              bg-white border-slate-300 shadow-sm
              dark:bg-slate-900 dark:border-slate-700 dark:shadow-none
            "
          >
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              No exams available.
            </p>
          </div>
        )}

        {/* LIST OF EXAMS */}
        {!loading && exams.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="
                  rounded-xl border p-6 cursor-pointer transition
                  bg-white border-slate-200 shadow-sm hover:shadow-md hover:bg-slate-50
                  dark:bg-slate-900 dark:border-slate-700 dark:shadow dark:hover:bg-slate-800
                "
              >
                {/* TITLE */}
                <h3
                  className="
                    text-xl font-bold mb-1
                    text-slate-800 dark:text-slate-100
                  "
                >
                  {exam.title}
                </h3>

                {/* DESCRIPTION */}
                <p
                  className="
                    text-sm mb-4 line-clamp-2
                    text-slate-600 dark:text-slate-400
                  "
                >
                  {exam.description}
                </p>

                {/* DETAILS */}
                <div
                  className="
                    grid grid-cols-2 gap-y-2 text-sm mb-6
                    text-slate-700 dark:text-slate-300
                  "
                >
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-sky-600 dark:text-sky-300" />
                    {exam.duration_minutes} mins
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500 dark:text-slate-400">
                      Pass:
                    </span>
                    {exam.passing_score}%
                  </div>
                  <div className="col-span-2 text-slate-500 dark:text-slate-400">
                    Starts:
                    <span className="ml-1 text-slate-700 dark:text-slate-300">
                      {new Date(exam.start_time).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* START BTN */}
                <button
                  onClick={() => {
                    setSelectedExam(exam);
                    setView("preview");
                  }}
                  className="
                    w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold
                    bg-sky-600 hover:bg-sky-500 text-white shadow-sm
                    dark:bg-sky-600 dark:hover:bg-sky-500
                  "
                >
                  <PlayCircle className="w-5 h-5" />
                  View Details & Start
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
