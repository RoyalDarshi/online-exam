import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import {
    ArrowLeft,
    BarChart3,
    Filter,
    Edit3,
    Trash2,
    Save,
    X,
    AlertCircle,
} from "lucide-react";

type Props = {
    onBack: () => void;
};

type QuestionBankRow = {
    id: number;
    subject: string;
    topic: string;
    complexity: string;
    type: string;
    question_text: string;
    option1?: string;
    option2?: string;
    option3?: string;
    option4?: string;
    correct?: string;
};

type TopicAnalytics = {
    topic: string;
    easy: number;
    medium: number;
    hard: number;
    total: number;
};

type OverallAnalytics = {
    easy: number;
    medium: number;
    hard: number;
    total: number;
};

function validateRow(row: QuestionBankRow): string[] {
    const errors: string[] = [];
    if (!row.subject) errors.push("Subject is required");
    if (!row.topic) errors.push("Topic is required");
    if (!row.complexity) errors.push("Complexity is required");
    if (!row.type) errors.push("Question type is required");
    if (!row.question_text) errors.push("Question text is required");

    if (row.type === "single-choice" || row.type === "multi-select") {
        if (!row.option1 || !row.option2 || !row.option3 || !row.option4) {
            errors.push("All 4 options are required for choice questions");
        }
        if (!row.correct) {
            errors.push("Correct answer(s) required");
        }
    }

    if (row.type === "true-false") {
        if (!row.option1 || !row.option2) {
            errors.push("True/False must have 2 options");
        }
        if (!row.correct) {
            errors.push("Correct answer required");
        }
    }

    return errors;
}

export function QuestionBankManager({ onBack }: Props) {
    const [rows, setRows] = useState<QuestionBankRow[]>([]);
    const [loading, setLoading] = useState(true);

    const [analytics, setAnalytics] = useState<{
        by_topic: TopicAnalytics[];
        overall: OverallAnalytics | null;
    }>({ by_topic: [], overall: null });

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editBuffer, setEditBuffer] = useState<Partial<QuestionBankRow>>({});
    const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({});

    // Filters
    const [filterSubject, setFilterSubject] = useState<string>("");
    const [filterTopic, setFilterTopic] = useState<string>("");
    const [filterType, setFilterType] = useState<string>("");
    const [filterComplexity, setFilterComplexity] = useState<string>("");

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [bankRes, analyticsRes] = await Promise.all([
                api.get("/admin/question-bank"),
                api.get("/admin/question-bank/analytics"),
            ]);

            const data = bankRes.data as QuestionBankRow[];
            setRows(data);

            const byTopic = analyticsRes.data.by_topic as TopicAnalytics[];
            const overall = analyticsRes.data.overall as OverallAnalytics;
            setAnalytics({ by_topic: byTopic, overall });

            // initial validation
            const errs: Record<number, string[]> = {};
            data.forEach((r) => {
                const e = validateRow(r);
                if (e.length > 0) errs[r.id] = e;
            });
            setRowErrors(errs);
        } catch (err) {
            console.error(err);
            alert("Failed to load question bank");
        } finally {
            setLoading(false);
        }
    }

    const subjects = useMemo(
        () => Array.from(new Set(rows.map((r) => r.subject).filter(Boolean))),
        [rows]
    );
    const topics = useMemo(
        () => Array.from(new Set(rows.map((r) => r.topic).filter(Boolean))),
        [rows]
    );

    const filteredRows = rows.filter((r) => {
        if (filterSubject && r.subject !== filterSubject) return false;
        if (filterTopic && r.topic !== filterTopic) return false;
        if (filterType && r.type !== filterType) return false;
        if (filterComplexity && r.complexity !== filterComplexity) return false;
        return true;
    });

    function startEdit(row: QuestionBankRow) {
        setEditingId(row.id);
        setEditBuffer(row);
    }

    function cancelEdit() {
        setEditingId(null);
        setEditBuffer({});
    }

    function updateEdit(field: keyof QuestionBankRow, value: string) {
        setEditBuffer((prev) => ({
            ...prev,
            [field]: value,
        }));
    }

    async function saveEdit() {
        if (editingId == null) return;
        const rowIdx = rows.findIndex((r) => r.id === editingId);
        if (rowIdx === -1) return;

        const updatedRow: QuestionBankRow = {
            ...rows[rowIdx],
            ...editBuffer,
        } as QuestionBankRow;

        const errors = validateRow(updatedRow);
        if (errors.length > 0) {
            setRowErrors((prev) => ({ ...prev, [editingId]: errors }));
            alert("Fix validation errors before saving.");
            return;
        }

        try {
            const res = await api.put(
                `/admin/question-bank/${editingId}`,
                updatedRow
            );
            const saved = res.data as QuestionBankRow;

            const newRows = [...rows];
            newRows[rowIdx] = saved;
            setRows(newRows);

            // revalidate
            const e = validateRow(saved);
            setRowErrors((prev) => {
                const copy = { ...prev };
                if (e.length > 0) copy[saved.id] = e;
                else delete copy[saved.id];
                return copy;
            });

            setEditingId(null);
            setEditBuffer({});
        } catch (err) {
            console.error(err);
            alert("Failed to save changes");
        }
    }

    async function deleteRow(id: number) {
        if (!window.confirm("Delete this question?")) return;
        try {
            await api.delete(`/admin/question-bank/${id}`);
            setRows((prev) => prev.filter((r) => r.id !== id));
            setRowErrors((prev) => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });
        } catch (err) {
            console.error(err);
            alert("Failed to delete row");
        }
    }

    const overall = analytics.overall;

    return (
        <div className="min-h-screen bg-gray-50">
            {/* HEADER */}
            <header className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onBack}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-600"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                Question Bank Manager
                            </h1>
                            <p className="text-sm text-gray-600">
                                Manage questions and view topic-wise difficulty analytics.
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* BODY */}
            <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* ANALYTICS CARDS */}
                {overall !== null && (
                    <section>
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            Difficulty Overview
                        </h2>
                        <div className="grid md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl shadow p-4 border border-blue-100">
                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                    Total Questions
                                </p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {overall.total}
                                </p>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4 border border-emerald-100">
                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                    Easy
                                </p>
                                <p className="text-2xl font-bold text-emerald-700 mt-1">
                                    {overall.easy}
                                </p>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4 border border-amber-100">
                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                    Medium
                                </p>
                                <p className="text-2xl font-bold text-amber-700 mt-1">
                                    {overall.medium}
                                </p>
                            </div>
                            <div className="bg-white rounded-xl shadow p-4 border border-red-100">
                                <p className="text-xs text-gray-500 uppercase font-semibold">
                                    Hard
                                </p>
                                <p className="text-2xl font-bold text-red-700 mt-1">
                                    {overall.hard}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* TOPIC-WISE ANALYTICS */}
                {Array.isArray(analytics.by_topic) && analytics.by_topic.length > 0 && (
                    <section>
                        <h2 className="text-lg font-semibold mb-3">
                            Topic-wise difficulty distribution
                        </h2>
                        <div className="bg-white rounded-xl shadow border">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Topic</th>
                                            <th className="px-4 py-2 text-left">Easy</th>
                                            <th className="px-4 py-2 text-left">Medium</th>
                                            <th className="px-4 py-2 text-left">Hard</th>
                                            <th className="px-4 py-2 text-left">Total</th>
                                            <th className="px-4 py-2 text-left">Visual</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.by_topic.map((t) => {
                                            const total = t.total || 1;
                                            const easyPct = (t.easy / total) * 100;
                                            const medPct = (t.medium / total) * 100;
                                            const hardPct = (t.hard / total) * 100;
                                            return (
                                                <tr key={t.topic} className="border-b last:border-none">
                                                    <td className="px-4 py-2 font-medium text-gray-900">
                                                        {t.topic}
                                                    </td>
                                                    <td className="px-4 py-2">{t.easy}</td>
                                                    <td className="px-4 py-2">{t.medium}</td>
                                                    <td className="px-4 py-2">{t.hard}</td>
                                                    <td className="px-4 py-2">{t.total}</td>
                                                    <td className="px-4 py-2">
                                                        <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden flex">
                                                            <div
                                                                className="h-full bg-emerald-400"
                                                                style={{ width: `${easyPct}%` }}
                                                            />
                                                            <div
                                                                className="h-full bg-amber-400"
                                                                style={{ width: `${medPct}%` }}
                                                            />
                                                            <div
                                                                className="h-full bg-red-400"
                                                                style={{ width: `${hardPct}%` }}
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>
                )}

                {/* FILTERS + TABLE */}
                <section className="bg-white rounded-xl shadow border p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            <Filter className="w-5 h-5 text-gray-500" />
                            Question Bank
                        </h2>
                    </div>

                    {/* Filters */}
                    <div className="grid md:grid-cols-4 gap-3 text-sm">
                        <select
                            className="border rounded-lg px-3 py-2"
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                        >
                            <option value="">All Subjects</option>
                            {subjects.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>

                        <select
                            className="border rounded-lg px-3 py-2"
                            value={filterTopic}
                            onChange={(e) => setFilterTopic(e.target.value)}
                        >
                            <option value="">All Topics</option>
                            {topics.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>

                        <select
                            className="border rounded-lg px-3 py-2"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="">All Types</option>
                            <option value="single-choice">Single Choice</option>
                            <option value="multi-select">Multi Select</option>
                            <option value="true-false">True / False</option>
                            <option value="descriptive">Descriptive</option>
                            <option value="fill-blanks">Fill in the Blanks</option>
                        </select>

                        <select
                            className="border rounded-lg px-3 py-2"
                            value={filterComplexity}
                            onChange={(e) => setFilterComplexity(e.target.value)}
                        >
                            <option value="">All Difficulty</option>
                            <option value="easy">Easy</option>
                            <option value="medium">Medium</option>
                            <option value="hard">Hard</option>
                        </select>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="py-10 text-center text-gray-500">
                            Loading question bank...
                        </div>
                    ) : filteredRows.length === 0 ? (
                        <div className="py-10 text-center text-gray-500">
                            No questions match current filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs md:text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Subject</th>
                                        <th className="px-3 py-2 text-left">Topic</th>
                                        <th className="px-3 py-2 text-left">Type</th>
                                        <th className="px-3 py-2 text-left">Difficulty</th>
                                        <th className="px-3 py-2 text-left w-1/2">Question</th>
                                        <th className="px-3 py-2 text-left">Status</th>
                                        <th className="px-3 py-2 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRows.map((row) => {
                                        const errors = rowErrors[row.id] || [];
                                        const isEditing = editingId === row.id;
                                        return (
                                            <tr
                                                key={row.id}
                                                className="border-b last:border-none align-top"
                                            >
                                                {/* Subject */}
                                                <td className="px-3 py-2">
                                                    {isEditing ? (
                                                        <input
                                                            className="border rounded px-2 py-1 w-full"
                                                            value={editBuffer.subject || ""}
                                                            onChange={(e) =>
                                                                updateEdit("subject", e.target.value)
                                                            }
                                                        />
                                                    ) : (
                                                        <span>{row.subject}</span>
                                                    )}
                                                </td>

                                                {/* Topic */}
                                                <td className="px-3 py-2">
                                                    {isEditing ? (
                                                        <input
                                                            className="border rounded px-2 py-1 w-full"
                                                            value={editBuffer.topic || ""}
                                                            onChange={(e) =>
                                                                updateEdit("topic", e.target.value)
                                                            }
                                                        />
                                                    ) : (
                                                        <span>{row.topic}</span>
                                                    )}
                                                </td>

                                                {/* Type */}
                                                <td className="px-3 py-2">
                                                    {isEditing ? (
                                                        <select
                                                            className="border rounded px-2 py-1 w-full"
                                                            value={editBuffer.type || ""}
                                                            onChange={(e) =>
                                                                updateEdit("type", e.target.value)
                                                            }
                                                        >
                                                            <option value="">Select type</option>
                                                            <option value="single-choice">Single Choice</option>
                                                            <option value="multi-select">Multi Select</option>
                                                            <option value="true-false">True / False</option>
                                                            <option value="descriptive">Descriptive</option>
                                                            <option value="fill-blanks">
                                                                Fill in the Blanks
                                                            </option>
                                                        </select>
                                                    ) : (
                                                        <span className="capitalize">
                                                            {row.type.replace("-", " ")}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Complexity */}
                                                <td className="px-3 py-2">
                                                    {isEditing ? (
                                                        <select
                                                            className="border rounded px-2 py-1 w-full"
                                                            value={editBuffer.complexity || ""}
                                                            onChange={(e) =>
                                                                updateEdit("complexity", e.target.value)
                                                            }
                                                        >
                                                            <option value="">Difficulty</option>
                                                            <option value="easy">Easy</option>
                                                            <option value="medium">Medium</option>
                                                            <option value="hard">Hard</option>
                                                        </select>
                                                    ) : (
                                                        <span className="capitalize">{row.complexity}</span>
                                                    )}
                                                </td>

                                                {/* Question text */}
                                                <td className="px-3 py-2">
                                                    {isEditing ? (
                                                        <textarea
                                                            className="border rounded px-2 py-1 w-full min-h-[60px]"
                                                            value={editBuffer.question_text || ""}
                                                            onChange={(e) =>
                                                                updateEdit("question_text", e.target.value)
                                                            }
                                                        />
                                                    ) : (
                                                        <span className="line-clamp-3">
                                                            {row.question_text}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Status / Errors */}
                                                <td className="px-3 py-2">
                                                    {errors.length > 0 ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1 text-red-600 text-xs">
                                                                <AlertCircle className="w-3 h-3" />
                                                                <span>{errors.length} issue(s)</span>
                                                            </div>
                                                            <ul className="text-[10px] text-red-500 list-disc ml-4">
                                                                {errors.slice(0, 3).map((e, i) => (
                                                                    <li key={i}>{e}</li>
                                                                ))}
                                                                {errors.length > 3 && (
                                                                    <li>+ more...</li>
                                                                )}
                                                            </ul>
                                                        </div>
                                                    ) : (
                                                        <span className="text-emerald-600 text-xs flex items-center gap-1">
                                                            ✓ Valid
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="px-3 py-2 text-right">
                                                    {isEditing ? (
                                                        <div className="flex justify-end gap-1">
                                                            <button
                                                                onClick={saveEdit}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700"
                                                            >
                                                                <Save className="w-3 h-3" /> Save
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                                            >
                                                                <X className="w-3 h-3" /> Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-1">
                                                            <button
                                                                onClick={() => startEdit(row)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                                            >
                                                                <Edit3 className="w-3 h-3" /> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => deleteRow(row.id)}
                                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                                            >
                                                                <Trash2 className="w-3 h-3" /> Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
