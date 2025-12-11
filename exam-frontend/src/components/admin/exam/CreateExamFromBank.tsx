import React from "react";
import api from "../../../lib/api";
import { WizardHeader } from "../../admin/wizard/WizardHeader";
import { StepDesign } from "../../admin/wizard/StepDesign";
import { StepSchedule } from "../../admin/wizard/StepSchedule";
import { AlertCircle } from "lucide-react";

type Props = {
    onBack: () => void;
    onComplete: () => void;
};

export function CreateExamFromBank({ onBack, onComplete }: Props) {
    const [step, setStep] = React.useState(1);
    const [loading, setLoading] = React.useState(false);
    const [subjects, setSubjects] = React.useState<any[]>([]);
    const [error, setError] = React.useState("");

    // --- FORM STATE ---
    const [subject, setSubject] = React.useState("");
    const [totalQuestions, setTotalQuestions] = React.useState(50);
    const [targetTotalMarks, setTargetTotalMarks] = React.useState(100);

    const [pts, setPts] = React.useState({ easy: 1, medium: 2, hard: 5 });

    const [enableNeg, setEnableNeg] = React.useState(false);
    const [neg, setNeg] = React.useState({ easy: 0.25, medium: 0.5, hard: 1.0 });

    const [counts, setCounts] = React.useState({ easy: 0, medium: 0, hard: 0 });

    const [meta, setMeta] = React.useState({
        title: "",
        desc: "",
        date: "",
        time: "",
        duration: 60,
        passScore: 40,
    });

    // --- INITIALIZATION ---
    React.useEffect(() => {
        loadSubjects();
    }, []);

    React.useEffect(() => {
        const e = Math.round(totalQuestions * 0.4);
        const m = Math.round(totalQuestions * 0.4);
        const h = totalQuestions - e - m;
        setCounts({ easy: e, medium: m, hard: h });
    }, [totalQuestions]);

    async function loadSubjects() {
        try {
            const res = await api.get("/admin/bank/subjects");
            setSubjects(res.data || []);
        } catch (err) {
            console.error(err);
        }
    }

    // --- CALCULATED METRICS ---
    const currentTotalMarks =
        counts.easy * pts.easy + counts.medium * pts.medium + counts.hard * pts.hard;
    const currentTotalQs = counts.easy + counts.medium + counts.hard;

    // --- ACTIONS ---
    async function verifyDesign() {
        if (currentTotalQs !== totalQuestions) {
            setError(
                `Question count mismatch: Selected ${currentTotalQs}, required ${totalQuestions}.`
            );
            return;
        }
        if (!subject) {
            setError("Please select a subject.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const pEasy = Math.round((counts.easy / totalQuestions) * 100);
            const pMed = Math.round((counts.medium / totalQuestions) * 100);
            const pHard = 100 - pEasy - pMed;

            const payload = {
                subject,
                topics: [],
                total_questions: totalQuestions,
                difficulty: { easy: pEasy, medium: pMed, hard: pHard },
            };

            const res = await api.post("/admin/exams/preview", payload);
            if (res.data.possible) {
                setStep(2);
            } else {
                setError(
                    res.data.error ||
                    "Question bank has insufficient questions for this configuration."
                );
            }
        } catch (err: any) {
            console.error(err);
            setError("Server validation failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        if (!meta.title || !meta.date || !meta.time) {
            alert("Please fill in all schedule details.");
            return;
        }

        setLoading(true);
        try {
            const pEasy = Math.round((counts.easy / totalQuestions) * 100);
            const pMed = Math.round((counts.medium / totalQuestions) * 100);
            const pHard = 100 - pEasy - pMed;

            const payload = {
                subject,
                topics: [],
                total_questions: totalQuestions,
                difficulty: { easy: pEasy, medium: pMed, hard: pHard },
                points_config: {
                    easy: pts.easy,
                    medium: pts.medium,
                    hard: pts.hard,
                },
                enable_negative_marking: enableNeg,
                negative_config: {
                    easy: neg.easy,
                    medium: neg.medium,
                    hard: neg.hard,
                },
                title: meta.title,
                description: meta.desc,
                duration_minutes: meta.duration,
                passing_score: meta.passScore,
                start_time: `${meta.date}T${meta.time}:00+05:30`,
            };

            await api.post("/admin/exams/from-bank", payload);
            onComplete();
        } catch (err) {
            console.error(err);
            alert("Failed to create exam.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <div className="max-w-6xl mx-auto py-6 px-4 sm:py-8 sm:px-6 lg:px-8">
                {/* Outer card like StudentDashboard cards */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-slate-200/60 dark:shadow-slate-950/60 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col min-h-[75vh]">
                    {/* TCS style wizard header */}
                    <WizardHeader
                        step={step}
                        onBack={step === 1 ? onBack : () => setStep(1)}
                        currentMarks={currentTotalMarks}
                        targetMarks={targetTotalMarks}
                        showStats={step === 1}
                    />

                    {/* Error banner */}
                    {error && (
                        <div className="bg-rose-50 dark:bg-rose-900/20 border-b border-rose-200 dark:border-rose-800 px-4 py-3 flex items-start gap-3 text-rose-700 dark:text-rose-200 text-sm">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            <p className="font-medium">{error}</p>
                        </div>
                    )}

                    {/* Content area */}
                    <div className="flex-1 p-4 sm:p-6 md:p-8 bg-slate-50/60 dark:bg-slate-950/50">
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
                                onSubmit={handleCreate}
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
