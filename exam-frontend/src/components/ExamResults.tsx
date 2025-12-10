// src/components/ExamResults.tsx
import React, { useState, useEffect } from "react";
import api from "../lib/api";
import {
  ArrowLeft,
  Loader2,
} from "lucide-react";
import ExamReview from "./ExamReview";
import { ResultsHeader } from "./admin/results/ResultsHeader";
import { AttemptTable } from "./admin/results/AttemptTable";
import { ResultsPagination } from "./admin/results/ResultsPagination";

type Props = {
  examId: string;
  onBack: () => void;
};

type Student = {
  id: string;
  full_name: string;
  email: string;
};

export type Attempt = {
  id: string;
  score: number;
  total_points: number;
  tab_switches: number;
  passed: boolean;
  submitted_at: string | null;
  is_terminated: boolean;
  termination_reason: string | null;
  student: Student;
};

export function ExamResults({ examId, onBack }: Props) {
  const [exam, setExam] = useState<any>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [reviewAttempt, setReviewAttempt] = useState<any | null>(null);


  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadExam();
    loadAttempts(1);
  }, [examId]);

  async function loadExam() {
    try {
      const res = await api.get(`/exams/${examId}`);
      setExam(res.data);
    } catch (err) {
      console.error("Error loading exam:", err);
    }
  }

  async function loadAttempts(pageNum: number) {
    try {
      setLoading(true);
      const res = await api.get(
        `/admin/exams/${examId}/attempts?page=${pageNum}&limit=50`
      );

      setAttempts(res.data.data || []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Error loading attempts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFullAttemptForReview(attempt: Attempt) {
    try {
      const res = await api.get(`/admin/attempts/${attempt.id}`);
      // This endpoint must return: { exam, answers, ...attempt fields }
      setReviewAttempt(res.data);
    } catch (err) {
      console.error("Failed to load attempt details:", err);
    }
  }


  if (reviewAttempt) {
    return (
      <ExamReview
        attempt={reviewAttempt}   // FULL OBJECT
        onBack={() => setReviewAttempt(null)}
        mode="admin"              // important!
      />
    );
  }


  if (!exam) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* HEADER */}
      <ResultsHeader
        examTitle={exam.title}
        onBack={onBack}
      />

      {/* BODY */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Meta strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-400">
          <div className="flex flex-wrap gap-3">
            <span>
              Attempts:{" "}
              <span className="font-semibold text-slate-100">
                {attempts.length}
              </span>
            </span>
            {exam.passing_score != null && (
              <span>
                Passing %:{" "}
                <span className="font-semibold text-emerald-300">
                  {exam.passing_score}%
                </span>
              </span>
            )}
          </div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-100 text-xs font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Exam List
          </button>
        </div>

        {/* TABLE CARD */}
        <section className="bg-slate-900/70 border border-slate-800 rounded-xl shadow-lg shadow-slate-900/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">
                Student Attempts
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Review performance, violations, and status per candidate.
              </p>
            </div>
          </div>

          <AttemptTable
            attempts={attempts}
            loading={loading}
            onReviewClick={loadFullAttemptForReview}
          />
        </section>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <ResultsPagination
            page={page}
            totalPages={totalPages}
            onChange={(newPage) => loadAttempts(newPage)}
          />
        )}
      </main>
    </div>
  );
}
