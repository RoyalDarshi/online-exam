// src/components/TeacherDashboard.tsx
import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { TeacherNavbar } from "./TeacherNavbar";
import { QuestionBank } from "./QuestionBank";
import { TeacherAnalytics } from "./TeacherAnalytics";
import { UploadWizard } from "./UploadWizard";
import { Loader2, Layers, BarChart3, UploadCloud } from "lucide-react";

export type TeacherQuestion = {
    id: string;
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

export function TeacherDashboard() {
    const { signOut, user } = useAuth();
    const [questions, setQuestions] = useState<TeacherQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"questions" | "analytics" | "upload">("questions");

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
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <TeacherNavbar user={user} onLogout={signOut} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Dashboard Header & Tabs */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Question Bank
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            Manage curriculum, upload questions, and analyze difficulty distribution.
                        </p>
                    </div>

                    <div className="flex p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <button
                            onClick={() => setActiveTab("questions")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "questions"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                }`}
                        >
                            <Layers className="w-4 h-4" /> Questions
                        </button>
                        <button
                            onClick={() => setActiveTab("upload")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "upload"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                }`}
                        >
                            <UploadCloud className="w-4 h-4" /> Import
                        </button>
                        <button
                            onClick={() => setActiveTab("analytics")}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "analytics"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-slate-700"
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                }`}
                        >
                            <BarChart3 className="w-4 h-4" /> Analytics
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-sky-600 dark:text-sky-400 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400">Loading data...</p>
                    </div>
                ) : (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        {activeTab === "questions" && (
                            <QuestionBank
                                questions={questions}
                                onRefresh={loadQuestions}
                            />
                        )}
                        {activeTab === "upload" && (
                            <UploadWizard
                                onCancel={() => setActiveTab("questions")}
                                onSuccess={() => {
                                    loadQuestions();
                                    setActiveTab("questions");
                                }}
                            />
                        )}
                        {activeTab === "analytics" && (
                            <TeacherAnalytics questions={questions} />
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}