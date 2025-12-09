// src/components/StudentDashboard.tsx

import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { Clock, FileText, CheckCircle, PlayCircle, History, List } from 'lucide-react';

import { Exam, ExamAttempt } from '../types/models';
import { ExamTaking } from './ExamTaking';
import { ExamPreview } from './ExamPreview';
import { StudentAttemptHistory } from './StudentAttemptHistory';
import ExamReview from './ExamReview';

type StudentDashboardView = 'list' | 'preview' | 'taking' | 'review' | 'history';

export function StudentDashboard() {
  const { signOut, user } = useAuth();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<StudentDashboardView>('list');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  // When exam finishes → load attempt and show review
  const [reviewAttempt, setReviewAttempt] = useState<ExamAttempt | null>(null);

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

  const openReviewFromHistory = (attempt: ExamAttempt) => {
    setReviewAttempt(attempt);
    setView("review");
  };


  // When exam completes → fetch final attempt → go to review page
  const handleExamComplete = async () => {
    try {
      const myAttempts = await api.get('/student/attempts');
      const latest = myAttempts.data[0]; // most recent attempt
      if (!latest) {
        alert("Unable to load attempt for review");
        setView('list');
        return;
      }
      const attemptDetails = await api.get(`/attempts/${latest.id}`);
      setReviewAttempt(attemptDetails.data);
      setView('review');
    } catch (err) {
      console.error(err);
      alert("Error loading review page");
      setView('list');
    }
  };

  const handleExamCancel = () => {
    setSelectedExam(null);
    setView('list');
  };

  // ------------------------- VIEW SWITCHING -------------------------

  // Taking exam
  if (view === 'taking' && selectedExam) {
    return (
      <ExamTaking
        exam={selectedExam}
        onComplete={handleExamComplete}
        onCancel={handleExamCancel}
        reviewMode={false}
      />
    );
  }

  // Preview screen
  if (view === 'preview' && selectedExam) {
    return (
      <ExamPreview
        exam={selectedExam}
        onBack={() => {
          setSelectedExam(null);
          setView('list');
        }}
        onStart={() => setView('taking')}
      />
    );
  }

  // Review page (after submission)
  if (view === 'review' && reviewAttempt) {
    return (
      <ExamReview
        attempt={reviewAttempt}
        onBack={() => {
          setReviewAttempt(null);
          setView('list');
        }}
      />
    );
  }

  // History page
  if (view === "history") {
    return (
      <StudentAttemptHistory
        onBack={() => setView("list")}
        onOpenReview={openReviewFromHistory}
      />
    );
  }


  // --------------------------- MAIN LIST UI ---------------------------

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Student Dashboard
          </h1>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Hello, {user?.full_name} ({user?.role})
            </span>

            <button
              onClick={() => setView('history')}
              className="flex items-center gap-1 text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition"
            >
              <History className="w-4 h-4" />
              History
            </button>

            <button
              onClick={signOut}
              className="text-sm bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* MAIN EXAM LIST */}
      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <List className="w-5 h-5" /> Available Exams
        </h2>

        {loading && <p className="text-gray-500">Loading exams...</p>}

        {!loading && exams.length === 0 && (
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <p className="text-lg text-gray-500">No exams are currently available for you.</p>
          </div>
        )}

        {!loading && exams.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow"
              >
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{exam.title}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{exam.description}</p>

                  <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-500 mb-6">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="font-medium text-gray-700">
                        {exam.duration_minutes} mins
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="font-medium text-gray-700">
                        Pass: {exam.passing_score}%
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="font-medium text-gray-700">Start Time:</span>
                      <span className="font-medium text-gray-700">
                        {new Date(exam.start_time).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedExam(exam);
                      setView('preview');
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition font-semibold shadow-md"
                  >
                    <PlayCircle className="w-5 h-5" />
                    View Details & Start
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
