import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { WizardHeader } from "./admin/wizard/WizardHeader";
import { StepDesign } from "./admin/wizard/StepDesign";
import { StepSchedule } from "./admin/wizard/StepSchedule";
import { AlertCircle } from "lucide-react";

export function EditExam({ examId, onBack, onSaved }: {
    examId: string;
    onBack: () => void;
    onSaved: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [step, setStep] = useState<1 | 2>(1);
    const [error, setError] = useState("");

    // ---- Loaded Data ----
    const [subjects, setSubjects] = useState<any[]>([]);
    const [exam, setExam] = useState<any>(null);

    // ---- Editable State ----
    const [subject, setSubject] = useState("");
    const [totalQuestions, setTotalQuestions] = useState(0);
    const [targetTotalMarks, setTargetTotalMarks] = useState(0);

    const [pts, setPts] = useState({ easy: 1, medium: 2, hard: 5 });
    const [enableNeg, setEnableNeg] = useState(false);
    const [neg, setNeg] = useState({ easy: 0.25, medium: 0.5, hard: 1 });

    const [counts, setCounts] = useState({ easy: 0, medium: 0, hard: 0 });

    const [meta, setMeta] = useState({
        title: "",
        desc: "",
        date: "",
        time: "",
        duration: 60,
        passScore: 40,
    });

    // ---- Load exam + subjects ----
    useEffect(() => {
        loadAll();
    }, []);

    async function loadAll() {
        try {
            const [subjectRes, examRes] = await Promise.all([
                api.get("/admin/bank/subjects"),
                api.get(`/admin/exams/${examId}`)
            ]);

            setSubjects(subjectRes.data || []);
            const ex = examRes.data;
            setExam(ex);

            // Pre-fill form
            setSubject(ex.subject);
            setMeta({
                title: ex.title,
                desc: ex.description,
                date: ex.start_time?.split("T")[0] || "",
                time: ex.start_time?.split("T")[1]?.substring(0, 5) || "",
                duration: ex.duration_minutes,
                passScore: ex.passing_score,
            });

            // Points
            setPts(ex.points_config || pts);

            if (ex.enable_negative_marking) {
                setEnableNeg(true);
                setNeg(ex.negative_config || neg);
            }

            setTargetTotalMarks(
                ex.total_points ??
                (ex.easy_count * pts.easy +
                    ex.medium_count * pts.medium +
                    ex.hard_count * pts.hard)
            );

            setCounts({
                easy: ex.easy_count,
                medium: ex.medium_count,
                hard: ex.hard_count,
            });

            setTotalQuestions(
                ex.easy_count + ex.medium_count + ex.hard_count
            );

        } catch (err) {
            console.error(err);
            setError("Failed to load exam.");
        } finally {
            setLoading(false);
        }
    }

    // ---- Calculated ----
    const currentTotalMarks =
        counts.easy * pts.easy +
        counts.medium * pts.medium +
        counts.hard * pts.hard;

    const currentTotalQs = counts.easy + counts.medium + counts.hard;

    // ---- Validate Step 1 ----
    async function verifyDesign() {
        if (!subject) {
            return setError("Subject is required.");
        }
        if (currentTotalQs !== totalQuestions) {
            return setError(
                `Selected ${currentTotalQs} questions but required ${totalQuestions}.`
            );
        }

        setError("");
        setStep(2);
    }

    // ---- SAVE UPDATE ----
    async function saveExam() {
        if (!meta.title || !meta.date || !meta.time) {
            alert("Please fill all schedule fields.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const payload = {
                subject,
                total_questions: totalQuestions,
                difficulty: {
                    easy: Math.round((counts.easy / totalQuestions) * 100),
                    medium: Math.round((counts.medium / totalQuestions) * 100),
                    hard: Math.round((counts.hard / totalQuestions) * 100),
                },
                points_config: pts,
                enable_negative_marking: enableNeg,
                negative_config: neg,
                title: meta.title,
                description: meta.desc,
                duration_minutes: meta.duration,
                passing_score: meta.passScore,
                start_time: `${meta.date}T${meta.time}:00+05:30`,
            };

            const res = await api.put(`/admin/exams/${examId}`, payload);

            // 🚀 ACCEPT ANY 200 RESPONSE AS SUCCESS
            if (res.status === 200) {
                onSaved();
                return;
            }

            // any unexpected status:
            console.warn("Unexpected response:", res);
            onSaved();

        } catch (err) {
            console.error("FAILED UPDATE", err);
            alert("Failed to save exam.");
        } finally {
            setLoading(false);
        }
    }


    if (loading && !exam) {
        return (
            <div className="min-h-screen flex items-center justify-center text-slate-600 dark:text-slate-300">
                Loading exam...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <div className="max-w-6xl mx-auto py-6 px-4 sm:py-8 sm:px-6">

                {/* Outer TCS Wizard card */}
                <div className="
                    bg-white dark:bg-slate-900
                    rounded-2xl shadow-lg
                    border border-slate-200 dark:border-slate-800
                    overflow-hidden
                    min-h-[75vh]
                    flex flex-col
                ">

                    {/* TCS Header (SAME AS CREATE WIZARD) */}
                    <WizardHeader
                        step={step}
                        onBack={step === 1 ? onBack : () => setStep(1)}
                        currentMarks={currentTotalMarks}
                        targetMarks={targetTotalMarks}
                        showStats={step === 1}
                    />

                    {/* Error banner */}
                    {!!error && (
                        <div className="
                            bg-rose-50 dark:bg-rose-900/20
                            border-b border-rose-200 dark:border-rose-800
                            px-4 py-3 flex items-start gap-3 text-rose-800 dark:text-rose-200
                        ">
                            <AlertCircle className="w-4 h-4 mt-0.5" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Content */}
                    <div className="
                        flex-1 p-4 sm:p-6 md:p-8
                        bg-slate-50/50 dark:bg-slate-950/40
                    ">
                        {step === 1 ? (
                            <StepDesign
                                subjects={subjects}
                                subject={subject}
                                setSubject={setSubject}
                                totalQuestions={totalQuestions}
                                setTotalQuestions={setTotalQuestions}
                                targetTotalMarks={targetTotalMarks}
                                setTargetTotalMarks={setTargetTotalMarks}
                                pts={pts}
                                setPts={setPts}
                                enableNeg={enableNeg}
                                setEnableNeg={setEnableNeg}
                                neg={neg}
                                setNeg={setNeg}
                                counts={counts}
                                setCounts={setCounts}
                                loading={loading}
                                onNext={verifyDesign}
                                currentTotalQs={currentTotalQs}
                            />
                        ) : (
                            <StepSchedule
                                meta={meta}
                                setMeta={setMeta}
                                loading={loading}
                                onSubmit={saveExam}
                                currentTotalMarks={currentTotalMarks}
                                enableNeg={enableNeg}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
