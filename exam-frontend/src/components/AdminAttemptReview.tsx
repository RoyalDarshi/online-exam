import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { ExamAttempt, Exam, Profile } from '../lib/supabase'; // Reuse your types
import { ArrowLeft, AlertTriangle, User, Calendar, Camera, Ban, CheckCircle, XCircle } from 'lucide-react';

// Extend types to include the new evidence fields
type ExtendedAttempt = ExamAttempt & {
    student: Profile;
    exam: Exam;
    snapshots: string[]; // Array of base64 strings
    is_terminated: boolean;
    termination_reason: string;
};

type Props = {
    attemptId: string;
    onBack: () => void;
};

export function AdminAttemptReview({ attemptId, onBack }: Props) {
    const [attempt, setAttempt] = useState<ExtendedAttempt | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEvidence();
    }, [attemptId]);

    async function loadEvidence() {
        try {
            const res = await api.get(`/admin/attempts/${attemptId}`);
            setAttempt(res.data);
        } catch (error) {
            alert("Failed to load evidence.");
        } finally {
            setLoading(false);
        }
    }

    if (loading || !attempt) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-12">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition">
                            <ArrowLeft className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Evidence Review</h1>
                            <p className="text-sm text-gray-500">Attempt ID: {attempt.id}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {attempt.passed ? (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" /> PASSED
                            </span>
                        ) : (
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1">
                                <XCircle className="w-4 h-4" /> FAILED
                            </span>
                        )}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">

                {/* 1. Student & Score Card */}
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-gray-500 text-sm font-semibold uppercase mb-4 flex items-center gap-2">
                            <User className="w-4 h-4" /> Student Details
                        </h3>
                        <p className="text-lg font-bold">{attempt.student.full_name}</p>
                        <p className="text-gray-600">{attempt.student.email}</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-gray-500 text-sm font-semibold uppercase mb-4 flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Time & Date
                        </h3>
                        <p className="text-lg font-bold">
                            {new Date(attempt.started_at).toLocaleDateString()}
                        </p>
                        <p className="text-gray-600">
                            {new Date(attempt.started_at).toLocaleTimeString()}
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="text-gray-500 text-sm font-semibold uppercase mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Proctoring Status
                        </h3>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span>Score:</span>
                                <span className="font-bold">{attempt.score}/{attempt.total_points}</span>
                            </div>
                            <div className="flex justify-between text-red-600 font-medium">
                                <span>Violations:</span>
                                <span>{attempt.tab_switches}</span>
                            </div>
                            {attempt.is_terminated && (
                                <div className="bg-red-50 text-red-700 text-xs p-2 rounded mt-2 border border-red-100 flex items-start gap-2">
                                    <Ban className="w-4 h-4 flex-shrink-0" />
                                    <span>TERMINATED: {attempt.termination_reason}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Evidence Locker (Snapshots) */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-gray-600" />
                        <h2 className="font-bold text-gray-800">Snapshot Evidence Gallery</h2>
                    </div>

                    <div className="p-6">
                        {!attempt.snapshots || attempt.snapshots.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                No snapshots were captured during this session.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {attempt.snapshots.map((snap, i) => (
                                    <div key={i} className="group relative aspect-video bg-black rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:scale-105 transition-transform">
                                        <img
                                            src={snap}
                                            alt={`Evidence ${i + 1}`}
                                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100"
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                                            Capture #{i + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Detailed Logs (Optional JSON Dump) */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h2 className="font-bold text-gray-800">Raw Answer Data</h2>
                    </div>
                    <div className="p-6 bg-gray-50 font-mono text-xs overflow-auto max-h-64">
                        <pre>{JSON.stringify(attempt.answers, null, 2)}</pre>
                    </div>
                </div>

            </main>
        </div>
    );
}