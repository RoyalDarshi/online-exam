// StudentDashboard.tsx — TCS iON Modern Dashboard
import React, { useState, useEffect } from "react";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import {
  Clock,
  FileText,
  CheckCircle,
  PlayCircle,
  History,
  List,
  LogOut,
} from "lucide-react";

import { Exam, ExamAttempt } from "../types/models";
import { ExamTaking } from "./ExamTaking";
import { ExamPreview } from "./ExamPreview";
import ExamReview from "./ExamReview";
import { StudentAttemptHistory } from "./StudentAttemptHistory";

type View = "list" | "preview" | "taking" | "review" | "history";

export function StudentDashboard() {
  const { signOut, user } = useAuth();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<View>("list");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  const [reviewAttempt, setReviewAttempt] = useState<ExamAttempt | null>(
    null
  );

  useEffect(() => {
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

  if (view === "preview" && selectedExam) {
    return (
      <ExamPreview
        exam={selectedExam}
        onBack={() => setView("list")}
        onStart={() => setView("taking")}
      />
    );
  }

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

  if (view === "history") {
    return (
      <StudentAttemptHistory
        onBack={() => setView("list")}
        onOpenReview={openReviewFromHistory}
      />
    );
  }

  // MAIN DASHBOARD LIST
  return (
    <div className="min-h-screen bg-slate-950">
      {/* TOP HEADER — TCS iON Style */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-5 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-sky-300 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Assessment Dashboard
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">
              {user?.full_name} ({user?.role})
            </span>

            <button
              onClick={() => setView("history")}
              className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800 flex items-center gap-2 text-sm"
            >
              <History className="w-4 h-4 text-sky-300" />
              History
            </button>

            <button
              onClick={signOut}
              className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 text-sm shadow-md shadow-rose-600/20"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* BODY */}
      <main className="max-w-7xl mx-auto px-5 py-10">
        <h2 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
          <List className="w-5 h-5 text-sky-300" />
          Available Exams
        </h2>

        {loading && (
          <p className="text-slate-400">Loading exams...</p>
        )}

        {!loading && exams.length === 0 && (
          <div className="border border-slate-800 bg-slate-900 p-6 rounded-lg text-center">
            <p className="text-slate-400 text-lg">
              No exams available.
            </p>
          </div>
        )}

        {!loading && exams.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-md hover:shadow-sky-500/10 hover:border-sky-600 transition cursor-pointer"
              >
                <h3 className="text-xl font-bold text-slate-100 mb-1">
                  {exam.title}
                </h3>
                <p className="text-slate-400 mb-4 line-clamp-2 text-sm">
                  {exam.description}
                </p>

                <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-400 mb-6">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-sky-300" />
                    {exam.duration_minutes} mins
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-300" />
                    Pass: {exam.passing_score}%
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className="text-slate-400">Starts:</span>
                    <span className="text-slate-300">
                      {new Date(exam.start_time).toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedExam(exam);
                    setView("preview");
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-3 rounded-lg shadow-md shadow-sky-600/20 font-semibold"
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
