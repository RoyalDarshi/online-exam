import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Clock, FileText, CheckCircle, PlayCircle } from 'lucide-react';
import { ExamTaking } from './ExamTaking';
import { Exam } from '../lib/supabase';
import { ExamPreview } from './ExamPreview'; // 👈 add this import

export function StudentDashboard() {
  const { signOut, user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    try {
      const response = await api.get('/exams');
      setExams(response.data || []);
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  }

  // When in full exam mode
  if (selectedExam) {
    return (
      <ExamTaking
        exam={selectedExam}
        onComplete={() => {
          setSelectedExam(null);
          setPreviewExam(null);
          loadExams();
        }}
        onCancel={() => {
          setSelectedExam(null);
          setPreviewExam(null);
        }}
      />
    );
  }

  // When in preview mode
  if (previewExam) {
    return (
      <ExamPreview
        exam={previewExam}
        onBack={() => setPreviewExam(null)}
        onStart={() => setSelectedExam(previewExam)}
      />
    );
  }

  // Normal dashboard list
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Welcome, {user?.full_name}</p>
          </div>
          <button
            onClick={signOut}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Available Exams</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No active exams</h3>
            <p className="text-gray-600">Check back later for new assessments.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map(exam => (
              <div
                key={exam.id}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{exam.title}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{exam.description}</p>

                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{exam.duration_minutes} mins</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      <span>Pass: {exam.passing_score}%</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setPreviewExam(exam)}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    <PlayCircle className="w-5 h-5" />
                    View & Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
