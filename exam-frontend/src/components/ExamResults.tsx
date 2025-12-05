import { useState, useEffect } from "react";
import api from "../lib/api";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Eye, Loader2 } from "lucide-react";
import { AdminAttemptReview } from "./AdminAttemptReview";

type Props = {
  examId: string;
  onBack: () => void;
};

type Student = {
  id: string;
  full_name: string;
  email: string;
};

type Attempt = {
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

  // Pagination (backend supports it)
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
      const res = await api.get(`/admin/exams/${examId}/attempts?page=${pageNum}&limit=50`);

      setAttempts(res.data.data || []);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      console.error("Error loading attempts:", err);
    } finally {
      setLoading(false);
    }
  }

  if (reviewAttemptId) {
    return (
      <AdminAttemptReview
        attemptId={reviewAttemptId}
        onBack={() => setReviewAttemptId(null)}
      />
    );
  }

  if (!exam) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>

          <h1 className="text-2xl font-bold text-gray-900">{exam.title} — Results</h1>
        </div>
      </header>

      {/* BODY */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ATTEMPT TABLE */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Student Attempts</h2>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Violations
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200">
                  {attempts.map((attempt) => {
                    const percent = attempt.total_points
                      ? Math.round((attempt.score / attempt.total_points) * 100)
                      : 0;

                    return (
                      <tr key={attempt.id} className="hover:bg-gray-50">
                        {/* STUDENT */}
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">
                            {attempt.student?.full_name || "Unknown"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {attempt.student?.email}
                          </div>
                        </td>

                        {/* SCORE */}
                        <td className="px-6 py-4 text-sm text-gray-800">
                          {attempt.score}/{attempt.total_points}{" "}
                          <span className="text-gray-500 text-xs">({percent}%)</span>
                        </td>

                        {/* VIOLATIONS */}
                        <td className="px-6 py-4 text-sm">
                          {attempt.tab_switches > 0 ? (
                            <span className="text-red-600 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" /> {attempt.tab_switches}
                            </span>
                          ) : (
                            <span className="text-green-600">Clean</span>
                          )}
                        </td>

                        {/* STATUS */}
                        <td className="px-6 py-4">
                          {attempt.is_terminated ? (
                            <span className="text-red-600 font-bold flex items-center gap-1">
                              <XCircle className="w-4 h-4" /> Terminated
                            </span>
                          ) : attempt.passed ? (
                            <span className="text-green-600 font-bold flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" /> Passed
                            </span>
                          ) : (
                            <span className="text-red-600 font-bold flex items-center gap-1">
                              <XCircle className="w-4 h-4" /> Failed
                            </span>
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setReviewAttemptId(attempt.id)}
                            className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition"
                          >
                            <Eye className="w-4 h-4" />
                            Review Answer Sheet
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6 gap-3">
            <button
              disabled={page === 1}
              onClick={() => loadAttempts(page - 1)}
              className={`px-3 py-2 border rounded ${page === 1 ? "opacity-40" : "hover:bg-gray-100"
                }`}
            >
              Previous
            </button>

            <div className="px-4 py-2 font-medium">
              Page {page} / {totalPages}
            </div>

            <button
              disabled={page === totalPages}
              onClick={() => loadAttempts(page + 1)}
              className={`px-3 py-2 border rounded ${page === totalPages ? "opacity-40" : "hover:bg-gray-100"
                }`}
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
