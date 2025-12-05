import { useEffect, useState } from "react";
import api from "../lib/api";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

export function EditExam({ examId, onBack }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [passingScore, setPassingScore] = useState(60);
    const [examDate, setExamDate] = useState("");
    const [examStartTime, setExamStartTime] = useState("");

    const [questions, setQuestions] = useState([]);

    useEffect(() => {
        loadExam();
    }, []);

    async function loadExam() {
        try {
            const res = await api.get(`/exams/${examId}`);
            const ex = res.data;

            setTitle(ex.title);
            setDescription(ex.description);
            setDurationMinutes(ex.duration_minutes);
            setPassingScore(ex.passing_score);

            // Parse date-time to input formats
            const dt = new Date(ex.start_time);
            setExamDate(dt.toISOString().slice(0, 10));
            setExamStartTime(dt.toTimeString().slice(0, 5));

            setQuestions(
                ex.questions.map((q) => ({
                    id: q.id,
                    question_text: q.question_text,
                    option_a: q.option_a,
                    option_b: q.option_b,
                    option_c: q.option_c,
                    option_d: q.option_d,
                    correct_answer: q.correct_answer,
                    points: q.points,
                    order_number: q.order_number,
                }))
            );
        } catch (err) {
            console.error(err);
            alert("Failed to load exam");
        } finally {
            setLoading(false);
        }
    }

    const addQuestion = () => {
        setQuestions([
            ...questions,
            {
                question_text: "",
                option_a: "",
                option_b: "",
                option_c: "",
                option_d: "",
                correct_answer: "A",
                points: 1,
                order_number: questions.length,
            },
        ]);
    };

    const removeQuestion = (index) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const updateQuestion = (index, field, value) => {
        const arr = [...questions];
        arr[index][field] = value;
        setQuestions(arr);
    };

    async function handleSubmit(e) {
        e.preventDefault();

        if (!examDate || !examStartTime) {
            alert("Choose valid date & time");
            return;
        }

        setSaving(true);
        try {
            const start_time = `${examDate}T${examStartTime}:00+05:30`;

            const payload = {
                title,
                description,
                duration_minutes: durationMinutes,
                passing_score: passingScore,
                start_time,
                questions: questions.map((q, i) => ({
                    ...q,
                    order_number: i,
                })),
            };

            await api.put(`/admin/exams/${examId}`, payload);

            alert("Exam updated successfully!");
            onBack();
        } catch (err) {
            console.error(err);
            alert("Failed to update exam");
        } finally {
            setSaving(false);
        }
    }

    if (loading)
        return (
            <div className="p-10 text-center text-lg font-semibold">Loading...</div>
        );

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b shadow-sm">
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
                    >
                        <ArrowLeft className="w-5 h-5" /> Back
                    </button>
                    <h1 className="text-2xl font-bold">Edit Exam</h1>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 py-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-lg font-semibold mb-4">Exam Details</h2>

                        <div className="space-y-4">
                            <input
                                className="w-full px-4 py-2 border rounded-lg"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Title"
                            />

                            <textarea
                                className="w-full px-4 py-2 border rounded-lg"
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Description"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-4 py-2 border rounded-lg"
                                        value={examDate}
                                        onChange={(e) => setExamDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Start Time</label>
                                    <input
                                        type="time"
                                        className="w-full px-4 py-2 border rounded-lg"
                                        value={examStartTime}
                                        onChange={(e) => setExamStartTime(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="number"
                                    className="px-4 py-2 border rounded-lg"
                                    value={durationMinutes}
                                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                                    placeholder="Duration in minutes"
                                />

                                <input
                                    type="number"
                                    className="px-4 py-2 border rounded-lg"
                                    value={passingScore}
                                    onChange={(e) => setPassingScore(Number(e.target.value))}
                                    placeholder="Passing Score (%)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* QUESTIONS */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">Questions</h2>

                            <button
                                type="button"
                                onClick={addQuestion}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
                            >
                                <Plus className="w-4 h-4" /> Add Question
                            </button>
                        </div>

                        <div className="space-y-6">
                            {questions.map((q, index) => (
                                <div className="bg-gray-50 border p-5 rounded-lg" key={index}>
                                    <div className="flex justify-between mb-2">
                                        <h3 className="font-semibold">Question #{index + 1}</h3>
                                        <button
                                            className="text-red-600"
                                            onClick={() => removeQuestion(index)}
                                            type="button"
                                        >
                                            <Trash2 />
                                        </button>
                                    </div>

                                    <textarea
                                        className="w-full px-3 py-2 border rounded-lg mb-3"
                                        value={q.question_text}
                                        onChange={(e) =>
                                            updateQuestion(index, "question_text", e.target.value)
                                        }
                                        placeholder="Question text"
                                    />

                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            className="px-3 py-2 border rounded-lg"
                                            value={q.option_a}
                                            onChange={(e) =>
                                                updateQuestion(index, "option_a", e.target.value)
                                            }
                                            placeholder="Option A"
                                        />
                                        <input
                                            className="px-3 py-2 border rounded-lg"
                                            value={q.option_b}
                                            onChange={(e) =>
                                                updateQuestion(index, "option_b", e.target.value)
                                            }
                                            placeholder="Option B"
                                        />
                                        <input
                                            className="px-3 py-2 border rounded-lg"
                                            value={q.option_c}
                                            onChange={(e) =>
                                                updateQuestion(index, "option_c", e.target.value)
                                            }
                                            placeholder="Option C"
                                        />
                                        <input
                                            className="px-3 py-2 border rounded-lg"
                                            value={q.option_d}
                                            onChange={(e) =>
                                                updateQuestion(index, "option_d", e.target.value)
                                            }
                                            placeholder="Option D"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <select
                                            className="px-3 py-2 border rounded-lg"
                                            value={q.correct_answer}
                                            onChange={(e) =>
                                                updateQuestion(
                                                    index,
                                                    "correct_answer",
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <option value="A">A</option>
                                            <option value="B">B</option>
                                            <option value="C">C</option>
                                            <option value="D">D</option>
                                        </select>

                                        <input
                                            type="number"
                                            className="px-3 py-2 border rounded-lg"
                                            value={q.points}
                                            min={1}
                                            onChange={(e) =>
                                                updateQuestion(index, "points", Number(e.target.value))
                                            }
                                            placeholder="Points"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button
                        disabled={saving}
                        className="w-full bg-blue-600 text-white px-5 py-3 rounded-lg font-bold"
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </main>
        </div>
    );
}
