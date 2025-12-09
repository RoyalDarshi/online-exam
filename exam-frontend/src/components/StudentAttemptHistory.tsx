// src/components/StudentAttemptHistory.tsx

import { useState, useEffect } from 'react';
import api from '../lib/api';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Award, Eye } from 'lucide-react';

// Assuming you've created src/types/models.ts
import { AttemptHistory } from '../types/models';

type Props = {
    onBack: () => void;
};

export function StudentAttemptHistory({ onBack }: Props) {
    const [attempts, setAttempts] = useState<AttemptHistory[]>([]);
    const [loading, setLoading] = useState(true);

    // Review feature (e.g., showing a detailed answer sheet, but for now we just track state)
    const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    async function loadHistory() {
        try {
            // New API endpoint for students to view their history
            const res = await api.get('/student/attempts');
            setAttempts(res.data || []);
        } catch (err) {
            console.error('Error loading history:', err);
        } finally {
            setLoading(false);
        }
    }

    // In a real application, you would create a StudentAttemptReview component 
    // similar to AdminAttemptReview to show the questions, answers, and corrections.
    if (reviewAttemptId) {
        return (
            <div className="min-h-screen bg-gray-100 p-8">
                <button
                    onClick={() => setReviewAttemptId(null)}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
                >
                    <ArrowLeft className="w-5 h-5" /> Back to History
                </button>
                <h2 className='text-3xl font-bold text-gray-800 mb-6'>
                    Review Attempt: {attempts.find(a => a.id === reviewAttemptId)?.exam.title}
                </h2>
                <div className='bg-white p-8 rounded-xl shadow-lg'>
                    <p className='text-lg text-gray-600'>
                        *Review feature coming soon!* This is where a detailed view of your submitted answers and the correct answers would be displayed.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <button
                onClick={onBack}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
            >
                <ArrowLeft className="w-5 h-5" /> Back to Available Exams
            </button>

            <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <Award className='w-8 h-8 text-yellow-600' /> Exam History & Results
            </h2>

            {loading && <Loader2 className='w-6 h-6 animate-spin text-blue-600 mx-auto' />}

            {!loading && attempts.length === 0 && (
                <div className="bg-white p-6 rounded-lg shadow-md text-center">
                    <p className="text-lg text-gray-500">You have no recorded exam attempts.</p>
                </div>
            )}

            {!loading && attempts.length > 0 && (
                <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exam Title</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted On</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Warnings</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {attempts.map(attempt => {
                                const submittedDate = attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : 'N/A';
                                const scoreColor = attempt.passed ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50';

                                return (
                                    <tr key={attempt.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{attempt.exam.title}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {attempt.is_terminated ? (
                                                <span className='text-red-500 font-semibold'>Terminated ({attempt.termination_reason})</span>
                                            ) : (
                                                submittedDate
                                            )}
                                        </td>
                                        <td className={`px-6 py-4 whitespace-nowrap text-center text-sm font-bold ${scoreColor}`}>
                                            {attempt.score} / {attempt.total_points}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                            {attempt.passed ? (
                                                <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800'>
                                                    <CheckCircle className='w-4 h-4 mr-1' /> PASSED
                                                </span>
                                            ) : (
                                                <span className='inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800'>
                                                    <XCircle className='w-4 h-4 mr-1' /> FAILED
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                                            <span className={`${attempt.tab_switches > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                {attempt.tab_switches}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                            <button
                                                onClick={() => setReviewAttemptId(attempt.id)}
                                                className="flex items-center gap-2 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition mx-auto"
                                            >
                                                <Eye className="w-4 h-4" />
                                                Review
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}