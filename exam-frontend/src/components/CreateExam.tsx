import { useEffect, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  ListChecks,
  LayoutList,
  ChevronDown,
  ChevronUp,
  Filter,
  Wand2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";
import Papa from "papaparse";

type QuestionBankItem = {
  subject: string;
  complexity: string;
  topic: string;
  type: string;
  question: string;
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
  correct?: string;
};

export function CreateExam({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);

  // BASIC EXAM META
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // BANK DATA
  const [questionBank, setQuestionBank] = useState<QuestionBankItem[]>([]);
  const [uniqueSubjects, setUniqueSubjects] = useState<string[]>([]);
  const [uniqueTopics, setUniqueTopics] = useState<string[]>([]);

  // FILTERS
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  // EXAM GENERATION SETTINGS
  const [totalQuestions, setTotalQuestions] = useState(40);

  const [complexity, setComplexity] = useState({
    easy: 40,
    medium: 40,
    hard: 20
  });

  const [quickStart, setQuickStart] = useState(true);

  // GENERATED QUESTIONS
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionBankItem[]>([]);
  const [generating, setGenerating] = useState(false);

  // ========================================================
  // STEP 1: Upload Excel (CSV-compatible for now)
  // ========================================================

  const handleExcelUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res: any) => {
        const rows = res.data as QuestionBankItem[];
        setQuestionBank(rows);

        const subjects = [...new Set(rows.map((r) => r.subject))];
        const topics = [...new Set(rows.map((r) => r.topic))];

        setUniqueSubjects(subjects);
        setUniqueTopics(topics);
      }
    });
  };

  // ========================================================
  // STEP 2: Select subject + topics
  // ========================================================

  const toggleTopic = (t: string) => {
    if (selectedTopics.includes(t)) {
      setSelectedTopics(selectedTopics.filter((x) => x !== t));
    } else {
      setSelectedTopics([...selectedTopics, t]);
    }
  };

  // ========================================================
  // STEP 3: Auto-generate questions
  // ========================================================

  const autoGenerate = () => {
    if (!selectedSubject) {
      alert("Choose a subject first");
      return;
    }
    if (selectedTopics.length === 0) {
      alert("Choose at least one topic");
      return;
    }

    setGenerating(true);

    setTimeout(() => {
      const filtered = questionBank.filter(
        (q) =>
          q.subject === selectedSubject &&
          selectedTopics.includes(q.topic)
      );

      const easy = filtered.filter((q) => q.complexity.toLowerCase() === "easy");
      const medium = filtered.filter((q) => q.complexity.toLowerCase() === "medium");
      const hard = filtered.filter((q) => q.complexity.toLowerCase() === "hard");

      const pick = (arr: QuestionBankItem[], count: number) => {
        return arr.sort(() => 0.5 - Math.random()).slice(0, count);
      };

      const easyCount = Math.floor((complexity.easy / 100) * totalQuestions);
      const medCount = Math.floor((complexity.medium / 100) * totalQuestions);
      const hardCount = totalQuestions - easyCount - medCount;

      const generated = [
        ...pick(easy, easyCount),
        ...pick(medium, medCount),
        ...pick(hard, hardCount)
      ];

      setGeneratedQuestions(generated);
      setGenerating(false);
      setStep(4);
    }, 800);
  };

  // ========================================================
  // STEP 4: Save exam (API later)
  // ========================================================

  const saveExam = () => {
    alert("Exam Saved Successfully.\nBackend integration will be added next.");
    onComplete();
  };

  const downloadTemplate = () => {
    const csv =
      `subject,complexity,topic,type,question,option1,option2,option3,option4,correct
Math,easy,Algebra,single-choice,What is 2+2?,2,3,4,5,4`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "question_bank_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };


  // ========================================================
  // UI STEPS
  // ========================================================

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* HEADER */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Create University Exam</h1>

          <button
            onClick={onCancel}
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            Cancel
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 mt-10 space-y-10">
        {/* ============================================= */}
        {/* STEP INDICATOR */}
        {/* ============================================= */}
        <div className="flex items-center justify-between text-sm font-medium">
          <span className={step >= 1 ? "text-blue-600" : "text-gray-400"}>
            1. Upload Question Bank
          </span>
          <span className={step >= 2 ? "text-blue-600" : "text-gray-400"}>
            2. Select Subject
          </span>
          <span className={step >= 3 ? "text-blue-600" : "text-gray-400"}>
            3. Configure Exam
          </span>
          <span className={step >= 4 ? "text-blue-600" : "text-gray-400"}>
            4. Preview & Save
          </span>
        </div>

        {/* ============================================= */}
        {/* STEP 1: UPLOAD BANK */}
        {/* ============================================= */}
        {step === 1 && (

          <div className="bg-white shadow-lg rounded-xl p-8 space-y-6">
            <button
              onClick={downloadTemplate}
              className="w-full bg-gray-700 text-white py-3 rounded-lg hover:bg-gray-800 font-medium flex items-center justify-center gap-2"
            >
              Download Excel Template <FileSpreadsheet className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-semibold">Upload Question Bank</h2>

            <label className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
              <Upload className="w-12 h-12 text-gray-500 mb-3" />
              <p className="text-gray-600">
                Upload Excel/CSV file of the question bank
              </p>

              <input
                type="file"
                accept=".csv, .xlsx"
                onChange={handleExcelUpload}
                className="hidden"
              />
            </label>

            {questionBank.length > 0 && (
              <button
                onClick={() => setStep(2)}
                className="mt-5 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
              >
                Continue <FileSpreadsheet className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ============================================= */}
        {/* STEP 2: SUBJECT + TOPICS */}
        {/* ============================================= */}
        {step === 2 && (
          <div className="bg-white shadow-lg rounded-xl p-8 space-y-6">
            <h2 className="text-lg font-semibold">Choose Subject & Topics</h2>

            {/* SUBJECT */}
            <div>
              <label className="font-medium block mb-2">Subject</label>
              <select
                className="w-full border rounded-lg px-4 py-2"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">Select subject</option>
                {uniqueSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* TOPICS */}
            <div>
              <label className="font-medium block mb-2">Topics</label>

              <div className="grid grid-cols-2 gap-3">
                {uniqueTopics.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTopic(t)}
                    className={`px-3 py-2 rounded-lg border text-sm ${selectedTopics.includes(t)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-100 border-gray-300"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
            >
              Continue <ListChecks className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ============================================= */}
        {/* STEP 3: CONFIGURE EXAM */}
        {/* ============================================= */}
        {step === 3 && (
          <div className="bg-white shadow-lg rounded-xl p-8 space-y-6">
            <h2 className="text-lg font-semibold">Configure Exam</h2>

            {/* TOTAL QUESTIONS */}
            <div>
              <label className="block font-medium mb-2">
                Total Questions
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-4 py-2"
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(Number(e.target.value))}
              />
            </div>

            {/* QUICK START */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={quickStart}
                onChange={() => setQuickStart(!quickStart)}
              />
              <span className="font-medium">
                Quick Start (Auto complexity and topics)
              </span>
            </div>

            {/* COMPLEXITY SLIDERS */}
            {!quickStart && (
              <>
                <label className="block font-medium">Complexity %</label>

                {["easy", "medium", "hard"].map((level) => (
                  <div key={level} className="mb-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize">{level}</span>
                      <span>{complexity[level]}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={complexity[level]}
                      onChange={(e) =>
                        setComplexity({
                          ...complexity,
                          [level]: Number(e.target.value)
                        })
                      }
                      className="w-full"
                    />
                  </div>
                ))}
              </>
            )}

            <button
              onClick={autoGenerate}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  Auto Generate Questions <Wand2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}

        {/* ============================================= */}
        {/* STEP 4: PREVIEW & SAVE */}
        {/* ============================================= */}
        {step === 4 && (
          <div className="bg-white shadow-lg rounded-xl p-8 space-y-6">
            <h2 className="text-lg font-semibold">Preview Questions</h2>

            <div className="max-h-[400px] overflow-y-auto border rounded-xl p-5 bg-gray-50">
              {generatedQuestions.map((q, i) => (
                <div
                  key={i}
                  className="mb-4 p-4 bg-white border rounded-lg shadow-sm"
                >
                  <div className="flex justify-between">
                    <p className="font-medium">{i + 1}. {q.question}</p>
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded-lg">{q.complexity}</span>
                  </div>

                  <ul className="text-sm text-gray-700 mt-2 ml-4 list-disc">
                    {q.option1 && <li>{q.option1}</li>}
                    {q.option2 && <li>{q.option2}</li>}
                    {q.option3 && <li>{q.option3}</li>}
                    {q.option4 && <li>{q.option4}</li>}
                  </ul>
                </div>
              ))}
            </div>

            <button
              onClick={saveExam}
              className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
            >
              Save Exam <CheckCircle2 className="w-5 h-5" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
