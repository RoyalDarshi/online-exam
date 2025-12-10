import React from 'react';
import {
    X,
    CheckCircle2,
    AlertTriangle,
    Flag,
    ListFilter,
    Check,
    Circle,
    Clock,
    ShieldAlert,
    ArrowRight,
} from 'lucide-react';
import { Question } from '../types/models'; // Assuming Question type is correctly imported/defined

type ModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    questions: Question[];
    answers: Record<string, string>;
    markedForReview: Set<string>;
    visited: Set<string>;
    timeLeft: number;
    warnings: number;
    MAX_WARNINGS: number;
    onQuestionJump: (index: number) => void;
};

// Helper function (can be extracted to ExamTaking or a utility)
const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const ReviewAndSubmitModal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    questions,
    answers,
    markedForReview,
    visited,
    timeLeft,
    warnings,
    MAX_WARNINGS,
    onQuestionJump,
}) => {
    if (!isOpen) return null;

    const totalQuestions = questions.length;
    const answeredCount = Object.keys(answers).filter(qId => answers[qId]).length;
    const markedCount = markedForReview.size;
    const unansweredCount = totalQuestions - answeredCount;
    const skippedCount = questions.filter(q => visited.has(q.id) && !answers[q.id] && !markedForReview.has(q.id)).length;
    const unseenCount = totalQuestions - visited.size;

    const isComplete = unansweredCount === 0;

    // Function to get the status text/icon for a question in the palette
    const getQuestionStatus = (q: Question, index: number) => {
        const isAnswered = !!answers[q.id];
        const isMarked = markedForReview.has(q.id);
        const isVisited = visited.has(q.id);

        let status: { icon: React.ReactNode, text: string, color: string };

        if (isAnswered && isMarked) {
            status = { icon: <CheckCircle2 className="w-3 h-3 fill-white text-purple-500" />, text: 'Answered & Marked', color: 'bg-purple-500/10 text-purple-700' };
        } else if (isAnswered) {
            status = { icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" />, text: 'Answered', color: 'bg-emerald-500/10 text-emerald-700' };
        } else if (isMarked) {
            status = { icon: <Flag className="w-3 h-3 fill-purple-500 text-purple-500" />, text: 'Marked for Review', color: 'bg-purple-500/10 text-purple-700' };
        } else if (isVisited) {
            status = { icon: <ArrowRight className="w-3 h-3 text-amber-500" />, text: 'Skipped', color: 'bg-amber-500/10 text-amber-700' };
        } else {
            status = { icon: <Circle className="w-3 h-3 text-slate-400" />, text: 'Unseen', color: 'bg-slate-100 text-slate-600' };
        }

        return (
            <button
                key={q.id}
                onClick={() => { onQuestionJump(index); onClose(); }}
                className={`flex items-center gap-2 p-2 rounded-lg text-sm font-medium transition-colors hover:bg-slate-100 ${status.color}`}
            >
                <div className="w-4 h-4 flex items-center justify-center shrink-0">{status.icon}</div>
                <span className="truncate">Q. {index + 1}</span>
                <span className="text-xs font-semibold uppercase opacity-70 ml-auto hidden sm:inline-block">{status.text}</span>
            </button>
        );
    };


    return (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300">

                {/* Modal Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-blue-600" />
                        Final Review & Submission
                    </h2>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-full transition hover:bg-slate-100">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">

                    {/* Summary Panel */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 bg-blue-50/70 p-4 rounded-xl border border-blue-100 shadow-inner">
                        <SummaryStat label="Total" value={totalQuestions} icon={<ListFilter className="w-5 h-5 text-blue-600" />} />
                        <SummaryStat label="Answered" value={answeredCount} icon={<Check className="w-5 h-5 text-emerald-600" />} />
                        <SummaryStat label="Unanswered" value={unansweredCount} icon={<X className="w-5 h-5 text-rose-600" />} />
                        <SummaryStat label="Marked" value={markedCount} icon={<Flag className="w-5 h-5 text-purple-600" />} />
                        <SummaryStat label="Time Left" value={formatTime(timeLeft)} icon={<Clock className="w-5 h-5 text-slate-600" />} />
                    </div>

                    {/* Alerts */}
                    {(unansweredCount > 0 || warnings > 0) && (
                        <div className="p-4 bg-amber-50 border-l-4 border-amber-400 text-amber-800 rounded-lg flex items-start gap-4 shadow-sm">
                            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
                            <div className="space-y-1 text-sm font-medium">
                                <p className="font-bold">Heads Up!</p>
                                {unansweredCount > 0 && <p>- You have **{unansweredCount}** unanswered questions.</p>}
                                {warnings > 0 && <p>- You have **{warnings}**/{MAX_WARNINGS} system warnings logged.</p>}
                                <p>You can go back to review your answers.</p>
                            </div>
                        </div>
                    )}
                    {warnings >= MAX_WARNINGS - 1 && (
                        <div className="p-4 bg-rose-50 border-l-4 border-rose-400 text-rose-800 rounded-lg flex items-start gap-4 shadow-sm">
                            <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0" />
                            <div className="space-y-1 text-sm font-medium">
                                <p className="font-bold">Critical Warning!</p>
                                <p>You are approaching the **maximum allowed system violations**. Submission is strongly recommended.</p>
                            </div>
                        </div>
                    )}

                    {/* Question Palette for Jump */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-slate-700 border-b pb-2">Review Question Status ({questions.length})</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                            {questions.map((q, index) => getQuestionStatus(q, index))}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-slate-50 border-t border-gray-100 flex justify-end gap-3 shrink-0 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition"
                    >
                        Go Back to Exam
                    </button>
                    <button
                        onClick={onSubmit}
                        className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/10 flex items-center gap-2 active:scale-95"
                    >
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Confirm & Submit Exam
                    </button>
                </div>
            </div>
        </div>
    );
};

// Simple stateless component for summary stats
const SummaryStat: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex items-center gap-3 p-2 bg-white/70 rounded-lg shadow-sm">
        <div className="p-2 bg-white rounded-full border border-gray-100 shadow-sm">{icon}</div>
        <div>
            <p className="text-xs font-medium text-slate-500 uppercase">{label}</p>
            <p className="text-lg font-bold text-slate-800 leading-none mt-0.5">{value}</p>
        </div>
    </div>
);

export default ReviewAndSubmitModal;