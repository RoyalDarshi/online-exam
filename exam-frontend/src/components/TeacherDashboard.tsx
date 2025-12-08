import React, { useEffect, useState } from "react";
import api from "../lib/api";
import {
    Upload,
    Edit,
    Trash2,
    FileSpreadsheet,
    BookOpen,
    LogOut,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as XLSX from "xlsx";

type TeacherQuestion = {
    ID: string;
    Subject: string;
    Topic: string;
    Complexity: string;
    Type: string;
    QuestionText: string;
    Option1?: string;
    Option2?: string;
    Option3?: string;
    Option4?: string;
    Correct?: string;
};

type PreviewRow = {
    rowIndex: number;
    subject: string;
    complexity: string;
    topic: string;
    type: string;
    question: string;
    option1?: string;
    option2?: string;
    option3?: string;
    option4?: string;
    correct?: string;
    errors: string[];
};

export function TeacherDashboard() {
    const { signOut, user } = useAuth();

    const [questions, setQuestions] = useState<TeacherQuestion[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<"questions" | "analytics">(
        "questions"
    );

    const [uploading, setUploading] = useState(false);
    const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState<TeacherQuestion | null>(null);

    // Filters for questions tab
    const [subjectFilter, setSubjectFilter] = useState("");
    const [topicFilter, setTopicFilter] = useState("");
    const [search, setSearch] = useState("");

    useEffect(() => {
        loadQuestions();
    }, []);



    async function loadQuestions() {
        try {
            setLoading(true);
            const res = await api.get<TeacherQuestion[]>("/teacher/question-bank");
            setQuestions(res.data);
        } catch (err) {
            console.error(err);
            alert("Failed to load question bank");
        } finally {
            setLoading(false);
        }
    }

    // ---------------- TEMPLATE DOWNLOAD ----------------

    async function downloadTemplate() {
        try {
            const res = await api.get("/teacher/question-bank/template", {
                responseType: "blob",
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "question_bank_template.xlsx");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error(err);
            alert("Failed to download template");
        }
    }

    // ---------------- XLSX PREVIEW + VALIDATION ----------------

    function validateRow(row: Omit<PreviewRow, "errors">): string[] {
        const errors: string[] = [];

        if (!row.subject) errors.push("Subject is required");
        if (!row.complexity) errors.push("Complexity is required");
        if (!row.topic) errors.push("Topic is required");
        if (!row.type) errors.push("Type is required");
        if (!row.question) errors.push("Question is required");

        const type = row.type?.toLowerCase();

        if (type === "single-choice" || type === "multi-select") {
            if (!row.option1 || !row.option2 || !row.option3 || !row.option4) {
                errors.push("All 4 options required for choice questions");
            }
            if (!row.correct) {
                errors.push("Correct answer(s) required");
            }
        }

        if (type === "true-false") {
            if (!row.option1 || !row.option2) {
                errors.push("True/False must have 2 options");
            }
            if (!row.correct) {
                errors.push("Correct answer required");
            }
        }

        // descriptive / fill-blanks: question required, correct optional
        return errors;
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheet];

            const json: any[] = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: "",
            });

            if (json.length < 2) {
                alert("Template is empty");
                return;
            }

            const headerRow = json[0].map((h: any) => String(h).toLowerCase().trim());
            const requiredHeaders = [
                "subject",
                "complexity",
                "topic",
                "type",
                "question",
            ];

            for (const h of requiredHeaders) {
                if (!headerRow.includes(h)) {
                    alert(`Missing required column: ${h}`);
                    return;
                }
            }

            const colIndex = (name: string) =>
                headerRow.indexOf(name.toLowerCase());

            const rows: PreviewRow[] = json.slice(1).map((row, idx) => {
                const base = {
                    rowIndex: idx + 2, // Excel row number
                    subject: row[colIndex("subject")] || "",
                    complexity: row[colIndex("complexity")] || "",
                    topic: row[colIndex("topic")] || "",
                    type: row[colIndex("type")] || "",
                    question: row[colIndex("question")] || "",
                    option1: row[colIndex("option1")] || "",
                    option2: row[colIndex("option2")] || "",
                    option3: row[colIndex("option3")] || "",
                    option4: row[colIndex("option4")] || "",
                    correct: row[colIndex("correct")] || "",
                };
                return {
                    ...base,
                    errors: validateRow(base),
                };
            });

            setPreviewRows(rows);
            setActiveTab("questions"); // stay on questions tab
        } catch (err) {
            console.error(err);
            alert("Failed to parse Excel file");
        } finally {
            e.target.value = "";
        }
    }

    async function confirmUpload() {
        if (!selectedFile || !previewRows) return;

        const hasErrors = previewRows.some((r) => r.errors.length > 0);
        if (hasErrors) {
            alert("Fix all errors in the preview before uploading.");
            return;
        }

        const form = new FormData();
        form.append("file", selectedFile);

        try {
            setUploading(true);
            await api.post("/teacher/question-bank/upload", form, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            alert("Upload successful");
            setPreviewRows(null);
            setSelectedFile(null);
            await loadQuestions();
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        } finally {
            setUploading(false);
        }
    }

    function cancelPreview() {
        setPreviewRows(null);
        setSelectedFile(null);
    }

    // ---------------- EDIT / DELETE ----------------

    async function deleteQuestion(id: string) {
        if (!window.confirm("Delete this question?")) return;

        try {
            await api.delete(`/teacher/question-bank/${id}`);
            setQuestions((prev) => prev.filter((q) => q.ID !== id));
        } catch (err) {
            console.error(err);
            alert("Failed to delete");
        }
    }

    function openEditModal(q: TeacherQuestion) {
        setEditData({ ...q });
        setShowEditModal(true);
    }

    async function saveEdit() {
        if (!editData) return;

        try {
            await api.put(`/teacher/question-bank/${editData.ID}`, {
                Subject: editData.Subject,
                Topic: editData.Topic,
                Complexity: editData.Complexity,
                Type: editData.Type,
                QuestionText: editData.QuestionText,
                Option1: editData.Option1,
                Option2: editData.Option2,
                Option3: editData.Option3,
                Option4: editData.Option4,
                Correct: editData.Correct,
            });

            alert("Updated successfully");
            setShowEditModal(false);
            await loadQuestions();
        } catch (err) {
            console.error(err);
            alert("Failed to update");
        }
    }

    // ---------------- FILTERS & ANALYTICS ----------------

    const subjects = Array.from(new Set(questions.map((q) => q.Subject)));
    const topics = Array.from(
        new Set(
            questions
                .filter((q) => (subjectFilter ? q.Subject === subjectFilter : true))
                .map((q) => q.Topic)
        )
    );

    const filteredQuestions = questions.filter((q) => {
        if (subjectFilter && q.Subject !== subjectFilter) return false;
        if (topicFilter && q.Topic !== topicFilter) return false;
        if (
            search &&
            !q.QuestionText.toLowerCase().includes(search.toLowerCase())
        )
            return false;
        return true;
    });

    // Simple analytics tables computed on client side
    const analyticsSummary = questions.reduce(
        (acc, q) => {
            acc.total++;
            const c = q.Complexity.toLowerCase();
            if (c === "easy") acc.easy++;
            else if (c === "medium") acc.medium++;
            else if (c === "hard") acc.hard++;
            return acc;
        },
        { total: 0, easy: 0, medium: 0, hard: 0 }
    );

    type SubjectAgg = {
        subject: string;
        total: number;
        easy: number;
        medium: number;
        hard: number;
    };

    const bySubjectMap = new Map<string, SubjectAgg>();
    questions.forEach((q) => {
        const key = q.Subject || "Unknown";
        if (!bySubjectMap.has(key)) {
            bySubjectMap.set(key, {
                subject: key,
                total: 0,
                easy: 0,
                medium: 0,
                hard: 0,
            });
        }
        const agg = bySubjectMap.get(key)!;
        agg.total++;
        const c = q.Complexity.toLowerCase();
        if (c === "easy") agg.easy++;
        else if (c === "medium") agg.medium++;
        else if (c === "hard") agg.hard++;
    });
    const bySubject = Array.from(bySubjectMap.values());

    type TopicAgg = {
        subject: string;
        topic: string;
        total: number;
        easy: number;
        medium: number;
        hard: number;
    };

    const byTopicMap = new Map<string, TopicAgg>();
    questions.forEach((q) => {
        const key = `${q.Subject}::${q.Topic || "Uncategorized"}`;
        if (!byTopicMap.has(key)) {
            byTopicMap.set(key, {
                subject: q.Subject || "Unknown",
                topic: q.Topic || "Uncategorized",
                total: 0,
                easy: 0,
                medium: 0,
                hard: 0,
            });
        }
        const agg = byTopicMap.get(key)!;
        agg.total++;
        const c = q.Complexity.toLowerCase();
        if (c === "easy") agg.easy++;
        else if (c === "medium") agg.medium++;
        else if (c === "hard") agg.hard++;
    });
    const byTopic = Array.from(byTopicMap.values());

    // ---------------- RENDER ----------------

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* TOP NAV */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="w-7 h-7 text-blue-600" />
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">
                                Teacher Portal
                            </h1>
                            <p className="text-xs text-gray-500">
                                Welcome, {user?.full_name} ({user?.email})
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Upload Button */}
                        <label className="cursor-pointer flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
                            <Upload className="w-4 h-4" />
                            Upload XLSX
                            <input
                                type="file"
                                className="hidden"
                                accept=".xlsx"
                                onChange={handleFileChange}
                            />
                        </label>

                        {/* Template Button */}
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Template
                        </button>

                        {/* Logout */}
                        <button
                            onClick={signOut}
                            className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <nav className="bg-gray-50 border-t border-gray-100">
                    <div className="max-w-7xl mx-auto px-4 py-2 flex gap-4 text-sm">
                        <button
                            className={`pb-1 ${activeTab === "questions"
                                ? "font-semibold text-blue-700 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                            onClick={() => setActiveTab("questions")}
                        >
                            Questions
                        </button>
                        <button
                            className={`pb-1 ${activeTab === "analytics"
                                ? "font-semibold text-blue-700 border-b-2 border-blue-600"
                                : "text-gray-600 hover:text-gray-900"
                                }`}
                            onClick={() => setActiveTab("analytics")}
                        >
                            Analytics
                        </button>
                    </div>
                </nav>
            </header>

            {/* MAIN CONTENT */}
            <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
                {activeTab === "questions" && (
                    <>
                        {/* If preview is present, show preview card */}
                        {previewRows && (
                            <div className="mb-6 bg-white rounded-xl shadow border border-blue-200 p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <h2 className="text-sm font-semibold text-blue-700">
                                            Preview Upload ({previewRows.length} rows)
                                        </h2>
                                        <p className="text-xs text-gray-500">
                                            Fix errors (if any) before confirming.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={cancelPreview}
                                            className="px-3 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmUpload}
                                            className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                                            disabled={uploading}
                                        >
                                            {uploading ? "Uploading..." : "Confirm Upload"}
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-72 overflow-auto text-xs">
                                    <table className="w-full border-collapse">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border p-1">Row</th>
                                                <th className="border p-1">Subject</th>
                                                <th className="border p-1">Topic</th>
                                                <th className="border p-1">Complexity</th>
                                                <th className="border p-1">Type</th>
                                                <th className="border p-1">Question</th>
                                                <th className="border p-1">Errors</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewRows.map((r) => (
                                                <tr
                                                    key={r.rowIndex}
                                                    className={
                                                        r.errors.length > 0 ? "bg-red-50" : "bg-white"
                                                    }
                                                >
                                                    <td className="border p-1">{r.rowIndex}</td>
                                                    <td className="border p-1">{r.subject}</td>
                                                    <td className="border p-1">{r.topic}</td>
                                                    <td className="border p-1">{r.complexity}</td>
                                                    <td className="border p-1">{r.type}</td>
                                                    <td className="border p-1 max-w-[200px]">
                                                        <span className="line-clamp-2">{r.question}</span>
                                                    </td>
                                                    <td className="border p-1 text-red-600">
                                                        {r.errors.length > 0 ? r.errors.join("; ") : "OK"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Filters */}
                        <div className="flex flex-wrap gap-3 mb-4 text-sm">
                            <select
                                value={subjectFilter}
                                onChange={(e) => {
                                    setSubjectFilter(e.target.value);
                                    setTopicFilter("");
                                }}
                                className="border rounded-lg px-3 py-2 bg-white"
                            >
                                <option value="">All Subjects</option>
                                {subjects.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={topicFilter}
                                onChange={(e) => setTopicFilter(e.target.value)}
                                className="border rounded-lg px-3 py-2 bg-white"
                            >
                                <option value="">All Topics</option>
                                {topics.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>

                            <input
                                type="text"
                                placeholder="Search question text..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="border rounded-lg px-3 py-2 flex-1 min-w-[200px] bg-white"
                            />
                        </div>

                        {/* Questions Table */}
                        {loading ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                            </div>
                        ) : filteredQuestions.length === 0 ? (
                            <div className="bg-white p-10 text-center rounded-xl shadow">
                                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="font-semibold text-gray-800">
                                    No questions found
                                </p>
                                <p className="text-sm text-gray-500">
                                    Try changing filters or upload a new question bank file.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="bg-gray-100 text-gray-700">
                                        <tr>
                                            <th className="p-2 border">Subject</th>
                                            <th className="p-2 border">Topic</th>
                                            <th className="p-2 border">Difficulty</th>
                                            <th className="p-2 border">Type</th>
                                            <th className="p-2 border w-1/2">Question</th>
                                            <th className="p-2 border text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredQuestions.map((q) => (
                                            <tr key={q.ID} className="border-t hover:bg-gray-50">
                                                <td className="p-2 border">{q.Subject}</td>
                                                <td className="p-2 border">{q.Topic}</td>
                                                <td className="p-2 border capitalize">
                                                    {q.Complexity}
                                                </td>
                                                <td className="p-2 border capitalize">{q.Type}</td>
                                                <td className="p-2 border max-w-[400px]">
                                                    <span className="line-clamp-2">{q.QuestionText}</span>
                                                </td>
                                                <td className="p-2 border text-center">
                                                    <button
                                                        className="text-blue-600 hover:text-blue-800 mr-3"
                                                        onClick={() => openEditModal(q)}
                                                    >
                                                        <Edit className="inline w-4 h-4" />
                                                    </button>
                                                    <button
                                                        className="text-red-600 hover:text-red-800"
                                                        onClick={() => deleteQuestion(q.ID)}
                                                    >
                                                        <Trash2 className="inline w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {activeTab === "analytics" && (
                    <div className="space-y-6">
                        {/* Summary */}
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                    Total Questions
                                </p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {analyticsSummary.total}
                                </p>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4 border border-emerald-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                    Easy
                                </p>
                                <p className="text-2xl font-bold text-emerald-700 mt-1">
                                    {analyticsSummary.easy}
                                </p>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4 border border-amber-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                    Medium
                                </p>
                                <p className="text-2xl font-bold text-amber-700 mt-1">
                                    {analyticsSummary.medium}
                                </p>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4 border border-red-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                    Hard
                                </p>
                                <p className="text-2xl font-bold text-red-700 mt-1">
                                    {analyticsSummary.hard}
                                </p>
                            </div>
                        </div>

                        {/* By Subject */}
                        <div className="bg-white rounded-xl shadow border">
                            <div className="px-4 py-3 border-b">
                                <h2 className="text-sm font-semibold text-gray-800">
                                    By Subject
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs md:text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Subject</th>
                                            <th className="px-3 py-2 text-left">Easy</th>
                                            <th className="px-3 py-2 text-left">Medium</th>
                                            <th className="px-3 py-2 text-left">Hard</th>
                                            <th className="px-3 py-2 text-left">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bySubject.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={5}
                                                    className="px-3 py-4 text-center text-gray-500"
                                                >
                                                    No data
                                                </td>
                                            </tr>
                                        ) : (
                                            bySubject.map((s) => (
                                                <tr key={s.subject} className="border-b last:border-none">
                                                    <td className="px-3 py-2 font-medium text-gray-900">
                                                        {s.subject}
                                                    </td>
                                                    <td className="px-3 py-2">{s.easy}</td>
                                                    <td className="px-3 py-2">{s.medium}</td>
                                                    <td className="px-3 py-2">{s.hard}</td>
                                                    <td className="px-3 py-2">{s.total}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* By Subject + Topic */}
                        <div className="bg-white rounded-xl shadow border">
                            <div className="px-4 py-3 border-b">
                                <h2 className="text-sm font-semibold text-gray-800">
                                    By Subject & Topic
                                </h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs md:text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Subject</th>
                                            <th className="px-3 py-2 text-left">Topic</th>
                                            <th className="px-3 py-2 text-left">Easy</th>
                                            <th className="px-3 py-2 text-left">Medium</th>
                                            <th className="px-3 py-2 text-left">Hard</th>
                                            <th className="px-3 py-2 text-left">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byTopic.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="px-3 py-4 text-center text-gray-500"
                                                >
                                                    No data
                                                </td>
                                            </tr>
                                        ) : (
                                            byTopic.map((t) => (
                                                <tr
                                                    key={`${t.subject}-${t.topic}`}
                                                    className="border-b last:border-none"
                                                >
                                                    <td className="px-3 py-2 font-medium text-gray-900">
                                                        {t.subject}
                                                    </td>
                                                    <td className="px-3 py-2">{t.topic}</td>
                                                    <td className="px-3 py-2">{t.easy}</td>
                                                    <td className="px-3 py-2">{t.medium}</td>
                                                    <td className="px-3 py-2">{t.hard}</td>
                                                    <td className="px-3 py-2">{t.total}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* EDIT MODAL */}
            {showEditModal && editData && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-xl max-h-[80vh] overflow-y-auto">
                        <h2 className="text-lg font-semibold mb-4">Edit Question</h2>

                        <div className="space-y-3 text-sm">
                            <input
                                className="border p-2 rounded w-full"
                                value={editData.Subject}
                                onChange={(e) =>
                                    setEditData({ ...editData, Subject: e.target.value })
                                }
                                placeholder="Subject"
                            />

                            <input
                                className="border p-2 rounded w-full"
                                value={editData.Topic}
                                onChange={(e) =>
                                    setEditData({ ...editData, Topic: e.target.value })
                                }
                                placeholder="Topic"
                            />

                            <select
                                className="border p-2 rounded w-full"
                                value={editData.Complexity}
                                onChange={(e) =>
                                    setEditData({
                                        ...editData,
                                        Complexity: e.target.value,
                                    })
                                }
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>

                            <select
                                className="border p-2 rounded w-full"
                                value={editData.Type}
                                onChange={(e) =>
                                    setEditData({ ...editData, Type: e.target.value })
                                }
                            >
                                <option value="single-choice">Single Choice</option>
                                <option value="multi-select">Multiple Select</option>
                                <option value="true-false">True / False</option>
                                <option value="descriptive">Descriptive</option>
                                <option value="fill-blanks">Fill in the Blanks</option>
                            </select>

                            <textarea
                                className="border p-2 rounded w-full"
                                value={editData.QuestionText}
                                onChange={(e) =>
                                    setEditData({ ...editData, QuestionText: e.target.value })
                                }
                                placeholder="Question Text"
                                rows={4}
                            />

                            {editData.Type !== "descriptive" && (
                                <>
                                    <input
                                        className="border p-2 rounded w-full"
                                        placeholder="Option 1"
                                        value={editData.Option1}
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                Option1: e.target.value,
                                            })
                                        }
                                    />
                                    <input
                                        className="border p-2 rounded w-full"
                                        placeholder="Option 2"
                                        value={editData.Option2}
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                Option2: e.target.value,
                                            })
                                        }
                                    />
                                    <input
                                        className="border p-2 rounded w-full"
                                        placeholder="Option 3"
                                        value={editData.Option3}
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                Option3: e.target.value,
                                            })
                                        }
                                    />
                                    <input
                                        className="border p-2 rounded w-full"
                                        placeholder="Option 4"
                                        value={editData.Option4}
                                        onChange={(e) =>
                                            setEditData({
                                                ...editData,
                                                Option4: e.target.value,
                                            })
                                        }
                                    />
                                </>
                            )}

                            <input
                                className="border p-2 rounded w-full"
                                placeholder="Correct Answer (or comma separated)"
                                value={editData.Correct}
                                onChange={(e) =>
                                    setEditData({ ...editData, Correct: e.target.value })
                                }
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                onClick={() => setShowEditModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                onClick={saveEdit}
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
