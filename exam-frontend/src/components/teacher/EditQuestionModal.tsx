// src/components/teacher/EditQuestionModal.tsx
import React, { useState } from "react";
import api from "../../lib/api";
import { TeacherQuestion } from "../TeacherDashboard";
import { X, Save, Loader2, AlertCircle } from "lucide-react";

type Props = {
    question: TeacherQuestion;
    onClose: () => void;
    onSuccess: () => void;
};

export function EditQuestionModal({ question, onClose, onSuccess }: Props) {
    const [formData, setFormData] = useState<TeacherQuestion>({ ...question });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await api.put(`/teacher/question-bank/${question.id}`, {
                subject: formData.subject,
                topic: formData.topic,
                complexity: formData.complexity,
                type: formData.type,
                question_text: formData.question_text,
                option1: formData.option1,
                option2: formData.option2,
                option3: formData.option3,
                option4: formData.option4,
                correct: formData.correct,
            });
            onSuccess();
        } catch (err) {
            console.error(err);
            setError("Failed to update question. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="
                    w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl 
                    bg-white border border-slate-200 
                    dark:bg-slate-900 dark:border-slate-800
                "
            >
                {/* Header */}
                <div className="sticky top-0 z-10 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Edit Question
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">

                    {error && (
                        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-300 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subject</label>
                            <input
                                className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                                value={formData.subject}
                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Topic</label>
                            <input
                                className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                                value={formData.topic}
                                onChange={e => setFormData({ ...formData, topic: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Difficulty</label>
                            <select
                                className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                                value={formData.complexity}
                                onChange={e => setFormData({ ...formData, complexity: e.target.value })}
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Type</label>
                            <select
                                className="w-full p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                            >
                                <option value="single-choice">Single Choice</option>
                                <option value="multi-select">Multiple Select</option>
                                <option value="true-false">True / False</option>
                                <option value="descriptive">Descriptive</option>
                                <option value="fill-blanks">Fill in the Blanks</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Question Text</label>
                        <textarea
                            className="w-full p-3 rounded-lg border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition min-h-[100px]"
                            value={formData.question_text}
                            onChange={e => setFormData({ ...formData, question_text: e.target.value })}
                            required
                        />
                    </div>

                    {/* Options (Conditional) */}
                    {formData.type !== 'descriptive' && formData.type !== 'fill-blanks' && (
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                            <label className="block text-xs font-bold uppercase text-slate-500">Answer Options</label>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {['option1', 'option2', 'option3', 'option4'].map((opt, idx) => (
                                    <input
                                        key={opt}
                                        placeholder={`Option ${idx + 1}`}
                                        className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none transition text-sm"
                                        value={(formData as any)[opt] || ''}
                                        onChange={e => setFormData({ ...formData, [opt]: e.target.value })}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Correct Answer(s)</label>
                        <input
                            className="w-full p-2.5 rounded-lg border bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30 text-slate-900 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500 outline-none transition"
                            placeholder="e.g. Option 1, Option 3 (comma separated for multi)"
                            value={formData.correct || ''}
                            onChange={e => setFormData({ ...formData, correct: e.target.value })}
                            required
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            For Single/Multi choice, enter the exact text of the correct option(s).
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="
                                px-6 py-2 rounded-lg text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-all
                                bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center gap-2
                            "
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}