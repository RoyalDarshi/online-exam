//
import React, { useState, useEffect, useMemo } from "react";
import {
    BookOpen,
    Target,
    Settings2,
    Filter,
    CheckSquare,
    RefreshCcw,
    Percent,
    Hash,
    AlertTriangle,
} from "lucide-react";
import api from "../../../lib/api";

// -- UPDATED Types matching Backend --
type DifficultyStats = {
    easy: number;
    medium: number;
    hard: number;
    total: number;
};

type TopicDetail = {
    topic: string;
    overall: DifficultyStats;
    by_type: Record<string, DifficultyStats>;
};

type Props = {
    subjects: any[];
    subject: string;
    setSubject: (v: string) => void;

    // Config
    totalQuestions: number;
    setTotalQuestions: (v: number) => void;
    targetTotalMarks: number;
    setTargetTotalMarks: (v: number) => void;

    // Scoring
    pts: { easy: number; medium: number; hard: number };
    setPts: (v: any) => void;
    enableNeg: boolean;
    setEnableNeg: (v: boolean) => void;
    neg: { easy: number; medium: number; hard: number };
    setNeg: (v: any) => void;

    // Distribution
    counts: { easy: number; medium: number; hard: number };
    setCounts: (v: any) => void;

    // NEW Filters
    selectedTopics: string[];
    setSelectedTopics: (v: string[]) => void;
    selectedTypes: string[];
    setSelectedTypes: (v: string[]) => void;

    loading: boolean;
    onNext: () => void;
    currentTotalQs: number;
};

export const StepDesign: React.FC<Props> = ({
    subjects, subject, setSubject,
    totalQuestions, setTotalQuestions,
    targetTotalMarks, setTargetTotalMarks,
    pts, setPts, enableNeg, setEnableNeg, neg, setNeg,
    counts, setCounts,
    selectedTopics, setSelectedTopics,
    selectedTypes, setSelectedTypes,
    loading, onNext, currentTotalQs,
}) => {
    // Local UI State
    const [bankStats, setBankStats] = useState<TopicDetail[]>([]);
    const [fetchingStats, setFetchingStats] = useState(false);
    const [distMode, setDistMode] = useState<"percent" | "count">("percent");

    // --- 1. Fetch Stats on Subject Change ---
    useEffect(() => {
        if (!subject) {
            setBankStats([]);
            return;
        }
        setFetchingStats(true);
        api.get(`/admin/bank/topics/${subject}`)
            .then((res) => {
                const data: TopicDetail[] = res.data || [];
                setBankStats(data);

                // Default: Select All
                setSelectedTopics(data.map(d => d.topic));
                const allTypes = new Set<string>();
                data.forEach(d => Object.keys(d.by_type).forEach(t => allTypes.add(t)));
                setSelectedTypes(Array.from(allTypes));
            })
            .catch(err => console.error(err))
            .finally(() => setFetchingStats(false));
    }, [subject]);

    // --- 2. Accurate Limit Calculation ---
    const { maxEasy, maxMedium, maxHard, availableTotal, availableTypes } = useMemo(() => {
        let e = 0, m = 0, h = 0;
        let typeSet = new Set<string>();

        const activeTopics = bankStats.filter(s => selectedTopics.includes(s.topic));

        activeTopics.forEach(topic => {
            Object.keys(topic.by_type).forEach(t => typeSet.add(t));

            // Sum counts ONLY for Selected Types
            Object.entries(topic.by_type).forEach(([typeName, stats]) => {
                if (selectedTypes.includes(typeName)) {
                    e += stats.easy;
                    m += stats.medium;
                    h += stats.hard;
                }
            });
        });

        return {
            maxEasy: e, maxMedium: m, maxHard: h,
            availableTotal: e + m + h,
            availableTypes: Array.from(typeSet)
        };
    }, [bankStats, selectedTopics, selectedTypes]);

    // --- 3. Handle Distribution Logic ---
    const handleDistChange = (type: "easy" | "medium" | "hard", val: number) => {
        const newCounts = { ...counts };
        if (distMode === "count") {
            newCounts[type] = val;
        } else {
            // Percentage Mode
            const count = Math.round((totalQuestions * val) / 100);
            newCounts[type] = count;
        }
        setCounts(newCounts);
    };

    const getStatColor = (req: number, max: number) => {
        if (max === 0) return "text-slate-300";
        if (req > max) return "text-rose-600 font-bold animate-pulse";
        return "text-slate-600";
    };

    // Toggles
    const toggleTopic = (t: string) => setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
    const toggleType = (t: string) => setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

    return (
        <div className="grid lg:grid-cols-12 gap-6 h-full">

            {/* LEFT COLUMN: Subject & Explorer */}
            <div className="lg:col-span-5 space-y-6">

                {/* Subject Selector */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
                        <BookOpen className="w-4 h-4 text-sky-600" /> Subject Selection
                    </h3>
                    <select
                        className="w-full p-3 rounded-lg border bg-slate-50 border-slate-200 outline-none focus:ring-2 focus:ring-sky-500 dark:bg-slate-950 dark:border-slate-800"
                        value={subject}
                        onChange={(e) => {
                            setSubject(e.target.value);
                            setCounts({ easy: 0, medium: 0, hard: 0 });
                        }}
                    >
                        <option value="">Select a Subject...</option>
                        {subjects.map((s) => (
                            <option key={s.subject} value={s.subject}>{s.subject} ({s.count} Qs)</option>
                        ))}
                    </select>

                    {/* Target Marks Input (Restored) */}
                    <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                            Total Marks (Target)
                        </label>
                        <input
                            type="number"
                            className="w-full bg-transparent font-bold text-slate-900 dark:text-slate-50 outline-none"
                            value={targetTotalMarks}
                            onChange={(e) => setTargetTotalMarks(Number(e.target.value))}
                        />
                    </div>
                </section>

                {/* Bank Explorer */}
                {subject && (
                    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col min-h-[400px]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                                <Filter className="w-4 h-4 text-sky-600" />
                                Bank Content
                                {fetchingStats && <RefreshCcw className="w-3 h-3 animate-spin text-slate-400" />}
                            </h3>
                            <div className="flex gap-2 text-[10px]">
                                <button onClick={() => setSelectedTopics(bankStats.map(s => s.topic))} className="text-sky-600 hover:underline">All</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={() => setSelectedTopics([])} className="text-slate-500 hover:underline">None</button>
                            </div>
                        </div>

                        {/* Topics List */}
                        <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50/50 flex flex-col">
                            <div className="overflow-y-auto max-h-[300px]">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 font-semibold text-xs uppercase sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="p-2 w-8"></th>
                                            <th className="p-2">Topic</th>
                                            <th className="p-2 text-right">Tot</th>
                                            <th className="p-2 text-right text-emerald-600">E</th>
                                            <th className="p-2 text-right text-amber-600">M</th>
                                            <th className="p-2 text-right text-rose-600">H</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {bankStats.map(stat => (
                                            <tr key={stat.topic}
                                                className="hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                onClick={() => toggleTopic(stat.topic)}
                                            >
                                                <td className="p-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedTopics.includes(stat.topic)}
                                                        readOnly
                                                        className="w-3.5 h-3.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-2 font-medium text-slate-700 dark:text-slate-300 text-xs truncate max-w-[100px]" title={stat.topic}>
                                                    {stat.topic}
                                                </td>
                                                <td className="p-2 text-right font-mono text-xs text-slate-600">{stat.overall.total}</td>
                                                <td className="p-2 text-right font-mono text-xs text-slate-400">{stat.overall.easy}</td>
                                                <td className="p-2 text-right font-mono text-xs text-slate-400">{stat.overall.medium}</td>
                                                <td className="p-2 text-right font-mono text-xs text-slate-400">{stat.overall.hard}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Question Types */}
                        {availableTypes.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Question Types</label>
                                    <button onClick={() => setSelectedTypes(availableTypes)} className="text-[10px] text-sky-600 font-medium hover:underline">All</button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableTypes.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => toggleType(type)}
                                            className={`
                                                px-2 py-1 rounded text-[10px] font-semibold border transition-all flex items-center gap-1
                                                ${selectedTypes.includes(type)
                                                    ? "bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-900/40 dark:border-sky-700 dark:text-sky-300"
                                                    : "bg-white border-slate-200 text-slate-500 dark:bg-slate-900 dark:border-slate-800"
                                                }
                                            `}
                                        >
                                            {selectedTypes.includes(type) ? <CheckSquare className="w-2.5 h-2.5" /> : <div className="w-2.5 h-2.5 border rounded-sm" />}
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* RIGHT COLUMN: Settings */}
            <div className="lg:col-span-7 space-y-6">

                {/* 1. Distribution Settings */}
                <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                            <Target className="w-4 h-4 text-sky-600" /> Question Distribution
                        </h3>

                        {/* Toggle % vs # (Restored) */}
                        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setDistMode("percent")}
                                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition ${distMode === "percent" ? "bg-white dark:bg-slate-700 shadow text-sky-600" : "text-slate-500"}`}
                            >
                                <Percent className="w-3 h-3" /> %
                            </button>
                            <button
                                onClick={() => setDistMode("count")}
                                className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1 transition ${distMode === "count" ? "bg-white dark:bg-slate-700 shadow text-sky-600" : "text-slate-500"}`}
                            >
                                <Hash className="w-3 h-3" /> #
                            </button>
                        </div>
                    </div>

                    {/* Total Input with Alert */}
                    <div className="mb-6 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden">
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Total Questions to Generate</label>
                            <span className="text-xs font-semibold text-slate-500">Max Available: {availableTotal}</span>
                        </div>
                        <input
                            type="number"
                            className="w-full bg-transparent text-3xl font-bold text-slate-800 dark:text-slate-100 outline-none"
                            value={totalQuestions}
                            onChange={(e) => setTotalQuestions(Number(e.target.value))}
                        />
                        {totalQuestions > availableTotal && (
                            <div className="absolute bottom-0 left-0 w-full bg-rose-100 text-rose-700 text-[10px] font-bold px-4 py-1 flex items-center gap-1">
                                <Target className="w-3 h-3" /> Not enough questions available!
                            </div>
                        )}
                    </div>

                    {/* Sliders */}
                    <div className="space-y-5">
                        {[
                            { key: "easy", color: "emerald", label: "Easy", max: maxEasy },
                            { key: "medium", color: "amber", label: "Medium", max: maxMedium },
                            { key: "hard", color: "rose", label: "Hard", max: maxHard },
                        ].map((item) => {
                            const count = counts[item.key as keyof typeof counts];
                            return (
                                <div key={item.key}>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className={`font-bold text-${item.color}-600 uppercase`}>{item.label}</span>
                                        <span className={`font-mono ${getStatColor(count, item.max)}`}>
                                            Selected: {count} / Available: {item.max}
                                        </span>
                                    </div>
                                    <div className="flex gap-3 items-center">
                                        {/* Slider: Shows % if in percent mode, but calculates absolute value */}
                                        <input
                                            type="range"
                                            min="0"
                                            max={distMode === "percent" ? 100 : totalQuestions}
                                            value={distMode === "percent"
                                                ? (totalQuestions ? Math.round((count / totalQuestions) * 100) : 0)
                                                : count
                                            }
                                            onChange={(e) => handleDistChange(item.key as any, Number(e.target.value))}
                                            className={`flex-1 h-2 rounded-lg cursor-pointer bg-slate-200 accent-${item.color}-600`}
                                        />

                                        {/* Input Box */}
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="number"
                                                className="w-14 p-1.5 text-center text-sm font-bold border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
                                                value={count}
                                                onChange={(e) => setCounts({ ...counts, [item.key]: Number(e.target.value) })}
                                            />
                                            <span className="text-[10px] text-slate-400 font-bold uppercase">Qs</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 2. Scoring & Negative Marking (Restored) */}
                <div className="grid sm:grid-cols-2 gap-6">
                    {/* Points Per Question */}
                    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
                            <Settings2 className="w-4 h-4 text-sky-600" /> Points Config
                        </h3>
                        <div className="space-y-3">
                            {["easy", "medium", "hard"].map(level => (
                                <div key={level} className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase text-slate-500">{level}</span>
                                    <input
                                        type="number"
                                        className="w-16 p-1 text-center border border-slate-200 rounded text-sm font-bold"
                                        value={pts[level as keyof typeof pts]}
                                        onChange={(e) => setPts({ ...pts, [level]: Number(e.target.value) })}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Negative Marking Config (Fully Restored) */}
                    <section className="bg-rose-50/50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-900/30 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <label className="flex items-center gap-2 text-sm font-semibold text-rose-800 dark:text-rose-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={enableNeg}
                                    onChange={(e) => setEnableNeg(e.target.checked)}
                                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                                />
                                Negative Marking
                            </label>
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                        </div>

                        {enableNeg && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                {["easy", "medium", "hard"].map(level => (
                                    <div key={level} className="flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase text-rose-700/70">{level} Penalty</span>
                                        <input
                                            type="number"
                                            step="0.25"
                                            className="w-16 p-1 text-center border border-rose-200 rounded text-sm font-bold text-rose-700"
                                            value={neg[level as keyof typeof neg]}
                                            onChange={(e) => setNeg({ ...neg, [level]: Number(e.target.value) })}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        {!enableNeg && (
                            <p className="text-xs text-rose-400 mt-2 italic">
                                Check the box to enable penalty points for incorrect answers.
                            </p>
                        )}
                    </section>
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        onClick={onNext}
                        disabled={loading || !subject || currentTotalQs !== totalQuestions || counts.easy > maxEasy || counts.medium > maxMedium || counts.hard > maxHard}
                        className="px-8 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-lg shadow-sky-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
                    >
                        {loading ? "Verifying..." : "Continue to Schedule"}
                    </button>
                </div>

            </div>
        </div>
    );
};