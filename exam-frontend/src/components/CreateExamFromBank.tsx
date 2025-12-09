import { useEffect, useState } from "react";
import api from "../lib/api";
import {
    ArrowLeft,
    CheckCircle,
    AlertCircle,
    BookOpen,
    Target,
    Settings2,
    Calendar,
    ChevronRight,
    Calculator,
    AlertTriangle,
    Hash,
    Percent
} from "lucide-react";

type Props = {
    onBack: () => void;
    onComplete: () => void;
};

export function CreateExamFromBank({ onBack, onComplete }: Props) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [subjects, setSubjects] = useState<any[]>([]);

    // --- 1. Subject ---
    const [selectedSubject, setSelectedSubject] = useState("");

    // --- 2. Targets ---
    const [targetTotalMarks, setTargetTotalMarks] = useState(100);
    const [totalQuestions, setTotalQuestions] = useState(50);

    // --- 3. Scoring Config ---
    const [ptsEasy, setPtsEasy] = useState(1);
    const [ptsMed, setPtsMed] = useState(2);
    const [ptsHard, setPtsHard] = useState(5);

    const [enableNeg, setEnableNeg] = useState(false);
    const [negEasy, setNegEasy] = useState(0.25);
    const [negMed, setNegMed] = useState(0.5);
    const [negHard, setNegHard] = useState(1.0);

    // --- 4. Distribution ---
    // We store state primarily in COUNTS now, since user wants "based on number"
    const [cntEasy, setCntEasy] = useState(0);
    const [cntMed, setCntMed] = useState(0);
    const [cntHard, setCntHard] = useState(0);
    const [distMode, setDistMode] = useState<'percent' | 'count'>('percent');

    // --- Meta ---
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [duration, setDuration] = useState(60);
    const [passScore, setPassScore] = useState(40);

    const [error, setError] = useState("");

    // Init defaults when TotalQuestions changes
    useEffect(() => {
        // Default 40/40/20 split
        const e = Math.round(totalQuestions * 0.4);
        const m = Math.round(totalQuestions * 0.4);
        const h = totalQuestions - e - m;
        setCntEasy(e); setCntMed(m); setCntHard(h);
    }, [totalQuestions]);

    useEffect(() => { loadSubjects(); }, []);

    async function loadSubjects() {
        try {
            const res = await api.get("/admin/bank/subjects");
            setSubjects(res.data);
        } catch (err) { console.error(err); }
    }

    // --- Logic Helpers ---

    const currentTotalQs = cntEasy + cntMed + cntHard;
    const currentTotalMarks = (cntEasy * ptsEasy) + (cntMed * ptsMed) + (cntHard * ptsHard);

    // Sync handlers
    const handleDistChange = (type: 'easy' | 'medium' | 'hard', val: number, mode: 'percent' | 'count') => {
        if (mode === 'count') {
            if (type === 'easy') setCntEasy(val);
            if (type === 'medium') setCntMed(val);
            if (type === 'hard') setCntHard(val);
        } else {
            // Percent mode: Convert % to count immediately
            const count = Math.round((totalQuestions * val) / 100);
            if (type === 'easy') setCntEasy(count);
            if (type === 'medium') setCntMed(count);
            if (type === 'hard') setCntHard(count);
        }
    };

    // --- Validation & Submit ---
    async function checkBank() {
        if (currentTotalQs !== totalQuestions) {
            setError(`Question distribution (${currentTotalQs}) does not match Total Questions (${totalQuestions})`);
            return;
        }

        setLoading(true); setError("");
        try {
            // Calculate percentages for the backend preview (it expects %)
            const pEasy = Math.round((cntEasy / totalQuestions) * 100);
            const pMed = Math.round((cntMed / totalQuestions) * 100);
            const pHard = 100 - pEasy - pMed; // Force sum 100

            const payload = {
                subject: selectedSubject,
                topics: [],
                total_questions: totalQuestions,
                difficulty: { easy: pEasy, medium: pMed, hard: pHard }
            };

            const res = await api.post("/admin/exams/preview", payload);
            if (res.data.possible) {
                setStep(2);
            } else {
                setError(res.data.error || "Bank deficiency.");
            }
        } catch (err: any) {
            setError("Server validation failed.");
        } finally {
            setLoading(false);
        }
    }

    async function createExam() {
        if (!title || !date || !time) return alert("Fill schedule details");
        setLoading(true);
        try {
            // Calculate final percentages
            const pEasy = Math.round((cntEasy / totalQuestions) * 100);
            const pMed = Math.round((cntMed / totalQuestions) * 100);
            const pHard = 100 - pEasy - pMed;

            await api.post("/admin/exams/from-bank", {
                subject: selectedSubject,
                topics: [],
                total_questions: totalQuestions,
                difficulty: { easy: pEasy, medium: pMed, hard: pHard },
                points_config: { easy: ptsEasy, medium: ptsMed, hard: ptsHard },
                enable_negative_marking: enableNeg,
                negative_config: { easy: negEasy, medium: negMed, hard: negHard },
                title, description: desc, duration_minutes: duration, passing_score: passScore,
                start_time: `${date}T${time}:00+05:30`
            });
            onComplete();
        } catch (err) { alert("Failed."); }
        finally { setLoading(false); }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex justify-center py-8 px-4 font-sans text-gray-800">
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">

                {/* --- Header --- */}
                <div className="bg-slate-900 text-white p-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold">Exam Wizard</h1>
                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                <span className={step === 1 ? "text-blue-400 font-bold" : ""}>1. Design</span>
                                <ChevronRight className="w-3 h-3" />
                                <span className={step === 2 ? "text-blue-400 font-bold" : ""}>2. Schedule</span>
                            </div>
                        </div>
                    </div>
                    {step === 1 && (
                        <div className="text-right bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
                            <div className="text-xs text-slate-400 uppercase tracking-wider">Projected Score</div>
                            <div className={`text-2xl font-mono font-bold ${currentTotalMarks === targetTotalMarks ? "text-green-400" : "text-yellow-400"}`}>
                                {currentTotalMarks} <span className="text-sm text-slate-500">/ {targetTotalMarks}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- STEP 1: DESIGN --- */}
                {step === 1 && (
                    <div className="p-8 grid lg:grid-cols-12 gap-10">

                        {/* LEFT: Controls */}
                        <div className="lg:col-span-5 space-y-8">

                            {/* 1. Subject */}
                            <section>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                                    <BookOpen className="w-4 h-4 text-blue-600" /> 1. Select Subject
                                </label>
                                <select
                                    className="w-full p-3 border rounded-lg bg-gray-50 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                                >
                                    <option value="">-- Choose Subject --</option>
                                    {subjects.map(s => <option key={s.subject} value={s.subject}>{s.subject}</option>)}
                                </select>
                            </section>

                            {/* 2. Targets */}
                            <section>
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                                    <Target className="w-4 h-4 text-blue-600" /> 2. Set Targets
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-xs font-bold text-gray-400 uppercase">Total Marks</span>
                                        <input
                                            type="number" className="w-full p-3 border rounded-lg font-bold text-gray-800"
                                            value={targetTotalMarks} onChange={e => setTargetTotalMarks(Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-xs font-bold text-gray-400 uppercase">Total Questions</span>
                                        <input
                                            type="number" className="w-full p-3 border rounded-lg font-bold text-gray-800"
                                            value={totalQuestions} onChange={e => setTotalQuestions(Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* 3. Scoring Config */}
                            <section className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
                                    <Settings2 className="w-4 h-4 text-blue-600" /> 3. Marks per Difficulty
                                </label>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-4 items-center gap-2 text-sm">
                                        <span className="col-span-1 font-semibold text-green-700">Easy</span>
                                        <input type="number" className="col-span-1 border rounded p-1 text-center" value={ptsEasy} onChange={e => setPtsEasy(Number(e.target.value))} />
                                        <span className="col-span-2 text-xs text-gray-500">marks each</span>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-2 text-sm">
                                        <span className="col-span-1 font-semibold text-yellow-700">Medium</span>
                                        <input type="number" className="col-span-1 border rounded p-1 text-center" value={ptsMed} onChange={e => setPtsMed(Number(e.target.value))} />
                                        <span className="col-span-2 text-xs text-gray-500">marks each</span>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-2 text-sm">
                                        <span className="col-span-1 font-semibold text-red-700">Hard</span>
                                        <input type="number" className="col-span-1 border rounded p-1 text-center" value={ptsHard} onChange={e => setPtsHard(Number(e.target.value))} />
                                        <span className="col-span-2 text-xs text-gray-500">marks each</span>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* RIGHT: Distribution & Negative */}
                        <div className="lg:col-span-7 space-y-8">

                            {/* 4. Distribution */}
                            <section className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm">
                                <div className="flex justify-between items-center mb-6">
                                    <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                                        <Calculator className="w-4 h-4 text-blue-600" /> 4. Distribution
                                    </label>

                                    {/* Toggle Mode */}
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setDistMode('percent')}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition ${distMode === 'percent' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                        >
                                            <Percent className="w-3 h-3 inline mr-1" /> By %
                                        </button>
                                        <button
                                            onClick={() => setDistMode('count')}
                                            className={`px-3 py-1 text-xs font-bold rounded-md transition ${distMode === 'count' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                        >
                                            <Hash className="w-3 h-3 inline mr-1" /> By Count
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {/* EASY ROW */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 text-sm font-bold text-green-700">Easy</div>
                                        {distMode === 'percent' ? (
                                            <input type="range" className="flex-1 accent-green-600" min="0" max="100"
                                                value={Math.round(cntEasy / totalQuestions * 100) || 0}
                                                onChange={e => handleDistChange('easy', Number(e.target.value), 'percent')}
                                            />
                                        ) : (
                                            <input type="number" className="flex-1 border p-2 rounded"
                                                value={cntEasy} onChange={e => handleDistChange('easy', Number(e.target.value), 'count')}
                                            />
                                        )}
                                        <div className="w-16 text-right font-mono font-bold text-gray-600">{cntEasy} Qs</div>
                                    </div>

                                    {/* MED ROW */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 text-sm font-bold text-yellow-700">Medium</div>
                                        {distMode === 'percent' ? (
                                            <input type="range" className="flex-1 accent-yellow-600" min="0" max="100"
                                                value={Math.round(cntMed / totalQuestions * 100) || 0}
                                                onChange={e => handleDistChange('medium', Number(e.target.value), 'percent')}
                                            />
                                        ) : (
                                            <input type="number" className="flex-1 border p-2 rounded"
                                                value={cntMed} onChange={e => handleDistChange('medium', Number(e.target.value), 'count')}
                                            />
                                        )}
                                        <div className="w-16 text-right font-mono font-bold text-gray-600">{cntMed} Qs</div>
                                    </div>

                                    {/* HARD ROW */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-24 text-sm font-bold text-red-700">Hard</div>
                                        {distMode === 'percent' ? (
                                            <input type="range" className="flex-1 accent-red-600" min="0" max="100"
                                                value={Math.round(cntHard / totalQuestions * 100) || 0}
                                                onChange={e => handleDistChange('hard', Number(e.target.value), 'percent')}
                                            />
                                        ) : (
                                            <input type="number" className="flex-1 border p-2 rounded"
                                                value={cntHard} onChange={e => handleDistChange('hard', Number(e.target.value), 'count')}
                                            />
                                        )}
                                        <div className="w-16 text-right font-mono font-bold text-gray-600">{cntHard} Qs</div>
                                    </div>

                                    <div className={`text-right text-xs font-bold ${currentTotalQs === totalQuestions ? 'text-green-600' : 'text-red-500'}`}>
                                        Total: {currentTotalQs} / {totalQuestions} Questions
                                    </div>
                                </div>
                            </section>

                            {/* 5. Negative Marking */}
                            <section className="bg-red-50 p-6 rounded-xl border border-red-100">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="flex items-center gap-2 text-sm font-bold text-red-800 cursor-pointer">
                                        <input type="checkbox" checked={enableNeg} onChange={e => setEnableNeg(e.target.checked)} className="w-4 h-4 accent-red-600" />
                                        Enable Negative Marking
                                    </label>
                                    <AlertTriangle className="w-5 h-5 text-red-300" />
                                </div>

                                {enableNeg && (
                                    <div className="grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                                        <div>
                                            <label className="block text-xs font-bold text-red-700 mb-1">Easy Penalty</label>
                                            <input type="number" step="0.25" className="w-full border-red-200 p-2 rounded text-center text-red-800 font-bold"
                                                value={negEasy} onChange={e => setNegEasy(Number(e.target.value))} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-red-700 mb-1">Medium Penalty</label>
                                            <input type="number" step="0.25" className="w-full border-red-200 p-2 rounded text-center text-red-800 font-bold"
                                                value={negMed} onChange={e => setNegMed(Number(e.target.value))} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-red-700 mb-1">Hard Penalty</label>
                                            <input type="number" step="0.25" className="w-full border-red-200 p-2 rounded text-center text-red-800 font-bold"
                                                value={negHard} onChange={e => setNegHard(Number(e.target.value))} />
                                        </div>
                                    </div>
                                )}
                            </section>

                            {error && <div className="bg-red-100 text-red-700 p-3 rounded text-sm flex gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

                            <div className="flex justify-end pt-4">
                                <button onClick={checkBank} disabled={loading || !selectedSubject} className="bg-slate-900 text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 transition">
                                    {loading ? "Verifying..." : "Next: Schedule"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- STEP 2: SCHEDULE --- */}
                {step === 2 && (
                    <div className="p-8 max-w-3xl mx-auto space-y-8">
                        <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex gap-4">
                            <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
                            <div>
                                <h3 className="font-bold text-green-800">Design Validated</h3>
                                <p className="text-sm text-green-700">Bank has sufficient questions. Total Marks: {currentTotalMarks}. Negative marking is {enableNeg ? 'ON' : 'OFF'}.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-lg font-bold flex gap-2"><Calendar className="w-5 h-5 text-blue-600" /> Exam Details</h2>
                            <input className="w-full border p-3 rounded-lg" placeholder="Exam Title" value={title} onChange={e => setTitle(e.target.value)} />
                            <textarea className="w-full border p-3 rounded-lg" placeholder="Description / Instructions" value={desc} onChange={e => setDesc(e.target.value)} />

                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-gray-500">Date</label><input type="date" className="w-full border p-3 rounded-lg" value={date} onChange={e => setDate(e.target.value)} /></div>
                                <div><label className="text-xs font-bold text-gray-500">Time</label><input type="time" className="w-full border p-3 rounded-lg" value={time} onChange={e => setTime(e.target.value)} /></div>
                                <div><label className="text-xs font-bold text-gray-500">Duration (min)</label><input type="number" className="w-full border p-3 rounded-lg" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
                                <div><label className="text-xs font-bold text-gray-500">Pass Score (%)</label><input type="number" className="w-full border p-3 rounded-lg" value={passScore} onChange={e => setPassScore(Number(e.target.value))} /></div>
                            </div>
                        </div>

                        <div className="flex justify-between pt-6 border-t">
                            <button onClick={() => setStep(1)} className="text-gray-500 font-bold">Back</button>
                            <button onClick={createExam} disabled={loading} className="bg-green-600 text-white px-10 py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-600/20">
                                {loading ? "Creating..." : "Launch Exam"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}