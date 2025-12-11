// src/components/AdminDashboard.tsx
import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";

import {
  Trash2,
  FileText,
  Pencil,
  BarChart,
  Loader2,
  Clock,
  Users,
  PlayCircle,
  Calendar,
  History,
  Layers
} from "lucide-react";

import { EditExam } from "./exam/EditExam";
import { ExamResults } from "./exam/ExamResults";
import { AdminExamCalendar } from "./AdminExamCalendar";
import { CreateExamFromBank } from "./exam/CreateExamFromBank";
import { AdminNavbar } from "./AdminNavbar";

type FilterType = "all" | "live" | "upcoming" | "completed";

export function AdminDashboard() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filter, setFilter] = useState<FilterType>("all");

  // View state: 'list' | 'calendar' | 'generator' | 'edit' | 'results'
  const [view, setView] = useState("list");
  const [selectedExam, setSelectedExam] = useState<any>(null);

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
      setExams((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
      alert("Failed to delete exam");
    }
  }

  // ===========================
  // FILTERING LOGIC
  // ===========================
  const getFilteredExams = () => {
    const now = new Date();
    return exams.filter((exam) => {
      if (!exam.start_time) {
        // Treat unscheduled exams as "Upcoming" or just "All"
        if (filter === "upcoming") return true;
        if (filter === "all") return true;
        return false;
      }

      const start = new Date(exam.start_time);
      const end = new Date(start.getTime() + exam.duration_minutes * 60000);

      switch (filter) {
        case "live":
          return start <= now && now <= end;
        case "upcoming":
          return start > now;
        case "completed":
          return now > end;
        default:
          return true;
      }
    });
  };

  const filteredExams = getFilteredExams();

  // Helper to get counts for tabs
  const getCount = (type: FilterType) => {
    const now = new Date();
    return exams.filter((exam) => {
      if (!exam.start_time) return type === "upcoming" || type === "all";
      const start = new Date(exam.start_time);
      const end = new Date(start.getTime() + exam.duration_minutes * 60000);

      if (type === "live") return start <= now && now <= end;
      if (type === "upcoming") return start > now;
      if (type === "completed") return now > end;
      return true;
    }).length;
  };

  // ===========================
  // SUB-VIEWS
  // ===========================

  if (view === "calendar") {
    return <AdminExamCalendar exams={exams} onBack={() => setView("list")} />;
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

  if (view === "edit" && selectedExam) {
    return (
      <EditExam
        examId={selectedExam.id}
        onBack={() => {
          setSelectedExam(null);
          setView("list");
          loadExams();
        }}
        onSaved={() => {
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
  // MAIN DASHBOARD (LIST)
  // ===========================

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <AdminNavbar
        onSignOut={signOut}
        onViewCalendar={() => setView("calendar")}
        onViewGenerator={() => setView("generator")}
        currentView={view}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Exam Management
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage your exams, monitor live tests, and review history.
            </p>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-800 pb-1">
          <TabButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label="All Exams"
            count={exams.length}
            icon={<Layers className="w-4 h-4" />}
          />
          <TabButton
            active={filter === "live"}
            onClick={() => setFilter("live")}
            label="Live Now"
            count={getCount("live")}
            icon={<PlayCircle className="w-4 h-4" />}
            activeColor="text-emerald-600 border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400"
          />
          <TabButton
            active={filter === "upcoming"}
            onClick={() => setFilter("upcoming")}
            label="Upcoming"
            count={getCount("upcoming")}
            icon={<Calendar className="w-4 h-4" />}
            activeColor="text-sky-600 border-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400"
          />
          <TabButton
            active={filter === "completed"}
            onClick={() => setFilter("completed")}
            label="Previous"
            count={getCount("completed")}
            icon={<History className="w-4 h-4" />}
            activeColor="text-slate-600 border-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
          />
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-sky-600 dark:text-sky-500 mb-4" />
            <p className="text-slate-500 dark:text-slate-400 animate-pulse">Loading exams...</p>
          </div>
        )}

        {/* Empty State for Filter */}
        {!loading && filteredExams.length === 0 && (
          <div className="
            flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed
            bg-slate-100 border-slate-300
            dark:bg-slate-900/50 dark:border-slate-800
          ">
            <div className="p-4 rounded-full bg-slate-200 dark:bg-slate-800 mb-4">
              <FileText className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              No exams found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              There are no exams in the <strong>{filter}</strong> category.
            </p>
            {filter !== "all" && (
              <button
                onClick={() => setFilter("all")}
                className="text-sky-600 hover:underline text-sm font-medium"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* Exams Grid */}
        {!loading && filteredExams.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExams.map((exam: any) => (
              <article
                key={exam.id}
                className="
                  group relative flex flex-col rounded-xl border shadow-sm transition-all hover:shadow-md
                  bg-white border-slate-200 
                  dark:bg-slate-900 dark:border-slate-800 dark:shadow-slate-900/50
                "
              >
                <div className="p-6 flex-1">
                  {/* Card Top */}
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="
                      text-lg font-bold text-slate-900 dark:text-slate-100 
                      line-clamp-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors
                    ">
                      {exam.title}
                    </h3>
                    <div className="flex shrink-0">
                      {exam.is_active ? (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" title="Active" />
                      ) : (
                        <span className="flex h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" title="Inactive" />
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-slate-600 dark:text-slate-400 text-sm line-clamp-2 mb-5 min-h-[2.5rem]">
                    {exam.description || "No description provided."}
                  </p>

                  {/* Meta Details */}
                  <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-500" />
                      {exam.duration_minutes} mins
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BarChart className="w-3.5 h-3.5 text-emerald-500" />
                      Pass: {exam.passing_score}%
                    </div>
                    <div className="col-span-2 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <span className="text-slate-400 dark:text-slate-500">Starts:</span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">
                        {exam.start_time
                          ? new Date(exam.start_time).toLocaleString("en-IN", {
                            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                          })
                          : "Unscheduled"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="
                  grid grid-cols-3 divide-x border-t
                  border-slate-200 divide-slate-200 
                  dark:border-slate-800 dark:divide-slate-800
                ">
                  <button
                    onClick={() => {
                      setSelectedExam(exam);
                      setView("edit");
                    }}
                    className="
                      flex items-center justify-center gap-2 py-3 text-xs font-semibold transition
                      text-slate-600 hover:bg-slate-50 hover:text-amber-600
                      dark:text-slate-400 dark:hover:bg-amber-900/10 dark:hover:text-amber-500
                    "
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  <button
                    onClick={() => {
                      setSelectedExam(exam);
                      setView("results");
                    }}
                    className="
                      flex items-center justify-center gap-2 py-3 text-xs font-semibold transition
                      text-slate-600 hover:bg-slate-50 hover:text-sky-600
                      dark:text-slate-400 dark:hover:bg-sky-900/10 dark:hover:text-sky-500
                    "
                  >
                    <Users className="w-3.5 h-3.5" />
                    Results
                  </button>

                  <button
                    onClick={() => deleteExam(exam.id)}
                    className="
                      flex items-center justify-center gap-2 py-3 text-xs font-semibold transition rounded-br-xl rounded-bl-none
                      text-slate-600 hover:bg-slate-50 hover:text-rose-600
                      dark:text-slate-400 dark:hover:bg-rose-900/10 dark:hover:text-rose-500
                    "
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Helper Component for Tabs
function TabButton({
  active,
  onClick,
  label,
  count,
  icon,
  activeColor = "text-sky-600 border-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400"
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all
        ${active
          ? activeColor
          : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800"
        }
      `}
    >
      {icon}
      {label}
      <span className={`
        ml-1.5 px-2 py-0.5 rounded-full text-[10px]
        ${active
          ? "bg-white/50 shadow-sm"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
        }
      `}>
        {count}
      </span>
    </button>
  );
}