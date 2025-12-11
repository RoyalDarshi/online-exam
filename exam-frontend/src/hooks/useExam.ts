// src/hooks/useExam.ts
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import api from "../lib/api";
import { useProctoring, requestFullScreen } from "../hooks/useProctoring";
import { Exam, Question } from "../types/models";

export const MAX_WARNINGS = 3;
const SNAPSHOT_INTERVAL = 30000;

const getSectionName = (q: Question): string => {
    const anyQ: any = q;
    return anyQ.section || anyQ.section_name || anyQ.topic || "General";
};

export type ExamStatus = "loading" | "idle" | "active" | "submitting" | "error";
export type SaveStatus = "saved" | "saving" | "error";
export type TextSize = "sm" | "base" | "lg" | "xl";
export type PaletteFilter = "all" | "unanswered" | "marked";

export type UseExamResult = {
    // state
    questions: Question[];
    answers: Record<string, string>;
    markedForReview: Set<string>;
    visited: Set<string>;
    attemptId: string | null;
    timeLeft: number;
    currentQIndex: number;
    status: ExamStatus;
    warnings: number;
    isFullScreen: boolean;
    errorMessage: string | null;
    textSize: TextSize;
    paletteFilter: PaletteFilter;
    saveStatus: SaveStatus;
    showSubmitModal: boolean;
    showQuestionPaper: boolean;
    activeSection: string | null;
    // derived
    currentQuestion: Question | null;
    sections: string[];
    filteredQuestions: (Question & { originalIdx: number; _section: string })[];
    progressPercent: number;
    // handlers
    setTextSize: (s: TextSize) => void;
    setPaletteFilter: (f: PaletteFilter) => void;
    setCurrentQIndex: (i: number) => void;
    setActiveSection: (s: string | null) => void;
    setShowQuestionPaper: (b: boolean) => void;
    toggleMarkCurrent: () => void;
    handleOptionClick: (qId: string, opt: string) => void;
    clearCurrentAnswer: () => void;
    goNext: () => void;
    goPrevious: () => void;
    openSubmitModal: () => void;
    closeSubmitModal: () => void;
    confirmSubmit: (reason?: string) => Promise<void>;
};

export const useExam = (
    exam: Exam,
    onComplete: () => void
): UseExamResult => {
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
    const [visited, setVisited] = useState<Set<string>>(new Set());

    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [currentQIndex, setCurrentQIndex] = useState(0);

    const [status, setStatus] = useState<ExamStatus>("loading");
    const [warnings, setWarnings] = useState(0);
    const [isFullScreen, setIsFullScreen] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [textSize, setTextSize] = useState<TextSize>("base");
    const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>("all");

    const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showQuestionPaper, setShowQuestionPaper] = useState(false);
    const [activeSection, setActiveSection] = useState<string | null>(null);

    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const answersRef = useRef(answers);
    const warningsRef = useRef(warnings);

    useEffect(() => {
        answersRef.current = answers;
    }, [answers]);
    useEffect(() => {
        warningsRef.current = warnings;
    }, [warnings]);

    // --- Init exam & attempt ---
    useEffect(() => {
        let isMounted = true;
        async function initExam() {
            try {
                const examRes = await api.get(`/exams/${exam.id}`);
                if (!isMounted) return;

                const qs: Question[] = examRes.data.questions || [];
                setQuestions(qs);
                if (qs.length > 0) {
                    setVisited(new Set([qs[0].id]));
                    setActiveSection(getSectionName(qs[0]));
                }

                const attemptRes = await api.post("/attempts/start", {
                    exam_id: exam.id,
                });
                if (!isMounted) return;

                const attempt = attemptRes.data;
                setAttemptId(attempt.id);

                if (attempt.answers) setAnswers(attempt.answers);
                if (attempt.time_left) setTimeLeft(attempt.time_left);
                if (attempt.tab_switches) setWarnings(attempt.tab_switches);

                if (attempt.submitted_at || attempt.is_terminated) {
                    onComplete();
                    return;
                }

                if (!document.fullscreenElement) {
                    try {
                        await requestFullScreen();
                    } catch {
                        // user denied
                    }
                }

                setStatus("active");
            } catch (err: any) {
                if (isMounted) {
                    setErrorMessage(err?.response?.data?.error || "Failed to load exam.");
                    setStatus("error");
                }
            }
        }

        initExam();
        return () => {
            isMounted = false;
        };
    }, [exam.id, onComplete]);

    // --- Track visitation ---
    useEffect(() => {
        if (questions[currentQIndex]) {
            setVisited((prev) => {
                const next = new Set(prev);
                next.add(questions[currentQIndex].id);
                return next;
            });
        }
    }, [currentQIndex, questions]);

    // --- Keep active section in sync ---
    useEffect(() => {
        if (questions.length && currentQIndex >= 0 && currentQIndex < questions.length) {
            setActiveSection(getSectionName(questions[currentQIndex]));
        }
    }, [currentQIndex, questions]);

    // --- Timer & keyboard navigation ---
    useEffect(() => {
        if (status !== "active") return;
        if (timeLeft <= 0) {
            if (timeLeft === 0 && questions.length > 0) {
                // time over → force submit
                setShowSubmitModal(false);
                setStatus("submitting");
                (async () => {
                    await confirmSubmit("Time Limit");
                })();
            }
            return;
        }
        const timer = setInterval(
            () => setTimeLeft((prev) => Math.max(0, prev - 1)),
            1000
        );
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLTextAreaElement) return;
            if (e.key === "ArrowRight") {
                setCurrentQIndex((prev) => Math.min(prev + 1, questions.length - 1));
            }
            if (e.key === "ArrowLeft") {
                setCurrentQIndex((prev) => Math.max(0, prev - 1));
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            clearInterval(timer);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [timeLeft, status, questions.length]);

    // --- Save to backend ---
    const saveToBackend = useCallback(
    async (currentAnswers: Record<string, string>) => {
        if (!attemptId) return;

        let showSaving = true;

        // Start a 1.5s timer to show "saving"
        const timer = setTimeout(() => {
            if (showSaving) {
                setSaveStatus("saving");
            }
        }, 1000);

        try {
            // API call
            await api.post("/progress", {
                attempt_id: attemptId,
                tab_switches: warningsRef.current,
                answers: currentAnswers,
                snapshot: "",
            });

            // API done → stop UI from setting saving
            showSaving = false;
            clearTimeout(timer);

            setSaveStatus("saved"); // only appears if saving was shown OR after success
        } catch (error) {
            showSaving = false;
            clearTimeout(timer);
            setSaveStatus("error");
        }
    },
    [attemptId]
);


    // --- Periodic snapshot ---
    useEffect(() => {
        if (status !== "active") return;
        const interval = setInterval(
            () => saveToBackend(answersRef.current),
            SNAPSHOT_INTERVAL
        );
        return () => clearInterval(interval);
    }, [status, saveToBackend]);

    // --- Proctoring violations ---
    const handleViolation = useCallback(
        (type: string) => {
            if (status !== "active") return;
            setWarnings((prev) => {
                const newW = prev + 1;
                saveToBackend(answersRef.current);
                if (newW >= MAX_WARNINGS) {
                    setShowSubmitModal(false);
                    setStatus("submitting");
                    (async () => {
                        await confirmSubmit(`Violation: ${type}`);
                    })();
                }
                return newW;
            });
        },
        [status, saveToBackend]
    );

    useProctoring({ isActive: status === "active", onViolation: handleViolation });

    // --- Fullscreen watcher ---
    useEffect(() => {
        const fsHandler = () => {
            const full = !!document.fullscreenElement;
            setIsFullScreen(full);
            if (!full && status === "active") handleViolation("fullscreen_exit");
        };
        document.addEventListener("fullscreenchange", fsHandler);
        return () => document.removeEventListener("fullscreenchange", fsHandler);
    }, [status, handleViolation]);

    // --- Answer interactions ---
    const handleOptionClick = (qId: string, opt: string) => {
        if (status !== "active") return;
        const q = questions.find((qq) => qq.id === qId);
        if (!q) return;

        let newVal = "";
        if (q.type === "multi-select") {
            const currentRaw = answers[qId] || "";
            let currentOpts = currentRaw ? currentRaw.split(",") : [];
            if (currentOpts.includes(opt)) {
                currentOpts = currentOpts.filter((o) => o !== opt);
            } else {
                currentOpts.push(opt);
            }
            newVal = currentOpts.sort().join(",");
        } else {
            newVal = opt;
        }

        const newAnswers = { ...answers, [qId]: newVal };
        setAnswers(newAnswers);

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(
            () => saveToBackend(newAnswers),
            1000
        );
    };

    const clearCurrentAnswer = () => {
        const q = questions[currentQIndex];
        if (!q) return;
        const newAns = { ...answers };
        delete newAns[q.id];
        setAnswers(newAns);
        saveToBackend(newAns);
    };

    const goNext = () => {
        setCurrentQIndex((i) => Math.min(i + 1, questions.length - 1));
    };

    const goPrevious = () => {
        setCurrentQIndex((i) => Math.max(i - 1, 0));
    };

    const toggleMarkCurrent = () => {
        const q = questions[currentQIndex];
        if (!q) return;
        setMarkedForReview((prev) => {
            const next = new Set(prev);
            if (next.has(q.id)) next.delete(q.id);
            else next.add(q.id);
            return next;
        });
    };

    // --- Submission ---
    const openSubmitModal = () => {
        if (status !== "active") return;
        setShowSubmitModal(true);
    };

    const closeSubmitModal = () => setShowSubmitModal(false);

    const confirmSubmit = async (reason?: string) => {
        if (!attemptId) return;
        try {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            await saveToBackend(answersRef.current);
            await api.post("/attempts/submit", { attempt_id: attemptId, reason });
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => { });
            }
            onComplete();
            await fetch("http://localhost:12345/exit", {
                method: "POST"
            });

            alert("Exam Completed");
        } catch {
            setErrorMessage("Submission failed. Please check connection.");
            setStatus("active");
        }
    };

    // --- Derived ---
    const currentQuestion = questions[currentQIndex] || null;

    const sections = useMemo(() => {
        if (!questions.length) return [] as string[];
        return Array.from(new Set(questions.map((q) => getSectionName(q))));
    }, [questions]);

    const filteredQuestions = useMemo(() => {
        return questions
            .map((q, idx) => ({
                ...q,
                originalIdx: idx,
                _section: getSectionName(q),
            }))
            .filter((q) => {
                if (activeSection && q._section !== activeSection) return false;
                if (paletteFilter === "unanswered") return !answers[q.id];
                if (paletteFilter === "marked") return markedForReview.has(q.id);
                return true;
            });
    }, [questions, activeSection, paletteFilter, answers, markedForReview]);

    const progressPercent =
        questions.length === 0
            ? 0
            : (Object.keys(answers).length / questions.length) * 100;

    return {
        questions,
        answers,
        markedForReview,
        visited,
        attemptId,
        timeLeft,
        currentQIndex,
        status,
        warnings,
        isFullScreen,
        errorMessage,
        textSize,
        paletteFilter,
        saveStatus,
        showSubmitModal,
        showQuestionPaper,
        activeSection,
        currentQuestion,
        sections,
        filteredQuestions,
        progressPercent,
        setTextSize,
        setPaletteFilter,
        setCurrentQIndex,
        setActiveSection,
        setShowQuestionPaper,
        toggleMarkCurrent,
        handleOptionClick,
        clearCurrentAnswer,
        goNext,
        goPrevious,
        openSubmitModal,
        closeSubmitModal,
        confirmSubmit,
    };
};
