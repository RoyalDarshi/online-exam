// src/components/teacher/UploadWizard.tsx
import React from "react";
import * as XLSX from "xlsx";
import api from "../../lib/api";
import {
    Download,
    Upload,
    AlertTriangle,
    CheckCircle,
    XCircle,
    ArrowLeft
} from "lucide-react";

type PreviewRow = {
    rowIndex: number;
    subject: string;
    complexity: string;
    topic: string;
    type: string;
    question_text: string;
    errors: string[];
};

type Props = {
    onCancel: () => void;
    onSuccess: () => void;
};

export function UploadWizard({ onCancel, onSuccess }: Props) {
    const [previewRows, setPreviewRows] = React.useState<PreviewRow[] | null>(null);
    const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
    const [uploading, setUploading] = React.useState(false);

    // --- Validation Logic ---
    function validateRow(row: any): string[] {
        const errors: string[] = [];
        if (!row.subject) errors.push("Subject missing");
        if (!row.complexity) errors.push("Complexity missing");
        if (!row.type) errors.push("Type missing");
        if (!row.question) errors.push("Question missing");
        return errors;
    }

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet);

        if (json.length === 0) {
            alert("File is empty");
            return;
        }

        const rows = json.map((r, i) => {
            // Clean keys (lowercase)
            const clean: any = {};
            Object.keys(r).forEach(k => clean[k.toLowerCase().trim()] = r[k]);

            const base = {
                rowIndex: i + 2,
                subject: clean.subject || "",
                complexity: clean.complexity || "",
                topic: clean.topic || "",
                type: clean.type || "",
                question_text: clean.question || "",
            };
            return { ...base, errors: validateRow(base) };
        });

        setPreviewRows(rows);
    }

    async function confirmUpload() {
        if (!selectedFile) return;
        setUploading(true);
        const form = new FormData();
        form.append("file", selectedFile);

        try {
            await api.post("/teacher/question-bank/upload", form);
            onSuccess();
        } catch (err) {
            alert("Upload failed. Please check server logs.");
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

    return (
        <div className="max-w-4xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={onCancel} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Import Questions</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Upload bulk questions via Excel sheet.</p>
                </div>
            </div>

            {/* Action Card */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-center">

                {!previewRows ? (
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
                ) : (
                    // PREVIEW TABLE
                    <div className="text-left w-full space-y-4">
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                {previewRows.some(r => r.errors.length > 0) ? (
                                    <AlertTriangle className="text-rose-500 w-5 h-5" />
                                ) : (
                                    <CheckCircle className="text-emerald-500 w-5 h-5" />
                                )}
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {previewRows.length} rows found
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setPreviewRows(null)} className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmUpload}
                                    disabled={uploading || previewRows.some(r => r.errors.length > 0)}
                                    className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {uploading ? "Uploading..." : "Confirm Import"}
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-auto border rounded-lg border-slate-200 dark:border-slate-800">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0">
                                    <tr>
                                        <th className="p-2 border-b dark:border-slate-800 text-left text-slate-500">Row</th>
                                        <th className="p-2 border-b dark:border-slate-800 text-left text-slate-500">Subject</th>
                                        <th className="p-2 border-b dark:border-slate-800 text-left text-slate-500">Question</th>
                                        <th className="p-2 border-b dark:border-slate-800 text-left text-slate-500">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-950">
                                    {previewRows.map((r, i) => (
                                        <tr key={i} className="border-b dark:border-slate-800 last:border-0">
                                            <td className="p-2 text-slate-500">{r.rowIndex}</td>
                                            <td className="p-2 text-slate-700 dark:text-slate-300">{r.subject}</td>
                                            <td className="p-2 text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{r.question_text}</td>
                                            <td className="p-2">
                                                {r.errors.length > 0 ? (
                                                    <span className="text-rose-500 flex items-center gap-1">
                                                        <XCircle className="w-3 h-3" /> {r.errors[0]}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-500 flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Valid
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}