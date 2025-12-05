import { useState } from 'react';
import api from '../lib/api'; // Use your new Axios client
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

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
  correct_answer: 'A' | 'B' | 'C' | 'D';
  points: number;
};

export function CreateExam({ onComplete, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [passingScore, setPassingScore] = useState(60);
  const [questions, setQuestions] = useState<QuestionInput[]>([
    {
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      points: 1,
    },
  ]);
  const [saving, setSaving] = useState(false);

  function addQuestion() {
    setQuestions([
      ...questions,
      {
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A',
        points: 1,
      },
    ]);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function updateQuestion(index: number, field: keyof QuestionInput, value: string | number) {
    const updated = [...questions];
    // @ts-ignore - Dynamic assignment
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (questions.length === 0) {
      alert('Please add at least one question');
      return;
    }

    // Basic Validation
    const invalidQuestions = questions.filter(
      q => !q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d
    );

    if (invalidQuestions.length > 0) {
      alert('Please fill in all question fields');
      return;
    }

    setSaving(true);

    try {
      // 1. Construct the payload
      // Go backend expects { title: "...", questions: [...] }
      const payload = {
        title,
        description,
        duration_minutes: durationMinutes,
        passing_score: passingScore,
        // We map questions to add the 'order_number' required by backend
        questions: questions.map((q, index) => ({
          ...q,
          order_number: index
        }))
      };

      // 2. Send single POST request
      // The Go/GORM backend handles inserting Exam AND Questions together
      await api.post('/admin/exams', payload);

      onComplete();
    } catch (error: any) {
      console.error('Error creating exam:', error);
      const msg = error.response?.data?.error || 'Failed to create exam';
      alert(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Create New Exam</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* EXAM DETAILS CARD */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Exam Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    min={1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passing Score (%)
                  </label>
                  <input
                    type="number"
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    min={0}
                    max={100}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* QUESTIONS LIST */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Questions</h2>
              <button
                type="button"
                onClick={addQuestion}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Question
              </button>
            </div>

            {questions.map((question, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-semibold text-gray-900">
                    Question {index + 1}
                  </h3>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Text
                    </label>
                    <textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(index, 'question_text', e.target.value)}
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {['A', 'B', 'C', 'D'].map(option => (
                      <div key={option}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Option {option}
                        </label>
                        <input
                          type="text"
                          value={question[`option_${option.toLowerCase()}` as keyof QuestionInput] as string}
                          onChange={(e) =>
                            updateQuestion(index, `option_${option.toLowerCase()}` as keyof QuestionInput, e.target.value)
                          }
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Correct Answer
                      </label>
                      <select
                        value={question.correct_answer}
                        onChange={(e) =>
                          updateQuestion(index, 'correct_answer', e.target.value)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        required
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Points
                      </label>
                      <input
                        type="number"
                        value={question.points}
                        onChange={(e) =>
                          updateQuestion(index, 'points', Number(e.target.value))
                        }
                        min={1}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 text-gray-700 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Exam'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}