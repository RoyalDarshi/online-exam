//
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
    const [totalQuestions, setTotalQuestions] = React.useState(0); // Start at 0 to force user input
    const [targetTotalMarks, setTargetTotalMarks] = React.useState(0);

    // New Filters
    const [selectedTopics, setSelectedTopics] = React.useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = React.useState<string[]>([]);

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

    React.useEffect(() => {
        api.get("/admin/bank/subjects").then(res => setSubjects(res.data || [])).catch(console.error);
    }, []);

    // Auto-calculate Total Marks when counts/pts change
    React.useEffect(() => {
        const total = (counts.easy * pts.easy) + (counts.medium * pts.medium) + (counts.hard * pts.hard);
        setTargetTotalMarks(total);
    }, [counts, pts]);

    const currentTotalQs = counts.easy + counts.medium + counts.hard;

    async function verifyDesign() {
        if (currentTotalQs !== totalQuestions) {
            setError(`Mismatch: Selected ${currentTotalQs} questions, but Total is set to ${totalQuestions}.`);
            return;
        }
        setStep(2);
        setError("");
    }

    async function handleCreate() {
        if (!meta.title || !meta.date || !meta.time) {
            alert("Please fill in all schedule details.");
            return;
        }

        setLoading(true);
        try {
            // Calculate actual percentages for the payload
            const pEasy = Math.round((counts.easy / totalQuestions) * 100);
            const pMed = Math.round((counts.medium / totalQuestions) * 100);
            const pHard = 100 - pEasy - pMed; // Remainder to ensure 100%

            const payload = {
                subject,
                topics: selectedTopics,         // Pass selected topics
                question_types: selectedTypes,  // Pass selected types
                total_questions: totalQuestions,
                difficulty: { easy: pEasy, medium: pMed, hard: pHard },
                points_config: pts,
                enable_negative_marking: enableNeg,
                negative_config: neg,
                title: meta.title,
                description: meta.desc,
                duration_minutes: meta.duration,
                passing_score: meta.passScore,
                start_time: `${meta.date}T${meta.time}:00+05:30`,
            };

            await api.post("/admin/exams", payload);
            onComplete();
        } catch (err: any) {
            console.error(err);
            alert("Failed to create exam: " + (err.response?.data?.error || "Unknown error"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <div className="max-w-7xl mx-auto py-6 px-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col min-h-[80vh]">
                    <WizardHeader
                        step={step}
                        onBack={step === 1 ? onBack : () => setStep(1)}
                        currentMarks={targetTotalMarks} // Showing calculated marks as "Current"
                        targetMarks={targetTotalMarks}
                        showStats={step === 1}
                    />

                    {error && (
                        <div className="bg-rose-50 border-b border-rose-200 px-4 py-3 text-rose-700 flex gap-2">
                            <AlertCircle className="w-5 h-5" /> {error}
                        </div>
                    )}

                    <div className="flex-1 p-6 bg-slate-50/50">
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
                                // New Props
                                selectedTopics={selectedTopics}
                                setSelectedTopics={setSelectedTopics}
                                selectedTypes={selectedTypes}
                                setSelectedTypes={setSelectedTypes}
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
                                currentTotalMarks={targetTotalMarks}
                                enableNeg={enableNeg}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}