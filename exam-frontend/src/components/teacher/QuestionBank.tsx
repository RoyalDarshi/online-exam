// src/components/teacher/QuestionBank.tsx
import React, { useState, useMemo } from "react";
import { TeacherQuestion } from "../TeacherDashboard";
import api from "../../lib/api";
import { EditQuestionModal } from "./EditQuestionModal";
import {
    Search,
    Trash2,
    Edit,
    Filter,
    ChevronLeft,
    ChevronRight,
    FileSpreadsheet
} from "lucide-react";

type Props = {
    questions: TeacherQuestion[];
    onRefresh: () => void;
};

export function QuestionBank({ questions, onRefresh }: Props) {
    const [search, setSearch] = useState("");
    const [subjectFilter, setSubjectFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [editingQ, setEditingQ] = useState<TeacherQuestion | null>(null);

    const itemsPerPage = 10;

    // --- Derived Data ---
    const subjects = Array.from(new Set(questions.map((q) => q.subject)));

    const filteredData = useMemo(() => {
        return questions.filter((q) => {
            const matchSubject = subjectFilter ? q.subject === subjectFilter : true;
            const matchSearch = search
                ? q.question_text.toLowerCase().includes(search.toLowerCase()) ||
                q.topic.toLowerCase().includes(search.toLowerCase())
                : true;
            return matchSubject && matchSearch;
        });
    }, [questions, subjectFilter, search]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const paginatedData = filteredData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // --- Actions ---
    async function handleDelete(id: string) {
        if (!window.confirm("Are you sure you want to delete this question?")) return;
        try {
            await api.delete(`/teacher/question-bank/${id}`);
            onRefresh();
        } catch (err) {
            alert("Failed to delete question");
        }
    }

    return (
        <div className="space-y-4">

            {/* Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search questions or topics..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="relative min-w-[200px]">
                    <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <select
                        className="w-full pl-10 pr-4 py-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none appearance-none transition"
                        value={subjectFilter}
                        onChange={(e) => setSubjectFilter(e.target.value)}
                    >
                        <option value="">All Subjects</option>
                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Table Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Subject / Topic</th>
                                <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Difficulty</th>
                                <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400">Question</th>
                                <th className="px-6 py-3 font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                                                <FileSpreadsheet className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <p className="text-slate-900 dark:text-slate-100 font-medium">No questions found</p>
                                            <p className="text-slate-500 text-xs mt-1">Try adjusting filters or upload new data.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((q) => (
                                    <tr key={q.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900 dark:text-slate-100">{q.subject}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{q.topic}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`
                                                inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border
                                                ${q.complexity.toLowerCase() === 'easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                                                    q.complexity.toLowerCase() === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                                                        'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'}
                                            `}>
                                                {q.complexity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-lg">
                                            <p className="text-slate-700 dark:text-slate-300 line-clamp-2" title={q.question_text}>
                                                {q.question_text}
                                            </p>
                                            <span className="text-[10px] text-slate-400 uppercase font-semibold mt-1 block">
                                                {q.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => setEditingQ(q)}
                                                    className="p-2 text-sky-600 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-900/20 rounded-lg transition"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(q.id)}
                                                    className="p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20 rounded-lg transition"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Page <span className="font-semibold text-slate-900 dark:text-white">{currentPage}</span> of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {editingQ && (
                <EditQuestionModal
                    question={editingQ}
                    onClose={() => setEditingQ(null)}
                    onSuccess={() => {
                        setEditingQ(null);
                        onRefresh();
                    }}
                />
            )}
        </div>
    );
}