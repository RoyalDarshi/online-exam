import React, { useEffect, useState } from 'react';
import { Exam } from '../lib/supabase';
import { ArrowLeft, Clock, CheckCircle, CalendarDays, AlertTriangle, PlayCircle } from 'lucide-react';

type Props = {
    exam: Exam;
    onBack: () => void;
    onStart: () => void; // when user clicks "Start Exam"
};

export function ExamPreview({ exam, onBack, onStart }: Props) {
    const [now, setNow] = useState(Date.now());

    // Keep ticking every second
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const startTime = exam.start_time ? new Date(exam.start_time).getTime() : null;
    const hasStartTime = !!startTime;
    const diffMs = hasStartTime ? startTime! - now : 0;

    const canStart = !hasStartTime || diffMs <= 0;

    const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const formattedStart = exam.start_time
        ? new Date(exam.start_time).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        })
        : 'Not scheduled';

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 py-8">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-white/80 hover:text-white text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Exams
                    </button>
                    <span className="text-xs font-semibold bg-white/15 px-3 py-1 rounded-full text-white">
                        Online Proctored Exam
                    </span>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Title & description */}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">{exam.title}</h1>
                        <p className="text-gray-600 text-sm">{exam.description}</p>
                    </div>

                    {/* Exam info cards */}
                    <div className="grid sm:grid-cols-3 gap-4 text-sm">
                        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-semibold">Duration</p>
                                <p className="font-semibold text-gray-900">
                                    {exam.duration_minutes} mins
                                </p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-semibold">Passing Score</p>
                                <p className="font-semibold text-gray-900">{exam.passing_score}%</p>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                                <CalendarDays className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase font-semibold">Start Time (IST)</p>
                                <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                                    {formattedStart}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Countdown + rules */}
                    {hasStartTime && (
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-1">
                                    <AlertTriangle className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-blue-900">
                                        {canStart ? 'Exam window is open' : 'Exam will start soon'}
                                    </p>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Your answers are auto-saved and time is validated on the server. Make sure
                                        you have a stable internet connection.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center min-w-[140px]">
                                {!canStart && (
                                    <>
                                        <p className="text-[11px] uppercase tracking-wide text-blue-500 font-semibold">
                                            Starts in
                                        </p>
                                        <div className="mt-1 flex gap-1 text-sm font-mono">
                                            <span className="px-2 py-1 rounded-md bg-white border text-blue-900">
                                                {String(hours).padStart(2, '0')}
                                            </span>
                                            :
                                            <span className="px-2 py-1 rounded-md bg-white border text-blue-900">
                                                {String(minutes).padStart(2, '0')}
                                            </span>
                                            :
                                            <span className="px-2 py-1 rounded-md bg-white border text-blue-900">
                                                {String(seconds).padStart(2, '0')}
                                            </span>
                                        </div>
                                    </>
                                )}

                                {canStart && (
                                    <span className="text-xs font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full mt-1">
                                        You can start now
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Rules */}
                    <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                        <p className="font-semibold text-gray-800 mb-1">Before you start:</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Keep your camera on; your activity may be monitored.</li>
                            <li>Do not switch tabs or windows during the exam.</li>
                            <li>Ensure stable internet; timer continues even if you disconnect.</li>
                            <li>Once submitted, you cannot change your answers.</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                        <button
                            onClick={onBack}
                            className="text-sm text-gray-500 hover:text-gray-800"
                        >
                            Go back
                        </button>

                        <button
                            disabled={!canStart}
                            onClick={onStart}
                            className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition 
                ${canStart
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <PlayCircle className="w-5 h-5" />
                            {canStart ? 'Start Exam' : 'Wait for Start Time'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
