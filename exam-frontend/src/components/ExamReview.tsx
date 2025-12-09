import React, { useState } from "react";
import { Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Question, ExamAttempt, Exam } from "../types/models";

type Props = {
    attempt: ExamAttempt;
    onBack: () => void;
};

export default function ExamReview({ attempt, onBack }: Props) {
    const questions = attempt.exam.questions;
    const answers = attempt.answers || {};
    const [index, setIndex] = useState(0);

    const current = questions[index];

    const sortAnswer = (ans: string) => {
        if (!ans) return "";
        return ans
            .split(",")
            .map((s) => s.trim())
            .sort()
            .join(",");
    };

    const correct = sortAnswer(current.correct_answer);
    const user = sortAnswer(answers[current.id] || "");

    const isCorrect = correct === user;

    const getOptionState = (opt: string) => {
        const isCorrectOption = correct.split(",").includes(opt);
        const isUserSelected = user.split(",").includes(opt);

        if (isCorrectOption && isUserSelected)
            return "border-green-600 bg-green-50 ring-1 ring-green-300";

        if (isCorrectOption && !isUserSelected)
            return "border-blue-600 bg-blue-50 ring-1 ring-blue-300";

        if (!isCorrectOption && isUserSelected)
            return "border-red-600 bg-red-50 ring-1 ring-red-300";

        return "border-gray-200 bg-white";
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            {/* HEADER */}
            <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow">
                <button
                    onClick={onBack}
                    className="mb-4 text-blue-600 underline font-medium"
                >
                    ← Back to Results
                </button>

                <h1 className="text-2xl font-bold text-gray-800 mb-4">
                    Exam Review: {attempt.exam.title}
                </h1>

                {/* SUMMARY */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-blue-100 rounded-xl text-center">
                        <p className="text-sm text-blue-700 font-semibold">Score</p>
                        <p className="text-2xl font-bold text-blue-800">{attempt.score}</p>
                    </div>

                    <div className="p-4 bg-green-100 rounded-xl text-center">
                        <p className="text-sm text-green-700 font-semibold">Correct</p>
                        <p className="text-2xl font-bold text-green-800">
                            {
                                questions.filter((q) => {
                                    const c = sortAnswer(q.correct_answer);
                                    const u = sortAnswer(answers[q.id] || "");
                                    return c === u;
                                }).length
                            }
                        </p>
                    </div>

                    <div className="p-4 bg-red-100 rounded-xl text-center">
                        <p className="text-sm text-red-700 font-semibold">Wrong</p>
                        <p className="text-2xl font-bold text-red-800">
                            {
                                questions.filter((q) => {
                                    const c = sortAnswer(q.correct_answer);
                                    const u = sortAnswer(answers[q.id] || "");
                                    return u && u !== c;
                                }).length
                            }
                        </p>
                    </div>
                </div>

                {/* QUESTION REVIEW */}
                <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-600">
                        Question {index + 1} / {questions.length}
                    </p>

                    {isCorrect ? (
                        <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700 border border-green-300">
                            Correct
                        </span>
                    ) : (
                        <span className="px-3 py-1 rounded-full text-xs bg-red-100 text-red-700 border border-red-300">
                            Wrong
                        </span>
                    )}
                </div>

                <p className="text-lg font-medium text-gray-900 mb-6">
                    {current.question_text}
                </p>

                {/* OPTIONS */}
                <div className="grid gap-4 mb-6">
                    {["A", "B", "C", "D"].map((opt) => (
                        <div
                            key={opt}
                            className={`p-4 rounded-xl border-2 ${getOptionState(opt)} flex items-center gap-4`}
                        >
                            <span className="font-bold">{opt}.</span>
                            <span className="text-gray-800">
                                {current[`option_${opt.toLowerCase()}`]}
                            </span>
                        </div>
                    ))}
                </div>

                {/* ANSWER SUMMARY */}
                <div className="p-4 bg-gray-50 rounded-xl border">
                    <p className="text-sm font-semibold text-gray-700">
                        Your Answer:
                        <span className="text-blue-700 ml-2">
                            {answers[current.id] || "Not Attempted"}
                        </span>
                    </p>
                    <p className="text-sm font-semibold text-gray-700 mt-2">
                        Correct Answer:
                        <span className="text-green-700 ml-2">
                            {current.correct_answer}
                        </span>
                    </p>
                </div>

                {/* NAVIGATION */}
                <div className="flex justify-between mt-8">
                    <button
                        disabled={index === 0}
                        onClick={() => setIndex(index - 1)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50 hover:bg-gray-300"
                    >
                        <ChevronLeft className="w-5 h-5" /> Previous
                    </button>

                    <button
                        disabled={index === questions.length - 1}
                        onClick={() => setIndex(index + 1)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400 hover:bg-blue-700"
                    >
                        Next <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
