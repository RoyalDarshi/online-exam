import { useState } from "react";
import api from "../lib/api";
import { Plus, Trash2, ArrowLeft } from "lucide-react";

type Props = {
  onComplete: () => void;
  onCancel: () => void;
};

type QuestionInput = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  points: number;
};

export function CreateExam({ onComplete, onCancel }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [passingScore, setPassingScore] = useState(60);

  // NEW FIELDS
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("");

  const [questions, setQuestions] = useState<QuestionInput[]>([
    {
      question_text: "",
      option_a: "",
      option_b: "",
      option_c: "",
      option_d: "",
      correct_answer: "A",
      points: 1,
    },
  ]);

  const [saving, setSaving] = useState(false);

  // Add Question
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
      },
    ]);
  };

  // Remove Question
  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  // Update Question Value
  const updateQuestion = (
    index: number,
    field: keyof QuestionInput,
    value: string | number
  ) => {
    const updated = [...questions];
    // @ts-ignore
    updated[index][field] = value;
    setQuestions(updated);
  };

  // Submit Exam
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!examDate || !examStartTime) {
      alert("Please select exam date & start time.");
      return;
    }

    if (questions.length === 0) {
      alert("Please add at least one question.");
      return;
    }

    for (const q of questions) {
      if (
        !q.question_text ||
        !q.option_a ||
        !q.option_b ||
        !q.option_c ||
        !q.option_d
      ) {
        alert("All question fields must be filled.");
        return;
      }
    }

    setSaving(true);
    try {
      const isoStart = new Date(`${examDate}T${examStartTime}:00`).toISOString();

      const payload = {
        title,
        description,
        duration_minutes: durationMinutes,
        passing_score: passingScore,
        start_time: isoStart,
        questions: questions.map((q, index) => ({
          ...q,
          order_number: index,
        })),
      };

      await api.post("/admin/exams", payload);
      alert("Exam Created Successfully!");
      onComplete();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create exam");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-2xl font-bold">Create Exam</h1>
        </div>
      </header>

      {/* BODY */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* EXAM DETAILS */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Exam Details
            </h2>

            <div className="space-y-4">
              <input
                type="text"
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Exam Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <textarea
                className="w-full px-4 py-2 border rounded-lg"
                rows={3}
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              {/* SCHEDULED DATE & TIME */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Exam Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 border rounded-lg"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <input
                    type="time"
                    className="w-full px-4 py-2 border rounded-lg"
                    value={examStartTime}
                    onChange={(e) => setExamStartTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* DURATION / PASSING SCORE */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Duration (mins)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border rounded-lg"
                    value={durationMinutes}
                    min={1}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border rounded-lg"
                    value={passingScore}
                    min={0}
                    max={100}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* QUESTIONS SECTION */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Questions
              </h2>

              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </div>

            {/* RENDER QUESTIONS */}
            <div className="space-y-6">
              {questions.map((q, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-5 bg-gray-50"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-gray-800">
                      Question #{index + 1}
                    </h3>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => removeQuestion(index)}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  <textarea
                    className="w-full px-4 py-2 border rounded-lg mb-4"
                    placeholder="Question text"
                    value={q.question_text}
                    onChange={(e) =>
                      updateQuestion(index, "question_text", e.target.value)
                    }
                    required
                  />

                  {/* OPTIONS */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="px-3 py-2 border rounded-lg"
                      placeholder="Option A"
                      value={q.option_a}
                      onChange={(e) =>
                        updateQuestion(index, "option_a", e.target.value)
                      }
                      required
                    />

                    <input
                      className="px-3 py-2 border rounded-lg"
                      placeholder="Option B"
                      value={q.option_b}
                      onChange={(e) =>
                        updateQuestion(index, "option_b", e.target.value)
                      }
                      required
                    />

                    <input
                      className="px-3 py-2 border rounded-lg"
                      placeholder="Option C"
                      value={q.option_c}
                      onChange={(e) =>
                        updateQuestion(index, "option_c", e.target.value)
                      }
                      required
                    />

                    <input
                      className="px-3 py-2 border rounded-lg"
                      placeholder="Option D"
                      value={q.option_d}
                      onChange={(e) =>
                        updateQuestion(index, "option_d", e.target.value)
                      }
                      required
                    />
                  </div>

                  {/* CORRECT ANSWER & POINTS */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-sm font-medium">
                        Correct Answer
                      </label>
                      <select
                        className="w-full px-3 py-2 border rounded-lg"
                        value={q.correct_answer}
                        onChange={(e) =>
                          updateQuestion(
                            index,
                            "correct_answer",
                            e.target.value as "A" | "B" | "C" | "D"
                          )
                        }
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Points</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border rounded-lg"
                        value={q.points}
                        onChange={(e) =>
                          updateQuestion(index, "points", Number(e.target.value))
                        }
                        min={1}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold"
          >
            {saving ? "Saving..." : "Create Exam"}
          </button>
        </form>
      </main>
    </div>
  );
}
