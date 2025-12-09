// src/components/StudentAttemptHistory.tsx

import { useEffect, useState } from "react";
import api from "../lib/api";
import { ExamAttempt } from "../types/models";
import { ChevronLeft, Eye } from "lucide-react";

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

    const getPercentage = (a: ExamAttempt) => {
        if (!a.total_points) return 0;
        return Math.round((a.score / a.total_points) * 100);
    };

    const getResultBadge = (a: ExamAttempt) => {
        if (a.is_terminated)
            return (
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 border border-orange-300">
                    TERMINATED
                </span>
            );

        if (a.passed)
            return (
                <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 border border-green-300">
                    PASSED
                </span>
            );

        return (
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-300">
                FAILED
            </span>
        );
    };

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-gray-500">Loading history...</p>
            </div>
        );

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            {/* Header */}
            <div className="max-w-5xl mx-auto mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-blue-600 font-semibold mb-4"
                >
                    <ChevronLeft className="w-5 h-5" /> Back
                </button>

                <h1 className="text-2xl font-bold text-gray-800 mb-1">Exam History</h1>
                <p className="text-gray-600">Your past exam attempts are listed below.</p>
            </div>

            {/* Attempts List */}
            <div className="max-w-5xl mx-auto grid gap-6">
                {attempts.map((attempt) => {
                    const percent = getPercentage(attempt);

                    return (
                        <div
                            key={attempt.id}
                            className="bg-white p-6 rounded-xl shadow border border-gray-200"
                        >
                            {/* Top Row */}
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{attempt.exam.title}</h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Attempted: {new Date(attempt.started_at).toLocaleString()}
                                    </p>
                                </div>

                                {getResultBadge(attempt)}
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center mb-4">
                                <div className="p-3 rounded-lg bg-blue-50">
                                    <p className="text-sm text-blue-700 font-semibold">Score</p>
                                    <p className="text-lg font-bold text-blue-800">{attempt.score}</p>
                                </div>

                                <div className="p-3 rounded-lg bg-cyan-50">
                                    <p className="text-sm text-cyan-700 font-semibold">Percent</p>
                                    <p className="text-lg font-bold text-cyan-800">{percent}%</p>
                                </div>

                                <div className="p-3 rounded-lg bg-purple-50">
                                    <p className="text-sm text-purple-700 font-semibold">Total Marks</p>
                                    <p className="text-lg font-bold text-purple-800">{attempt.total_points}</p>
                                </div>

                                <div className="p-3 rounded-lg bg-gray-100">
                                    <p className="text-sm text-gray-700 font-semibold">Pass %</p>
                                    <p className="text-lg font-bold text-gray-800">{attempt.exam.passing_score}%</p>
                                </div>

                                <div className="p-3 rounded-lg bg-yellow-50">
                                    <p className="text-sm text-yellow-700 font-semibold">Status</p>
                                    <p className="text-lg font-bold text-yellow-800">
                                        {attempt.passed ? "Passed" : "Failed"}
                                    </p>
                                </div>

                                <div className="p-3 rounded-lg bg-red-50">
                                    <p className="text-sm text-red-700 font-semibold">Cheating?</p>
                                    <p className="text-lg font-bold text-red-800">
                                        {attempt.is_terminated ? "Yes" : "No"}
                                    </p>
                                </div>
                            </div>

                            {/* Review Button */}
                            <div className="text-right">
                                <button
                                    onClick={async () => {
                                        const res = await api.get(`/attempts/${attempt.id}`);
                                        onOpenReview?.(res.data);
                                    }}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition mx-auto md:ml-auto"
                                >
                                    <Eye className="w-4 h-4" />
                                    View Review
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
