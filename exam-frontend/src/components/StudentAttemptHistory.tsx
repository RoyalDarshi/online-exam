// src/components/StudentAttemptHistory.tsx
import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { ExamAttempt } from "../types/models";
import { Loader2 } from "lucide-react";
import { HistoryHeader } from "./student/history/HistoryHeader";
import { AttemptCard } from "./student/history/AttemptCard";

type Props = {
    onBack: () => void;
    onOpenReview?: (attempt: ExamAttempt) => void;
};

export function StudentAttemptHistory({ onBack, onOpenReview }: Props) {
    const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHistory();
    }, []);

    async function loadHistory() {
        try {
            const res = await api.get("/student/attempts");
            setAttempts(res.data || []);
        } catch (err) {
            console.error("Failed to load attempt history", err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50">
            <HistoryHeader onBack={onBack} />

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {attempts.length === 0 ? (
                    <div className="mt-10 text-center text-sm text-slate-400">
                        You haven't completed any exams yet.
                    </div>
                ) : (
                    <div className="grid gap-5">
                        {attempts.map((attempt) => (
                            <AttemptCard
                                key={attempt.id}
                                attempt={attempt}
                                onOpenReview={onOpenReview}
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
