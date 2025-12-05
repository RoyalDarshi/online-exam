import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Exam, ExamAttempt, Profile } from '../lib/supabase';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Eye } from 'lucide-react';
import { AdminAttemptReview } from './AdminAttemptReview'; // Import the new component

type Props = {
  examId: string;
  onBack: () => void;
};

type AttemptWithStudent = ExamAttempt & {
  student: Profile;
};

export function ExamResults({ examId, onBack }: Props) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<AttemptWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  // New State for navigating to specific attempt review
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
  }, [examId]);

  async function loadResults() {
    try {
      // 1) exam details (title, etc.)
      const examRes = await api.get(`/exams/${examId}`);
      setExam(examRes.data);

      // 2) all attempts for this exam (NEW endpoint)
      const attemptsRes = await api.get(`/admin/exams/${examId}/attempts`);
      setAttempts(attemptsRes.data || []);
    } catch (error) {
      console.error('Error loading results:', error);
    } finally {
      setLoading(false);
    }
  }

  // Render the Review Component if selected
  if (reviewAttemptId) {
    return (
      <AdminAttemptReview
        attemptId={reviewAttemptId}
        onBack={() => setReviewAttemptId(null)}
      />
    );
  }

  if (loading) return <div className="p-12 text-center">Loading...</div>;
  if (!exam) return <div className="p-12 text-center">Exam not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{exam.title} - Results</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* ... (Keep your existing Stats Cards: Total, Passed, Avg) ... */}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Student Attempts</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Violations</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Result</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attempts.map(attempt => (
                  <tr key={attempt.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{attempt.student?.full_name || 'Unknown'}</div>
                      <div className="text-gray-500 text-xs">{attempt.student?.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {attempt.score}/{attempt.total_points}{' '}
                      (
                      {attempt.total_points > 0
                        ? Math.round((attempt.score || 0 / attempt.total_points) * 100)
                        : 0
                      }%
                      )
                    </td>

                    <td className="px-6 py-4 text-sm">
                      {attempt.tab_switches > 0 ? (
                        <span className="text-red-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" /> {attempt.tab_switches}
                        </span>
                      ) : (
                        <span className="text-green-600">Clean</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {attempt.passed ?
                        <span className="text-green-600 font-bold flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Pass</span> :
                        <span className="text-red-600 font-bold flex items-center gap-1"><XCircle className="w-4 h-4" /> Fail</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setReviewAttemptId(attempt.id)}
                        className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition font-medium text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        Review Evidence
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}