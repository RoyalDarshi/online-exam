import React, { useEffect, useState } from "react";
import api from "../lib/api";
import {
    ArrowLeft, CheckCircle, AlertCircle, BookOpen, Target, Settings2,
    Calendar, ChevronRight, Calculator, AlertTriangle, RefreshCw, Save,
    Percent, Hash
} from "lucide-react";

type Props = {
    examId: string;
    onBack: () => void;
};

export function EditExam({ examId, onBack }: Props) {
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [subjects, setSubjects] = useState<any[]>([]);

    // --- State ---
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [duration, setDuration] = useState(60);
    const [passScore, setPassScore] = useState(40);
    const [isActive, setIsActive] = useState(true);

    // --- Generator State ---
    const [selectedSubject, setSelectedSubject] = useState("");
    const [totalQuestions, setTotalQuestions] = useState(10);

    // Scoring Config
    const [ptsEasy, setPtsEasy] = useState(1);
    const [ptsMed, setPtsMed] = useState(2);
    const [ptsHard, setPtsHard] = useState(5);

    // Negative Config
    const [enableNeg, setEnableNeg] = useState(false);
    const [negEasy, setNegEasy] = useState(0.25);
    const [negMed, setNegMed] = useState(0.5);
    const [negHard, setNegHard] = useState(1.0);

    // Distribution
    const [cntEasy, setCntEasy] = useState(0);
    const [cntMed, setCntMed] = useState(0);
    const [cntHard, setCntHard] = useState(0);
    const [distMode, setDistMode] = useState<'percent' | 'count'>('percent');

    // Stats
    const [currentQCount, setCurrentQCount] = useState(0); // Existing count from DB

    useEffect(() => {
        Promise.all([loadExam(), loadSubjects()]);
    }, [examId]);

    async function loadExam() {
        try {
            const res = await api.get(`/exams/${examId}`);
            const ex = res.data;
            setTitle(ex.title);
            setDesc(ex.description);
            setDuration(ex.duration_minutes);
            setPassScore(ex.passing_score);
            setIsActive(ex.is_active);
            setEnableNeg(ex.enable_negative_marking);

            if (ex.start_time) {
                const dt = new Date(ex.start_time);
                setDate(dt.toISOString().slice(0, 10));
                setTime(dt.toTimeString().slice(0, 5));
            }
            if (ex.questions) {
                setCurrentQCount(ex.questions.length);
                // Pre-fill total questions based on current count
                setTotalQuestions(ex.questions.length);

                // Initialize distribution roughly (we don't know exact split from DB easily without logic)
                const len = ex.questions.length;
                setCntEasy(Math.floor(len * 0.4));
                setCntMed(Math.floor(len * 0.4));
                setCntHard(len - Math.floor(len * 0.4) * 2);
            }
        } catch (err) { alert("Failed to load exam"); }
        finally { setLoading(false); }
    }

    async function loadSubjects() {
        try {
            const res = await api.get("/admin/bank/subjects");
            setSubjects(res.data);
        } catch (err) { console.error(err); }
    }

    // --- Distribution Logic (Same as Create Wizard) ---
    const currentTotalQs = cntEasy + cntMed + cntHard;
    const currentTotalMarks = (cntEasy * ptsEasy) + (cntMed * ptsMed) + (cntHard * ptsHard);

    const handleDistChange = (type: 'easy' | 'medium' | 'hard', val: number, mode: 'percent' | 'count') => {
        if (mode === 'count') {
            if (type === 'easy') setCntEasy(val);
            if (type === 'medium') setCntMed(val);
            if (type === 'hard') setCntHard(val);
        } else {
            const count = Math.round((totalQuestions * val) / 100);
            if (type === 'easy') setCntEasy(count);
            if (type === 'medium') setCntMed(count);
            if (type === 'hard') setCntHard(count);
        }
    };

    // --- Update Handler ---
    async function handleUpdate() {
        if (!title || !date || !time) return alert("Please check schedule details");
        if (!selectedSubject) return alert("Please select a subject to regenerate questions.");
        if (currentTotalQs !== totalQuestions) return alert(`Distribution (${currentTotalQs}) must match Total Questions (${totalQuestions})`);

        if (!window.confirm("⚠️ Warning: This will DELETE all existing questions in this exam and generate a NEW set based on these settings. Continue?")) {
            return;
        }

        setUpdating(true);
        try {
            const pEasy = Math.round((cntEasy / totalQuestions) * 100);
            const pMed = Math.round((cntMed / totalQuestions) * 100);
            const pHard = 100 - pEasy - pMed;

            const payload = {
                title, description: desc, duration_minutes: duration, passing_score: passScore,
                start_time: `${date}T${time}:00+05:30`,

                // Generator Config
                subject: selectedSubject,
                topics: [],
                total_questions: totalQuestions,
                difficulty: { easy: pEasy, medium: pMed, hard: pHard },
                points_config: { easy: ptsEasy, medium: ptsMed, hard: ptsHard },
                enable_negative_marking: enableNeg,
                negative_config: { easy: negEasy, medium: negMed, hard: negHard },
            };

            await api.put(`/admin/exams/${examId}/regenerate`, payload);
            alert("Exam updated & regenerated successfully!");
            onBack();
        } catch (err: any) {
            alert(err.response?.data?.error || "Update failed");
        } finally {
            setUpdating(false);
        }
    }

    if (loading) return <div className="p-12 text-center text-gray-500">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex justify-center py-8 px-4 font-sans text-gray-800">
            <div className="w-full max-w-6xl bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col">

                {/* Header */}
                <div className="bg-white border-b p-4 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Edit & Regenerate Exam</h1>
                            <p className="text-xs text-gray-500">Updating: {title}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleUpdate}
                        disabled={updating}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
                        {updating ? "Regenerating..." : "Update & Regenerate"}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid lg:grid-cols-12 gap-10">

                        {/* LEFT COLUMN: SETTINGS */}
                        <div className="lg:col-span-5 space-y-8">

                            {/* Schedule */}
                            <section className="bg-white p-5 rounded-xl border shadow-sm">
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex gap-2">
                                    <Calendar className="w-4 h-4" /> Schedule & Meta
                                </h2>
                                <div className="space-y-3">
                                    <div><label className="text-xs font-bold text-gray-500">Title</label><input className="w-full border p-2 rounded" value={title} onChange={e => setTitle(e.target.value)} /></div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-xs font-bold text-gray-500">Date</label><input type="date" className="w-full border p-2 rounded" value={date} onChange={e => setDate(e.target.value)} /></div>
                                        <div><label className="text-xs font-bold text-gray-500">Time</label><input type="time" className="w-full border p-2 rounded" value={time} onChange={e => setTime(e.target.value)} /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="text-xs font-bold text-gray-500">Duration (m)</label><input type="number" className="w-full border p-2 rounded" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
                                        <div><label className="text-xs font-bold text-gray-500">Pass (%)</label><input type="number" className="w-full border p-2 rounded" value={passScore} onChange={e => setPassScore(Number(e.target.value))} /></div>
                                    </div>
                                </div>
                            </section>

                            {/* Scoring Config */}
                            <section className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex gap-2">
                                    <Settings2 className="w-4 h-4" /> Scoring Rules
                                </h2>
                                <div className="space-y-3 text-sm">
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="col-span-1 font-semibold text-green-700">Easy</span>
                                        <input type="number" className="col-span-1 border rounded p-1 text-center" value={ptsEasy} onChange={e => setPtsEasy(Number(e.target.value))} />
                                        <span className="col-span-2 text-xs text-gray-500">pts</span>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="col-span-1 font-semibold text-yellow-700">Medium</span>
                                        <input type="number" className="col-span-1 border rounded p-1 text-center" value={ptsMed} onChange={e => setPtsMed(Number(e.target.value))} />
                                        <span className="col-span-2 text-xs text-gray-500">pts</span>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-2">
                                        <span className="col-span-1 font-semibold text-red-700">Hard</span>
                                        <input type="number" className="col-span-1 border rounded p-1 text-center" value={ptsHard} onChange={e => setPtsHard(Number(e.target.value))} />
                                        <span className="col-span-2 text-xs text-gray-500">pts</span>
                                    </div>
                                </div>
                            </section>

                            {/* Negative Marking */}
                            <section className="bg-red-50 p-5 rounded-xl border border-red-100">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="flex items-center gap-2 text-sm font-bold text-red-800 cursor-pointer">
                                        <input type="checkbox" checked={enableNeg} onChange={e => setEnableNeg(e.target.checked)} className="accent-red-600 w-4 h-4" />
                                        Negative Marking
                                    </label>
                                    <AlertTriangle className="w-4 h-4 text-red-300" />
                                </div>
                                {enableNeg && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <div><label className="text-[10px] font-bold text-red-700">Easy</label><input type="number" step="0.25" className="w-full border p-1 rounded text-center text-sm" value={negEasy} onChange={e => setNegEasy(Number(e.target.value))} /></div>
                                        <div><label className="text-[10px] font-bold text-red-700">Med</label><input type="number" step="0.25" className="w-full border p-1 rounded text-center text-sm" value={negMed} onChange={e => setNegMed(Number(e.target.value))} /></div>
                                        <div><label className="text-[10px] font-bold text-red-700">Hard</label><input type="number" step="0.25" className="w-full border p-1 rounded text-center text-sm" value={negHard} onChange={e => setNegHard(Number(e.target.value))} /></div>
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* RIGHT COLUMN: GENERATOR */}
                        <div className="lg:col-span-7 space-y-6">

                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3">
                                <AlertCircle className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
                                <div>
                                    <h3 className="font-bold text-blue-800">Regeneration Mode</h3>
                                    <p className="text-sm text-blue-700">
                                        This exam currently has <b>{currentQCount}</b> questions.
                                        Configure the settings below to <b>replace</b> them with a new set from the bank.
                                    </p>
                                </div>
                            </div>

                            <section className="bg-white p-6 rounded-xl border shadow-sm">
                                <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-blue-600" /> Question Generator
                                </h2>

                                {/* Subject & Total */}
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Subject</label>
                                        <select
                                            className="w-full p-2.5 border rounded-lg bg-gray-50"
                                            value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                                        >
                                            <option value="">-- Select Subject --</option>
                                            {subjects.map(s => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Total Questions</label>
                                        <input
                                            type="number" className="w-full p-2.5 border rounded-lg font-bold"
                                            value={totalQuestions} onChange={e => setTotalQuestions(Number(e.target.value))}
                                        />
                                    </div>
                                </div>

                                {/* Distribution Sliders */}
                                <div className="space-y-5 bg-gray-50 p-5 rounded-lg border">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-bold text-gray-700">Distribution</label>
                                        <div className="flex bg-white border rounded p-1">
                                            <button onClick={() => setDistMode('percent')} className={`px-2 py-0.5 text-xs rounded ${distMode === 'percent' ? 'bg-gray-200 font-bold' : ''}`}><Percent className="w-3 h-3" /></button>
                                            <button onClick={() => setDistMode('count')} className={`px-2 py-0.5 text-xs rounded ${distMode === 'count' ? 'bg-gray-200 font-bold' : ''}`}><Hash className="w-3 h-3" /></button>
                                        </div>
                                    </div>

                                    {/* Sliders Reuse Logic */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 text-xs font-bold text-green-700">Easy</div>
                                        {distMode === 'percent' ? (
                                            <input type="range" className="flex-1 accent-green-600" min="0" max="100" value={Math.round(cntEasy / totalQuestions * 100) || 0} onChange={e => handleDistChange('easy', Number(e.target.value), 'percent')} />
                                        ) : (
                                            <input type="number" className="flex-1 border p-1" value={cntEasy} onChange={e => handleDistChange('easy', Number(e.target.value), 'count')} />
                                        )}
                                        <span className="w-12 text-right font-mono font-bold">{cntEasy}</span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="w-16 text-xs font-bold text-yellow-700">Medium</div>
                                        {distMode === 'percent' ? (
                                            <input type="range" className="flex-1 accent-yellow-600" min="0" max="100" value={Math.round(cntMed / totalQuestions * 100) || 0} onChange={e => handleDistChange('medium', Number(e.target.value), 'percent')} />
                                        ) : (
                                            <input type="number" className="flex-1 border p-1" value={cntMed} onChange={e => handleDistChange('medium', Number(e.target.value), 'count')} />
                                        )}
                                        <span className="w-12 text-right font-mono font-bold">{cntMed}</span>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="w-16 text-xs font-bold text-red-700">Hard</div>
                                        {distMode === 'percent' ? (
                                            <input type="range" className="flex-1 accent-red-600" min="0" max="100" value={Math.round(cntHard / totalQuestions * 100) || 0} onChange={e => handleDistChange('hard', Number(e.target.value), 'percent')} />
                                        ) : (
                                            <input type="number" className="flex-1 border p-1" value={cntHard} onChange={e => handleDistChange('hard', Number(e.target.value), 'count')} />
                                        )}
                                        <span className="w-12 text-right font-mono font-bold">{cntHard}</span>
                                    </div>

                                    <div className={`text-right text-xs font-bold ${currentTotalQs === totalQuestions ? 'text-green-600' : 'text-red-500'}`}>
                                        Total: {currentTotalQs} / {totalQuestions}
                                    </div>

                                    <div className="pt-3 border-t flex justify-between items-center text-sm font-bold text-gray-700">
                                        <span>Projected Score:</span>
                                        <span className="text-xl text-blue-600">{currentTotalMarks}</span>
                                    </div>
                                </div>
                            </section>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}