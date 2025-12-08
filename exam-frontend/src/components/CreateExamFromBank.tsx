import { useEffect, useState } from "react";
import api from "../lib/api";
import {
    ArrowLeft,
    CheckCircle,
    AlertCircle,
    BarChart3,
    BookOpen,
    Calculator,
    Calendar
} from "lucide-react";

type SubjectSummary = {
    subject: string;
    count: number;
};

type Props = {
    onBack: () => void;
    onComplete: () => void;
};

export function CreateExamFromBank({ onBack, onComplete }: Props) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [subjects, setSubjects] = useState<SubjectSummary[]>([]);

    // Form State
    const [selectedSubject, setSelectedSubject] = useState("");
    const [totalQuestions, setTotalQuestions] = useState(10);

    // Distribution (Percentage)
    const [easyPct, setEasyPct] = useState(40);
    const [mediumPct, setMediumPct] = useState(40);
    const [hardPct, setHardPct] = useState(20);

    // Points Config
    const [pointsEasy, setPointsEasy] = useState(1);
    const [pointsMedium, setPointsMedium] = useState(2);
    const [pointsHard, setPointsHard] = useState(5);

    // Exam Details
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState(60);
    const [passingScore, setPassingScore] = useState(40);
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");

    // Validation State
    const [previewData, setPreviewData] = useState<any>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        loadSubjects();
    }, []);

    async function loadSubjects() {
        try {
            const res = await api.get("/admin/bank/subjects");
            setSubjects(res.data);
        } catch (err) {
            console.error("Failed to load subjects", err);
        }
    }

    // Ensure percentages add up to 100
    const totalPct = easyPct + mediumPct + hardPct;
    const isValidPct = totalPct === 100;

    async function checkAvailability() {
        if (!selectedSubject) return;
        setLoading(true);
        setError("");
        setPreviewData(null);

        try {
            const payload = {
                subject: selectedSubject,
                topics: [], // Empty means all topics
                total_questions: Number(totalQuestions),
                difficulty: {
                    easy: easyPct,
                    medium: mediumPct,
                    hard: hardPct
                }
            };

            const res = await api.post("/admin/exams/preview", payload);
            if (res.data.possible) {
                setPreviewData(res.data);
                setStep(2); // Move to next step if valid
            } else {
                setError(res.data.error || "Configuration not possible with current bank.");
            }
        } catch (err: any) {
            setError(err.response?.data?.error || "Server error validating request");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!title || !startDate || !startTime) {
            alert("Please fill in all exam details");
            return;
        }

        setLoading(true);
        try {
            const start_iso = `${startDate}T${startTime}:00+05:30`;

            const payload = {
                subject: selectedSubject,
                topics: [],
                total_questions: Number(totalQuestions),
                difficulty: {
                    easy: easyPct,
                    medium: mediumPct,
                    hard: hardPct
                },
                points_config: {
                    easy: Number(pointsEasy),
                    medium: Number(pointsMedium),
                    hard: Number(pointsHard)
                },
                title,
                description,
                duration_minutes: Number(duration),
                passing_score: Number(passingScore),
                start_time: start_iso,
            };

            await api.post("/admin/exams/from-bank", payload);
            alert("Exam created successfully!");
            onComplete();
        } catch (err) {
            console.error(err);
            alert("Failed to create exam");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">

                {/* Header */}
                <div className="bg-blue-600 p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="hover:bg-blue-700 p-2 rounded-lg">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-xl font-bold">Exam Generator</h1>
                    </div>
                    <div className="text-sm font-medium bg-blue-700 px-3 py-1 rounded-full">
                        Step {step} of 2
                    </div>
                </div>

                {/* STEP 1: Configuration */}
                {step === 1 && (
                    <div className="p-8 space-y-8">
                        {/* Subject Selection */}
                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                                <BookOpen className="w-5 h-5 text-blue-600" />
                                1. Select Subject
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {subjects.map((s) => (
                                    <button
                                        key={s.subject}
                                        onClick={() => setSelectedSubject(s.subject)}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${selectedSubject === s.subject
                                            ? "border-blue-600 bg-blue-50 text-blue-700"
                                            : "border-gray-200 hover:border-blue-300"
                                            }`}
                                    >
                                        <div className="font-bold">{s.subject}</div>
                                        <div className="text-xs text-gray-500">{s.count} questions available</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <hr />

                        {/* Question Distribution */}
                        <div className="grid md:grid-cols-2 gap-12">
                            <div className="space-y-6">
                                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                                    <BarChart3 className="w-5 h-5 text-blue-600" />
                                    2. Composition
                                </h2>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Total Questions
                                    </label>
                                    <input
                                        type="number"
                                        value={totalQuestions}
                                        onChange={(e) => setTotalQuestions(Number(e.target.value))}
                                        className="w-full border rounded-lg p-2"
                                    />
                                </div>

                                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                                    <p className="text-sm font-medium text-gray-700">Difficulty Split (%)</p>

                                    <div className="flex items-center gap-4">
                                        <label className="w-16 text-xs font-bold text-green-600 uppercase">Easy</label>
                                        <input
                                            type="range" min="0" max="100"
                                            value={easyPct} onChange={(e) => setEasyPct(Number(e.target.value))}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-right text-sm">{easyPct}%</span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="w-16 text-xs font-bold text-yellow-600 uppercase">Medium</label>
                                        <input
                                            type="range" min="0" max="100"
                                            value={mediumPct} onChange={(e) => setMediumPct(Number(e.target.value))}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-right text-sm">{mediumPct}%</span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <label className="w-16 text-xs font-bold text-red-600 uppercase">Hard</label>
                                        <input
                                            type="range" min="0" max="100"
                                            value={hardPct} onChange={(e) => setHardPct(Number(e.target.value))}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-right text-sm">{hardPct}%</span>
                                    </div>

                                    <div className={`text-right text-xs font-bold ${isValidPct ? 'text-green-600' : 'text-red-600'}`}>
                                        Total: {totalPct}%
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                                    <Calculator className="w-5 h-5 text-blue-600" />
                                    3. Grading (Points per Q)
                                </h2>

                                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-gray-700">Easy Question</label>
                                        <input
                                            type="number" className="w-20 border rounded p-1 text-center"
                                            value={pointsEasy} onChange={e => setPointsEasy(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-gray-700">Medium Question</label>
                                        <input
                                            type="number" className="w-20 border rounded p-1 text-center"
                                            value={pointsMedium} onChange={e => setPointsMedium(Number(e.target.value))}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-gray-700">Hard Question</label>
                                        <input
                                            type="number" className="w-20 border rounded p-1 text-center"
                                            value={pointsHard} onChange={e => setPointsHard(Number(e.target.value))}
                                        />
                                    </div>

                                    <div className="border-t pt-3 mt-3 flex justify-between font-bold text-gray-900">
                                        <span>Total Exam Marks:</span>
                                        <span>
                                            {Math.round((totalQuestions * easyPct / 100) * pointsEasy +
                                                (totalQuestions * mediumPct / 100) * pointsMedium +
                                                (totalQuestions * hardPct / 100) * pointsHard)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Error Banner */}
                        {error && (
                            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
                                <AlertCircle className="w-5 h-5" />
                                {error}
                            </div>
                        )}

                        {/* Next Button */}
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={checkAvailability}
                                disabled={!selectedSubject || !isValidPct || loading}
                                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                            >
                                {loading ? "Checking Bank..." : "Verify & Continue"}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Exam Details */}
                {step === 2 && previewData && (
                    <div className="p-8 space-y-8">
                        <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-green-600" />
                            <div>
                                <h3 className="font-bold text-green-800">Success! Questions Available.</h3>
                                <p className="text-sm text-green-700">
                                    We found enough questions in the bank to generate this exam.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
                                <Calendar className="w-5 h-5 text-blue-600" />
                                4. Exam Details
                            </h2>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Exam Title</label>
                                    <input
                                        className="w-full border p-2 rounded-lg"
                                        value={title} onChange={e => setTitle(e.target.value)}
                                        placeholder="e.g. Mid-Term Physics Assessment"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                                    <textarea
                                        className="w-full border p-2 rounded-lg" rows={2}
                                        value={description} onChange={e => setDescription(e.target.value)}
                                        placeholder="Instructions for students..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                    <input
                                        type="date" className="w-full border p-2 rounded-lg"
                                        value={startDate} onChange={e => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Time</label>
                                    <input
                                        type="time" className="w-full border p-2 rounded-lg"
                                        value={startTime} onChange={e => setStartTime(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Duration (Mins)</label>
                                    <input
                                        type="number" className="w-full border p-2 rounded-lg"
                                        value={duration} onChange={e => setDuration(Number(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Passing %</label>
                                    <input
                                        type="number" className="w-full border p-2 rounded-lg"
                                        value={passingScore} onChange={e => setPassingScore(Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-between pt-6 border-t">
                            <button
                                onClick={() => setStep(1)}
                                className="text-gray-600 font-semibold hover:text-gray-800"
                            >
                                Back to Configuration
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={loading}
                                className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-600/20"
                            >
                                {loading ? "Generating..." : "GENERATE EXAM"}
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}