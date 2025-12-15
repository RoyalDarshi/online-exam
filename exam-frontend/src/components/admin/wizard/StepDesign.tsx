//
import React, { useState, useEffect, useMemo } from "react";
import {
    BookOpen,
    Target,
    Settings2,
    Hash,
    AlertTriangle,
    Filter,
    CheckSquare,
    Layers,
    RefreshCcw,
} from "lucide-react";
import api from "../../../lib/api"; // Assuming you have an axios instance here

// -- Types --
type TopicSummary = {
    topic: string;
    easy: number;
    medium: number;
    hard: number;
    total: number;
    types: Record<string, number>;
};

type Props = {
    subjects: any[];
    subject: string;
    setSubject: (v: string) => void;

    // Config State
    totalQuestions: number;
    setTotalQuestions: (v: number) => void;
    targetTotalMarks: number;
    setTargetTotalMarks: (v: number) => void;

    // Distribution State
    counts: { easy: number; medium: number; hard: number };
    setCounts: (v: any) => void;

    // Scoring State
    pts: { easy: number; medium: number; hard: number };
    setPts: (v: any) => void;
    enableNeg: boolean;
    setEnableNeg: (v: boolean) => void;
    neg: { easy: number; medium: number; hard: number };
    setNeg: (v: any) => void;

    // Filters (New)
    selectedTopics: string[];
    setSelectedTopics: (v: string[]) => void;
    selectedTypes: string[];
    setSelectedTypes: (v: string[]) => void;

    loading: boolean;
    onNext: () => void;
    currentTotalQs: number;
};

export const StepDesign: React.FC<Props> = ({
    subjects,
    subject,
    setSubject,
    totalQuestions,
    setTotalQuestions,
    targetTotalMarks,
    setTargetTotalMarks,
    pts,
    setPts,
    enableNeg,
    setEnableNeg,
    neg,
    setNeg,
    counts,
    setCounts,
    selectedTopics,
    setSelectedTopics,
    selectedTypes,
    setSelectedTypes,
    loading,
    onNext,
    currentTotalQs,
}) => {
    // --- Local State for Bank Data ---
    const [bankStats, setBankStats] = useState<TopicSummary[]>([]);
    const [fetchingStats, setFetchingStats] = useState(false);

    // --- Fetch Topics on Subject Change ---
    useEffect(() => {
        if (!subject) {
            setBankStats([]);
            return;
        }
        setFetchingStats(true);
        api.get(`/admin/bank/topics/${subject}`)
            .then((res) => {
                setBankStats(res.data || []);
                // Default: Select ALL topics and ALL types initially
                const allTopics = (res.data || []).map((t: TopicSummary) => t.topic);
                const allTypesSet = new Set<string>();
                (res.data || []).forEach((t: TopicSummary) => {
                    Object.keys(t.types || {}).forEach(k => allTypesSet.add(k));
                });

                // Only reset selection if it's empty (new subject selection)
                if (selectedTopics.length === 0) setSelectedTopics(allTopics);
                if (selectedTypes.length === 0) setSelectedTypes(Array.from(allTypesSet));
            })
            .catch(err => console.error("Failed to fetch bank stats", err))
            .finally(() => setFetchingStats(false));
    }, [subject]);

    // --- Derived Calculations (The "Magic" part) ---
    // Calculate max available questions based on ACTIVE filters
    const { maxEasy, maxMedium, maxHard, availableTotal, availableTypes } = useMemo(() => {
        let e = 0, m = 0, h = 0;
        let typeSet = new Set<string>();

        // Filter bankStats by selected Topics
        const activeTopicStats = bankStats.filter(s => selectedTopics.includes(s.topic));

        activeTopicStats.forEach(stat => {
            // Add types to set
            Object.keys(stat.types).forEach(k => typeSet.add(k));

            // To accurately filter by Type complexity, we strictly need backend support for (Topic+Type+Complexity).
            // For now, we assume if a Topic is selected, its complexity counts are valid. 
            // NOTE: If your backend supports granular filtering, update this logic.
            // Here we assume simple Topic filtering for counts:
            e += stat.easy;
            m += stat.medium;
            h += stat.hard;
        });

        return {
            maxEasy: e,
            maxMedium: m,
            maxHard: h,
            availableTotal: e + m + h,
            availableTypes: Array.from(typeSet)
        };
    }, [bankStats, selectedTopics, selectedTypes]);

    // Auto-adjust Total Questions if it exceeds available
    useEffect(() => {
        if (availableTotal > 0 && totalQuestions > availableTotal) {
            // Optional: Auto-clamp? Or just warn. Let's warn via UI, but maybe clamping is safer.
            // setTotalQuestions(availableTotal); 
        }
    }, [availableTotal, totalQuestions]);

    const toggleTopic = (t: string) => {
        if (selectedTopics.includes(t)) {
            setSelectedTopics(selectedTopics.filter(x => x !== t));
        } else {
            setSelectedTopics([...selectedTopics, t]);
        }
    };

    const toggleType = (t: string) => {
        if (selectedTypes.includes(t)) {
            setSelectedTypes(selectedTypes.filter(x => x !== t));
        } else {
            setSelectedTypes([...selectedTypes, t]);
        }
    };

    const selectAllTopics = () => setSelectedTopics(bankStats.map(s => s.topic));
    const deselectAllTopics = () => setSelectedTopics([]);

    // --- Render Helpers ---
    const getAvailabilityColor = (req: number, max: number) => {
        if (max === 0) return "text-slate-400";
        if (req > max) return "text-rose-600 font-bold animate-pulse";
        if (req === max) return "text-amber-600 font-semibold";
        return "text-emerald-600";
    };

    return (
        <div className="grid lg:grid-cols-12 gap-6 h-full">

            {/* LEFT COLUMN: Configuration & Bank Explorer */}
            <div className="lg:col-span-7 space-y-6">

                {/* 1. Subject Selection */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
                        <BookOpen className="w-4 h-4 text-sky-600" /> Subject Selection
                    </h3>
                    <select
                        className="w-full p-3 rounded-lg border bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-950 dark:border-slate-800"
                        value={subject}
                        onChange={(e) => {
                            setSubject(e.target.value);
                            setSelectedTopics([]); // Reset filters
                            setCounts({ easy: 0, medium: 0, hard: 0 }); // Reset counts
                        }}
                    >
                        <option value="">Select a Subject...</option>
                        {subjects.map((s) => (
                            <option key={s.subject} value={s.subject}>{s.subject} ({s.count} Qs)</option>
                        ))}
                    </select>
                </section>

                {/* 2. Bank Explorer (Filters) */}
                {subject && (
                    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                                <Filter className="w-4 h-4 text-sky-600" />
                                Filter Content
                                {fetchingStats && <RefreshCcw className="w-3 h-3 animate-spin text-slate-400" />}
                            </h3>
                            <div className="text-xs space-x-2">
                                <button onClick={selectAllTopics} className="text-sky-600 hover:underline">All</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={deselectAllTopics} className="text-slate-500 hover:underline">None</button>
                            </div>
                        </div>

                        {/* Topics List */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-[300px] overflow-y-auto bg-slate-50/50">
                            {bankStats.length === 0 && !fetchingStats ? (
                                <div className="p-4 text-center text-sm text-slate-500">No topics found.</div>
                            ) : (
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase sticky top-0">
                                        <tr>
                                            <th className="p-3 w-8"></th>
                                            <th className="p-3">Topic</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3 text-right text-emerald-600">E</th>
                                            <th className="p-3 text-right text-amber-600">M</th>
                                            <th className="p-3 text-right text-rose-600">H</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {bankStats.map(stat => (
                                            <tr key={stat.topic} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => toggleTopic(stat.topic)}>
                                                <td className="p-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTopics.includes(stat.topic)}
                                                        readOnly
                                                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                                                    />
                                                </td>
                                                <td className="p-3 font-medium text-slate-700 dark:text-slate-300">{stat.topic}</td>
                                                <td className="p-3 text-right font-mono text-slate-600">{stat.total}</td>
                                                <td className="p-3 text-right font-mono text-slate-400">{stat.easy}</td>
                                                <td className="p-3 text-right font-mono text-slate-400">{stat.medium}</td>
                                                <td className="p-3 text-right font-mono text-slate-400">{stat.hard}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Question Types Filter */}
                        {availableTypes.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <label className="text-xs font-semibold text-slate-500 uppercase block mb-2">Question Types</label>
                                <div className="flex flex-wrap gap-2">
                                    {availableTypes.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => toggleType(type)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedTypes.includes(type)
                                                ? "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/30 dark:border-sky-700 dark:text-sky-300"
                                                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
                                                }`}
                                        >
                                            {selectedTypes.includes(type) && <CheckSquare className="w-3 h-3 inline-block mr-1 -mt-0.5" />}
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* RIGHT COLUMN: Distribution & Rules */}
            <div className="lg:col-span-5 space-y-6">

                {/* 3. Distribution Setup (The enhanced part) */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
                        <Target className="w-4 h-4 text-sky-600" /> Questions Distribution
                    </h3>

                    {/* Total Count Input */}
                    <div className="mb-6 p-4 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Total Questions</label>
                            <span className="text-xs font-semibold text-slate-500">Available: {availableTotal}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                className={`w-full bg-transparent text-3xl font-bold outline-none ${totalQuestions > availableTotal ? "text-rose-600" : "text-slate-900 dark:text-slate-100"
                                    }`}
                                value={totalQuestions}
                                onChange={(e) => setTotalQuestions(Number(e.target.value))}
                            />
                            <div className="text-right">
                                <div className="text-xs text-slate-400">Target Marks</div>
                                <div className="text-xl font-bold text-slate-700 dark:text-slate-300">{targetTotalMarks}</div>
                            </div>
                        </div>
                        {totalQuestions > availableTotal && (
                            <p className="text-xs text-rose-600 mt-1 font-medium">Warning: Exceeds available ({availableTotal})</p>
                        )}
                    </div>

                    {/* Difficulty Sliders/Inputs */}
                    <div className="space-y-4">
                        {[
                            { key: "easy", color: "emerald", label: "Easy", max: maxEasy },
                            { key: "medium", color: "amber", label: "Medium", max: maxMedium },
                            { key: "hard", color: "rose", label: "Hard", max: maxHard },
                        ].map((item) => {
                            const count = counts[item.key as keyof typeof counts];
                            return (
                                <div key={item.key}>
                                    <div className="flex justify-between items-end mb-1">
                                        <label className={`text-sm font-semibold text-${item.color}-600`}>{item.label}</label>
                                        <span className={`text-xs font-mono ${getAvailabilityColor(count, item.max)}`}>
                                            Max: {item.max}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min="0"
                                            max={totalQuestions} // Slider relative to total requested, not max bank to allow "over-requesting" visibility
                                            className={`flex-1 h-2 bg-slate-200 rounded-lg cursor-pointer accent-${item.color}-600`}
                                            value={count}
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setCounts({ ...counts, [item.key]: val });
                                            }}
                                        />
                                        <input
                                            type="number"
                                            className={`w-16 p-1 text-center border rounded text-sm font-semibold ${count > item.max ? "border-rose-500 bg-rose-50 text-rose-700" : "border-slate-200 bg-white text-slate-900"
                                                }`}
                                            value={count}
                                            onChange={(e) => setCounts({ ...counts, [item.key]: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        <div className={`mt-2 pt-2 text-right text-xs font-bold border-t border-slate-100 ${currentTotalQs !== totalQuestions ? "text-rose-500" : "text-emerald-600"
                            }`}>
                            Selected: {currentTotalQs} / {totalQuestions} Required
                        </div>
                    </div>
                </section>

                {/* 4. Scoring & Rules */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
                        <Settings2 className="w-4 h-4 text-sky-600" /> Scoring Rules
                    </h3>

                    {/* Points Config */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {["easy", "medium", "hard"].map(level => (
                            <div key={level} className="text-center">
                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">{level}</label>
                                <input
                                    type="number"
                                    className="w-full p-2 text-center border border-slate-200 rounded text-slate-900 text-sm font-bold"
                                    value={pts[level as keyof typeof pts]}
                                    onChange={(e) => setPts({ ...pts, [level]: Number(e.target.value) })}
                                />
                            </div>
                        ))}
                    </div>

                    {/* Negative Marking */}
                    <div className="bg-rose-50 dark:bg-rose-900/10 rounded-lg p-3 border border-rose-100">
                        <label className="flex items-center gap-2 text-sm font-semibold text-rose-800 cursor-pointer mb-2">
                            <input
                                type="checkbox"
                                checked={enableNeg}
                                onChange={(e) => setEnableNeg(e.target.checked)}
                                className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                            />
                            Negative Marking
                        </label>
                        {enableNeg && (
                            <div className="grid grid-cols-3 gap-2">
                                {["easy", "medium", "hard"].map(level => (
                                    <input
                                        key={level}
                                        type="number"
                                        placeholder={`-${level}`}
                                        step="0.25"
                                        className="w-full p-1 text-center border border-rose-200 rounded bg-white text-rose-700 text-xs font-semibold"
                                        value={neg[level as keyof typeof neg]}
                                        onChange={(e) => setNeg({ ...neg, [level]: Number(e.target.value) })}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                <div className="flex justify-end pt-4">
                    <button
                        onClick={onNext}
                        disabled={loading || !subject || currentTotalQs !== totalQuestions || counts.easy > maxEasy || counts.medium > maxMedium || counts.hard > maxHard}
                        className="px-8 py-3 rounded-xl font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                        {loading ? "Verifying..." : "Continue to Schedule"}
                    </button>
                </div>

            </div>
        </div>
    );
};