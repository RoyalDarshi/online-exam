import React from "react";
import * as XLSX from "xlsx";
import api from "../../lib/api";
import {
    Download,
    Upload,
    AlertTriangle,
    CheckCircle,
    Trash2,
    ArrowLeft,
    Save
} from "lucide-react";

// --- Types ---
type QuestionType = "single-choice" | "multi-select" | "true-false" | "descriptive";
type Complexity = "easy" | "medium" | "hard";

type PreviewRow = {
    id: string; // unique ID for React keys
    rowIndex: number;
    subject: string;
    complexity: string;
    topic: string;
    type: string;
    question: string;
    option1: string;
    option2: string;
    option3: string;
    option4: string;
    correct: string;
    errors: string[];
};

type Props = {
    onCancel: () => void;
    onSuccess: () => void;
};

export function UploadWizard({ onCancel, onSuccess }: Props) {
    const [previewRows, setPreviewRows] = React.useState<PreviewRow[] | null>(null);
    const [uploading, setUploading] = React.useState(false);

    // --- Validation Logic ---
    function validateRow(row: PreviewRow): string[] {
        const errors: string[] = [];
        if (!row.subject) errors.push("Subject missing");
        if (!row.topic) errors.push("Topic missing");
        if (!row.question) errors.push("Question missing");

        // Normalize inputs for validation
        const type = row.type.toLowerCase().trim();
        const validTypes = ["single-choice", "multi-select", "true-false", "descriptive"];

        if (!validTypes.includes(type)) {
            errors.push("Invalid type (use single-choice, true-false, etc)");
        }

        // Context-aware validation
        if (type === "single-choice" || type === "multi-select") {
            if (!row.option1 || !row.option2) errors.push("Requires at least Option 1 & 2");
            if (!row.correct) errors.push("Correct answer missing");
        } else if (type === "true-false") {
            const ans = row.correct.toLowerCase().trim();
            if (ans !== "true" && ans !== "false") {
                errors.push("Correct answer must be 'true' or 'false'");
            }
        } else if (type === "descriptive") {
            // Descriptive only needs question text, which is checked at top
        }

        return errors;
    }

    // --- Handlers ---
    // --- Handlers ---
    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);

        if (json.length === 0) {
            alert("File is empty");
            return;
        }

        const rows = json.map((r, i) => {
            // FIX: Use nullish coalescing (??) or explicit check to preserve 0 and false
            const get = (key: string) => {
                const val = r[key] ?? r[key.toLowerCase()] ?? r[key.toUpperCase()];
                return (val !== undefined && val !== null) ? String(val).trim() : "";
            };

            const base: PreviewRow = {
                id: crypto.randomUUID(),
                rowIndex: i + 2, // Excel row number (1-based + header)
                subject: get("Subject"),
                complexity: get("Complexity") || "medium",
                topic: get("Topic"),
                type: get("Type") || "single-choice",
                question: get("Question") || get("QuestionText"),
                option1: get("A"),
                option2: get("B"),
                option3: get("C"),
                option4: get("D"),
                correct: get("Correct"),
                errors: [],
            };
            base.errors = validateRow(base);
            return base;
        });

        setPreviewRows(rows);
    }

    // Update a field in a row and re-validate
    const updateRow = (id: string, field: keyof PreviewRow, value: string) => {
        setPreviewRows(prev => {
            if (!prev) return null;
            return prev.map(row => {
                if (row.id === id) {
                    const updated = { ...row, [field]: value };
                    updated.errors = validateRow(updated);
                    return updated;
                }
                return row;
            });
        });
    };

    // Remove a row
    const deleteRow = (id: string) => {
        if (confirm("Are you sure you want to remove this row?")) {
            setPreviewRows(prev => prev?.filter(r => r.id !== id) || null);
        }
    };

    async function confirmUpload() {
        if (!previewRows || previewRows.some(r => r.errors.length > 0)) return;
        setUploading(true);

        // Convert back to minimal structure for backend
        // Note: Backend expects a File, but since we edited data, 
        // we should create a new Excel file or send JSON. 
        // *Improvement*: Sending JSON is cleaner for edited data, but backend expects File.
        // Let's generate a new Excel file from the edited data to send to the existing backend endpoint.

        try {
            const worksheet = XLSX.utils.json_to_sheet(previewRows.map(r => ({
                Subject: r.subject,
                Complexity: r.complexity,
                Topic: r.topic,
                Type: r.type,
                QuestionText: r.question,
                Option1: r.option1,
                Option2: r.option2,
                Option3: r.option3,
                Option4: r.option4,
                Correct: r.correct
            })));

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

            const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
            const formData = new FormData();
            formData.append("file", blob, "edited_questions.xlsx");

            await api.post("/teacher/question-bank/upload", formData);
            alert("Upload Successful!");
            onSuccess();
        } catch (err: any) {
            console.error(err);
            const msg = err.response?.data?.error || "Upload failed";
            alert(`Error: ${msg}`);
        } finally {
            setUploading(false);
        }
    }

    async function downloadTemplate() {
        try {
            const res = await api.get("/teacher/question-bank/template", { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "question_bank_template.xlsx");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            alert("Template download failed");
        }
    }



    if (!previewRows) {
        // RENDER FILE SELECTION (Same as original but kept brief here)
        return (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 bg-sky-50 dark:bg-sky-900/20 rounded-full flex items-center justify-center mb-2">
                        <Upload className="w-8 h-8 text-sky-600 dark:text-sky-400" />
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Select Excel File</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Supported format: .xlsx</p>
                    </div>

                    <div className="flex gap-4 mt-4">
                        <label className="cursor-pointer bg-sky-600 hover:bg-sky-500 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-sky-600/20 transition-all flex items-center gap-2">
                            <Upload className="w-4 h-4" /> Choose File
                            <input type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
                        </label>
                        <button
                            onClick={downloadTemplate}
                            className="px-6 py-2.5 rounded-lg font-medium border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                        >
                            <Download className="w-4 h-4" /> Download Template
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const hasErrors = previewRows.some(r => r.errors.length > 0);

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-slate-100">Review Questions</h2>
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-slate-500">{previewRows.length} questions</span>
                            {hasErrors ? (
                                <span className="text-rose-500 font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Fix errors to proceed
                                </span>
                            ) : (
                                <span className="text-emerald-500 font-medium flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Ready to upload
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setPreviewRows(null)} className="text-sm font-medium text-slate-500 hover:text-slate-800">
                        Cancel
                    </button>
                    <button
                        onClick={confirmUpload}
                        disabled={uploading || hasErrors}
                        className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {uploading ? "Uploading..." : "Confirm Import"}
                    </button>
                </div>
            </div>

            {/* Editable Table */}
            <div className="overflow-auto border rounded-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 max-h-[70vh]">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950 sticky top-0 z-0">
                        <tr>
                            <th className="p-3 text-left w-10">#</th>
                            <th className="p-3 text-left min-w-[120px]">Type</th>
                            <th className="p-3 text-left min-w-[300px]">Question</th>
                            <th className="p-3 text-left min-w-[200px]">Options & Answer</th>
                            <th className="p-3 text-left w-[100px]">Status</th>
                            <th className="p-3 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {previewRows.map((row, i) => (
                            <tr key={row.id} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="p-3 text-slate-400 text-xs">{i + 1}</td>

                                {/* Type & Subject Column */}
                                <td className="p-3 align-top space-y-2">
                                    <select
                                        className="w-full p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                        value={row.type}
                                        onChange={(e) => updateRow(row.id, "type", e.target.value)}
                                    >
                                        <option value="single-choice">Single Choice</option>
                                        <option value="multi-select">Multi Select</option>
                                        <option value="true-false">True / False</option>
                                        <option value="descriptive">Descriptive</option>
                                    </select>
                                    <select
                                        className="w-full p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                        value={row.complexity}
                                        onChange={(e) => updateRow(row.id, "complexity", e.target.value)}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                    <input
                                        className="w-full p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                        placeholder="Subject"
                                        value={row.subject}
                                        onChange={(e) => updateRow(row.id, "subject", e.target.value)}
                                    />
                                    <input
                                        className="w-full p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                        placeholder="Topic"
                                        value={row.topic}
                                        onChange={(e) => updateRow(row.id, "topic", e.target.value)}
                                    />
                                </td>

                                {/* Question Text */}
                                <td className="p-3 align-top">
                                    <textarea
                                        className="w-full p-2 border rounded text-sm bg-transparent dark:border-slate-700 min-h-[80px]"
                                        value={row.question}
                                        onChange={(e) => updateRow(row.id, "question", e.target.value)}
                                        placeholder="Enter question text here..."
                                    />
                                </td>

                                {/* Options & Correct Answer */}
                                <td className="p-3 align-top space-y-1">
                                    {row.type !== "descriptive" && (
                                        <>
                                            <div className="grid grid-cols-2 gap-1">
                                                {row.type !== "true-false" && (
                                                    <>
                                                        <input
                                                            className="p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                                            placeholder="Option 1"
                                                            value={row.option1}
                                                            onChange={(e) => updateRow(row.id, "option1", e.target.value)}
                                                        />
                                                        <input
                                                            className="p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                                            placeholder="Option 2"
                                                            value={row.option2}
                                                            onChange={(e) => updateRow(row.id, "option2", e.target.value)}
                                                        />
                                                        <input
                                                            className="p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                                            placeholder="Option 3"
                                                            value={row.option3}
                                                            onChange={(e) => updateRow(row.id, "option3", e.target.value)}
                                                        />
                                                        <input
                                                            className="p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                                            placeholder="Option 4"
                                                            value={row.option4}
                                                            onChange={(e) => updateRow(row.id, "option4", e.target.value)}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                            <div className="pt-2">
                                                <label className="text-xs font-semibold text-slate-500 block mb-1">Correct Answer:</label>
                                                {row.type === "true-false" ? (
                                                    <select
                                                        className="w-full p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                                        value={row.correct.toLowerCase()}
                                                        onChange={(e) => updateRow(row.id, "correct", e.target.value)}
                                                    >
                                                        <option value="">Select...</option>
                                                        <option value="true">True</option>
                                                        <option value="false">False</option>
                                                    </select>
                                                ) : (
                                                    <input
                                                        className="w-full p-1 border rounded text-xs bg-transparent dark:border-slate-700"
                                                        placeholder="Answer Key (e.g. Option 1)"
                                                        value={row.correct}
                                                        onChange={(e) => updateRow(row.id, "correct", e.target.value)}
                                                    />
                                                )}
                                            </div>
                                        </>
                                    )}
                                    {row.type === "descriptive" && (
                                        <p className="text-xs text-slate-400 italic">No options for descriptive questions.</p>
                                    )}
                                </td>

                                {/* Validation Status */}
                                <td className="p-3 align-top">
                                    {row.errors.length > 0 ? (
                                        <div className="text-rose-500 text-xs space-y-1">
                                            {row.errors.map((err, k) => (
                                                <div key={k} className="flex items-start gap-1">
                                                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                                    <span>{err}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-emerald-500 text-xs flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Valid
                                        </div>
                                    )}
                                </td>

                                {/* Delete Button */}
                                <td className="p-3 align-top text-right">
                                    <button
                                        onClick={() => deleteRow(row.id)}
                                        className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                                        title="Delete Row"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}