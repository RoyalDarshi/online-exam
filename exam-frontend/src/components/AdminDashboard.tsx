import { useState, useEffect } from "react";
import api from "../lib/api";

import {
  Plus,
  Trash2,
  CalendarDays,
  FileText,
  Pencil,
  BarChart,
  Database,
  LogOut,
} from "lucide-react";

import { CreateExam } from "./CreateExam";
import { EditExam } from "./EditExam";
import { ExamResults } from "./ExamResults";
import { AdminExamCalendar } from "./AdminExamCalendar";
import { QuestionBankManager } from "./QuestionBankManager"; // NEW MANAGER
import { CreateExamFromBank } from "./CreateExamFromBank";
import { useAuth } from "../contexts/AuthContext";

export function AdminDashboard() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<
    "list" | "create" | "edit" | "results" | "calendar" | "bank" | "generator"
  >("list");

  const [selectedExam, setSelectedExam] = useState(null);

  const { signOut } = useAuth();

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    try {
      const res = await api.get("/admin/exams");
      setExams(res.data || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load exams");
    } finally {
      setLoading(false);
    }
  }

  async function deleteExam(id: number) {
    if (!window.confirm("Are you sure you want to delete this exam?")) return;

    try {
      await api.delete(`/admin/exams/${id}`);
      alert("Exam deleted");
      loadExams();
    } catch (err) {
      console.error(err);
      alert("Failed to delete exam");
    }
  }

  // ===========================
  // VIEW SWITCHING
  // ===========================

  if (view === "bank") {
    return <QuestionBankManager onBack={() => setView("list")} />;
  }

  if (view === "calendar") {
    return (
      <AdminExamCalendar exams={exams} onBack={() => setView("list")} />
    );
  }

  if (view === "generator") {
    return (
      <CreateExamFromBank
        onBack={() => setView("list")}
        onComplete={() => {
          setView("list");
          loadExams();
        }}
      />
    );
  }

  if (view === "create") {
    return (
      <CreateExam
        onComplete={() => {
          setView("list");
          loadExams();
        }}
        onCancel={() => setView("list")}
      />
    );
  }

  if (view === "edit" && selectedExam) {
    return (
      <EditExam
        examId={selectedExam.id}
        onBack={() => {
          setSelectedExam(null);
          setView("list");
          loadExams();
        }}
      />
    );
  }

  if (view === "results" && selectedExam) {
    return (
      <ExamResults
        examId={selectedExam.id}
        onBack={() => {
          setSelectedExam(null);
          setView("list");
        }}
      />
    );
  }

  // ===========================
  // EXAMS LIST VIEW
  // ===========================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">

          <h1 className="text-2xl font-bold text-gray-900">
            Admin Dashboard
          </h1>

          <div className="flex gap-3">
            <button
              onClick={() => setView("bank")}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              <Database className="w-5 h-5" />
              Question Bank
            </button>

            <button
              onClick={() => setView("calendar")}
              className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              <CalendarDays className="w-5 h-5" />
              Calendar
            </button>

            <button
              onClick={() => setView("generator")}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
            >
              <Database className="w-5 h-5" />
              Generate from Bank
            </button>

            <button
              onClick={() => setView("create")}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Create Exam
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* BODY */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          All Exams
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : exams.length === 0 ? (
          <div className="bg-white p-12 text-center shadow-md rounded-lg">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No exams found
            </h3>
            <p className="text-gray-600">
              Start by creating a new exam.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam: any) => (
              <div
                key={exam.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition border border-gray-200 overflow-hidden"
              >
                <div className="p-6">
                  {/* Exam Title */}
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {exam.title}
                  </h3>

                  <p className="text-gray-600 text-sm line-clamp-2">
                    {exam.description}
                  </p>

                  {/* Info */}
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <CalendarDays className="w-4 h-4" />
                      <span>{exam.duration_minutes} mins</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BarChart className="w-4 h-4 text-emerald-600" />
                      <span>Pass {exam.passing_score}%</span>
                    </div>
                  </div>

                  {/* Start Time */}
                  <div className="mt-3">
                    <p className="text-xs text-gray-500">Start Time (IST)</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {exam.start_time
                        ? new Date(exam.start_time).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                        : "Not scheduled"}
                    </p>
                  </div>

                  {/* ACTIONS */}
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        setSelectedExam(exam);
                        setView("edit");
                      }}
                      className="flex items-center justify-center gap-1 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 text-sm"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>

                    <button
                      onClick={() => {
                        setSelectedExam(exam);
                        setView("results");
                      }}
                      className="flex items-center justify-center gap-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <BarChart className="w-4 h-4" /> Results
                    </button>

                    <button
                      onClick={() => deleteExam(exam.id)}
                      className="flex items-center justify-center gap-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
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
