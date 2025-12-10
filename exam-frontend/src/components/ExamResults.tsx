// src/components/ExamResults.tsx
import React, { useState, useEffect } from "react";
import api from "../lib/api";
import {
  ArrowLeft,
  Loader2,
  BarChart2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Eye,
  Search
} from "lucide-react";
import ExamReview from "./ExamReview";

// ============================================================================
// TYPES
// ============================================================================

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

type Props = {
  examId: string;
  onBack: () => void;
};

// ============================================================================
// SUB-COMPONENT: StatusBadge
// ============================================================================

const StatusBadge: React.FC<{ passed: boolean; isTerminated: boolean }> = ({ passed, isTerminated }) => {
  if (isTerminated) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700">
        <AlertTriangle className="w-3.5 h-3.5" />
        Terminated
      </span>
    );
  }

  if (passed) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700">
        <CheckCircle className="w-3.5 h-3.5" />
        Passed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700">
      <XCircle className="w-3.5 h-3.5" />
      Failed
    </span>
  );
};

// ============================================================================
// SUB-COMPONENT: ViolationBadge
// ============================================================================

const ViolationBadge: React.FC<{ tabSwitches: number }> = ({ tabSwitches }) => {
  if (tabSwitches > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700">
        <ShieldAlert className="w-3.5 h-3.5" />
        {tabSwitches} warning{tabSwitches > 1 ? "s" : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700">
      <CheckCircle className="w-3.5 h-3.5" />
      Clean
    </span>
  );
};

// ============================================================================
// SUB-COMPONENT: ResultsHeader
// ============================================================================

const ResultsHeader: React.FC<{ examTitle: string; onBack: () => void }> = ({ examTitle, onBack }) => {
  return (
    <header className="
      border-b sticky top-0 z-20 backdrop-blur-md
      bg-white/80 border-slate-200 
      dark:bg-slate-900/95 dark:border-slate-800
    ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="
              inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-colors
              text-slate-500 hover:text-slate-900
              dark:text-slate-400 dark:hover:text-slate-100
            "
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-slate-50">
                {examTitle || "Exam Results"}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Admin Console • Student Performance Review
              </p>
            </div>
          </div>
        </div>

        <span className="
          px-3 py-1 rounded-full text-[10px] font-semibold border
          bg-slate-100 border-slate-200 text-slate-600
          dark:bg-slate-800 dark:border-slate-700 dark:text-sky-300
        ">
          ADMIN
        </span>
      </div>
    </header>
  );
};

// ============================================================================
// SUB-COMPONENT: ResultsPagination
// ============================================================================

const ResultsPagination: React.FC<{ page: number; totalPages: number; onChange: (p: number) => void }> = ({
  page,
  totalPages,
  onChange,
}) => {
  return (
    <div className="flex justify-center items-center gap-3 text-xs sm:text-sm mt-6">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className={`
          px-4 py-2 rounded-lg border font-medium transition-all
          ${page === 1
            ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          }
        `}
      >
        Previous
      </button>

      <span className="
        px-4 py-2 rounded-lg border font-medium
        bg-white border-slate-200 text-slate-700
        dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300
      ">
        Page <span className="font-bold text-slate-900 dark:text-white">{page}</span> of {totalPages}
      </span>

      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className={`
          px-4 py-2 rounded-lg border font-medium transition-all
          ${page === totalPages
            ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-600"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          }
        `}
      >
        Next
      </button>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: AttemptTable
// ============================================================================

const AttemptTable: React.FC<{
  attempts: Attempt[];
  loading: boolean;
  onReviewClick: (attempt: Attempt) => void
}> = ({ attempts, loading, onReviewClick }) => {

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600 dark:text-sky-400" />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading results...</p>
      </div>
    );
  }

  if (!attempts.length) {
    return (
      <div className="py-20 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3">
          <Search className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-200">No attempts found</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No students have taken this exam yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm text-left">
        <thead className="
          bg-slate-50 border-b border-slate-200 
          dark:bg-slate-900/50 dark:border-slate-800
        ">
          <tr>
            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
              Student
            </th>
            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
              Score
            </th>
            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
              Violations
            </th>
            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
              Status
            </th>
            <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {attempts.map((attempt) => {
            const percent = attempt.total_points
              ? Math.round((attempt.score / attempt.total_points) * 100)
              : 0;

            return (
              <tr
                key={attempt.id}
                className="
                  group transition-colors
                  hover:bg-slate-50 dark:hover:bg-slate-800/50
                "
              >
                {/* STUDENT */}
                <td className="px-6 py-4 align-top">
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {attempt.student?.full_name || "Unknown Student"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {attempt.student?.email}
                  </div>
                </td>

                {/* SCORE */}
                <td className="px-6 py-4 align-top">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-base">
                      {attempt.score}
                    </span>
                    <span className="text-slate-400 text-xs">/ {attempt.total_points}</span>
                  </div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {percent}%
                  </div>
                </td>

                {/* VIOLATIONS */}
                <td className="px-6 py-4 align-top">
                  <ViolationBadge tabSwitches={attempt.tab_switches} />
                </td>

                {/* STATUS */}
                <td className="px-6 py-4 align-top">
                  <StatusBadge passed={attempt.passed} isTerminated={attempt.is_terminated} />
                </td>

                {/* ACTION */}
                <td className="px-6 py-4 align-top text-right">
                  <button
                    onClick={() => onReviewClick(attempt)}
                    className="
                      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm border transition-all
                      bg-white border-slate-200 text-slate-700 hover:border-sky-300 hover:text-sky-600 hover:bg-sky-50
                      dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:text-sky-400 dark:hover:bg-sky-900/20
                    "
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Review
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT: ExamResults
// ============================================================================

export function ExamResults({ examId, onBack }: Props) {
  const [exam, setExam] = useState<any>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Mode State
  const [reviewAttempt, setReviewAttempt] = useState<any | null>(null);

  // Pagination State
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
      setReviewAttempt(res.data);
    } catch (err) {
      console.error("Failed to load attempt details:", err);
      alert("Could not load full review details.");
    }
  }

  // IF VIEWING A SINGLE ATTEMPT REVIEW
  if (reviewAttempt) {
    return (
      <ExamReview
        attempt={reviewAttempt}
        onBack={() => setReviewAttempt(null)}
        mode="admin"
      />
    );
  }

  // LOADING EXAM META
  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600 dark:text-sky-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">

      {/* HEADER */}
      <ResultsHeader examTitle={exam.title} onBack={onBack} />

      {/* BODY */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* STATS STRIP */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
              <span className="text-slate-500 dark:text-slate-400 mr-2">Total Attempts:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">{attempts.length}</span>
            </div>

            {exam.passing_score != null && (
              <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 mr-2">Passing Score:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{exam.passing_score}%</span>
              </div>
            )}
          </div>

          <button
            onClick={onBack}
            className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            &larr; Return to Dashboard
          </button>
        </div>

        {/* MAIN TABLE CARD */}
        <section className="
          rounded-xl border shadow-sm overflow-hidden
          bg-white border-slate-200 shadow-slate-200/50
          dark:bg-slate-900 dark:border-slate-800 dark:shadow-slate-900/50
        ">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Student Attempts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Detailed list of all candidates who have taken this exam.
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