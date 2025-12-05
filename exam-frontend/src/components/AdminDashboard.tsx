import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Users, FileText } from 'lucide-react';
import { CreateExam } from './CreateExam';
import { ExamResults } from './ExamResults';
import { Exam } from '../lib/supabase';

export function AdminDashboard() {
  const { signOut } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'create' | 'results'>('list');
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    try {
      const response = await api.get('/exams'); // This hits http://localhost:8080/api/exams
      setExams(response.data);
    } catch (error) {
      console.error('Error loading exams:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/admin/exams/${id}`); // Ensure you added a DELETE route in Go
      setExams(exams.filter(e => e.id !== id));
    } catch (error) {
      alert('Failed to delete');
    }
  }

  async function handleToggleActive(exam: Exam) {
    try {
      await api.put(`/admin/exams/${exam.id}`, { is_active: !exam.is_active });
      setExams(exams.map(e => e.id === exam.id ? { ...e, is_active: !e.is_active } : e));
    } catch (error) {
      alert('Failed to update');
    }
  }


  function handleViewResults(examId: string) {
    setSelectedExamId(examId);
    setView('results');
  }

  if (view === 'create') {
    return (
      <CreateExam
        onComplete={() => {
          setView('list');
          loadExams();
        }}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'results') {
    return (
      <ExamResults
        examId={selectedExamId}
        onBack={() => setView('list')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Manage exams and view results</p>
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">All Exams</h2>
          <button
            onClick={() => setView('create')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Create Exam
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No exams yet</h3>
            <p className="text-gray-600 mb-6">Create your first exam to get started</p>
            <button
              onClick={() => setView('create')}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Plus className="w-5 h-5" />
              Create Exam
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {exams.map(exam => (
              <div key={exam.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{exam.title}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${exam.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                          }`}
                      >
                        {exam.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{exam.description}</p>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <span>Duration: {exam.duration_minutes} minutes</span>
                      <span>Passing Score: {exam.passing_score}%</span>
                      <span>Created: {new Date(exam.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleViewResults(exam.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="View Results"
                    >
                      <Users className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(exam)}
                      className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition font-medium"
                    >
                      {exam.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
