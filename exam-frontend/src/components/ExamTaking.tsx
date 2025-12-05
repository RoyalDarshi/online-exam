import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { Exam, Question } from '../lib/supabase';
import { useProctoring, requestFullScreen } from '../hooks/useProctoring';
import {
  Clock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Maximize,
  AlertOctagon,
  ShieldAlert
} from 'lucide-react';

type Props = {
  exam: Exam;
  onComplete: () => void;
  onCancel: () => void;
};

const MAX_WARNINGS = 3;
const SNAPSHOT_INTERVAL = 30000;
const FACE_CHECK_INTERVAL = 5000; // ms

// For TS: declare optional FaceDetector on window
declare global {
  interface Window {
    FaceDetector?: any;
  }
}

export function ExamTaking({ exam, onComplete, onCancel }: Props) {
  // --- STATE ---
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptId, setAttemptId] = useState<string | null>(null);

  const [timeLeft, setTimeLeft] = useState(exam.duration_minutes * 60);
  const [status, setStatus] = useState<'loading' | 'idle' | 'active' | 'submitting'>('loading');

  const [isFullScreen, setIsFullScreen] = useState(true);
  const [faceDetected, setFaceDetected] = useState(true);

  // Proctoring
  const [warnings, setWarnings] = useState(0);
  const [cameraAccess, setCameraAccess] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- HOOKS ---
  useProctoring({
    isActive: status === 'active',
    onViolation: (type) => handleViolation(type)
  });

  // 1. Load Questions
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const response = await api.get(`/exams/${exam.id}`);
        if (response.data.questions) {
          setQuestions(response.data.questions);
          setStatus('idle');
        }
      } catch (error) {
        alert('Failed to load exam data.');
        onCancel();
      }
    };
    loadQuestions();
    return () => stopCamera();
  }, []);

  // 2. Timer
  useEffect(() => {
    if (status !== 'active') return;
    if (timeLeft <= 0) {
      finishExam();
      return;
    }

    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, status]);

  // 3. Fullscreen Watcher
  useEffect(() => {
    if (status !== 'active') return;

    const handleScreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullScreen(isFull);
      if (!isFull) handleViolation('fullscreen_exit');
    };

    document.addEventListener('fullscreenchange', handleScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleScreenChange);
  }, [status]);

  // 4. Auto-Save Snapshot
  useEffect(() => {
    if (status !== 'active' || !attemptId) return;

    const interval = setInterval(async () => {
      const snapshot = captureSnapshot();
      try {
        await api.post('/progress', {
          attempt_id: attemptId,
          answers,
          tab_switches: warnings,
          snapshot
        });
      } catch {
        // ignore
      }
    }, SNAPSHOT_INTERVAL);

    return () => clearInterval(interval);
  }, [status, attemptId, answers, warnings]);

  // 5. Tab Switch Monitoring (visibility + blur)
  useEffect(() => {
    if (status !== 'active') return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('tab_switch');
      }
    };

    const onBlur = () => {
      // window lost focus (alt+tab, etc.)
      handleViolation('window_blur');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [status]);

  // 6. Keyboard Shortcut Restrictions (copy/print/devtools/etc.)
  useEffect(() => {
    if (status !== 'active') return;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Common shortcuts: refresh, print, save, view source, copy, paste, cut, select all
      if (
        (e.ctrlKey || e.metaKey) &&
        ['r', 'p', 's', 'u', 'c', 'v', 'x', 'a'].includes(key)
      ) {
        e.preventDefault();
        handleViolation('keyboard_shortcut');
      }

      // DevTools: F12 or Ctrl+Shift+I
      if (key === 'f12' || (e.ctrlKey && e.shiftKey && key === 'i')) {
        e.preventDefault();
        handleViolation('devtools');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status]);

  // 7. Face Detection (if browser supports FaceDetector)
  useEffect(() => {
    if (status !== 'active') return;
    if (!window.FaceDetector) {
      console.warn('FaceDetector API not supported in this browser.');
      return;
    }

    const detector = new window.FaceDetector({ fastMode: true });

    const interval = setInterval(async () => {
      try {
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        const faces = await detector.detect(videoRef.current);

        setFaceDetected((prev) => {
          const hasFace = !!faces && faces.length > 0;

          // Trigger violation only on transition from "had face" -> "no face"
          if (!hasFace && prev) {
            handleViolation('no_face_detected');
          }

          return hasFace;
        });
      } catch (err) {
        console.warn('Face detection error:', err);
      }
    }, FACE_CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, [status]);

  // --- ACTIONS ---

  const handleAnswerSelect = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const newAnswers = { ...prev, [questionId]: option };

      if (attemptId) {
        api
          .post('/progress', {
            attempt_id: attemptId,
            answers: newAnswers,
            tab_switches: warnings,
            snapshot: ''
          })
          .catch(() => { });
      }
      return newAnswers;
    });
  };

  // System check now just starts exam (no ExamGuard)
  const performSystemCheck = async () => {
    // Always "pass"
    startExamSequence();
  };

  const startExamSequence = async () => {
    try {
      if (!cameraAccess) await startCamera();
      await requestFullScreen();
      setIsFullScreen(true);

      const response = await api.post('/attempts/start', { exam_id: exam.id });
      setAttemptId(response.data.id);
      setStatus('active');
    } catch (error) {
      alert('Could not start exam. Ensure camera is allowed.');
    }
  };

  const finishExam = async () => {
    if (status === 'submitting') return;

    setStatus('submitting');
    stopCamera();

    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      // ignore
    }

    try {
      await api.post('/attempts/submit', { attempt_id: attemptId });
      alert('Exam Submitted Successfully!');
      onComplete();
    } catch {
      alert('Error submitting exam. Progress saved.');
      onComplete();
    }
  };

  const handleViolation = (type: string) => {
    const newWarnings = warnings + 1;
    setWarnings(newWarnings);

    if (attemptId) {
      api
        .post('/progress', {
          attempt_id: attemptId,
          tab_switches: newWarnings,
          answers
        })
        .catch(console.error);
    }

    console.warn('Violation detected:', type);

    if (newWarnings >= MAX_WARNINGS) {
      alert('Maximum violations reached. Exam terminated.');
      finishExam();
    }
  };

  // CAMERA HELPERS
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraAccess(true);
    } catch {
      throw new Error('Camera denied');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
  };

  const captureSnapshot = (): string => {
    if (!videoRef.current) return '';
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, 320, 240);
    return canvas.toDataURL('image/jpeg', 0.5);
  };

  // --- RENDER ---

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  // ----------------------------------
  // IDLE SCREEN (BEFORE START)
  // ----------------------------------
  if (status === 'idle') {
    return (
      <div
        className="min-h-screen bg-gray-900 flex items-center justify-center p-4"
        // Anti-copy / anti-context menu
        onContextMenu={(e) => e.preventDefault()}
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
      >
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-2">{exam.title}</h1>

          <div className="relative bg-black rounded-lg overflow-hidden aspect-video mb-6">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!cameraAccess && (
              <div className="absolute inset-0 flex items-center justify-center text-white/50">
                Camera Preview
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 mb-6 text-left">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> System Check
            </h3>

            <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-bold text-green-700 text-sm">System Secure</p>
                <p className="text-xs text-green-700 mt-1">
                  Copy, print, shortcuts & tab switch will be monitored during the exam.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {!cameraAccess ? (
              <button
                onClick={() => startCamera().catch(() => alert('Camera Required'))}
                className="w-full bg-gray-800 text-white py-3 rounded-lg font-bold"
              >
                Enable Camera
              </button>
            ) : (
              <button
                onClick={performSystemCheck}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold"
              >
                START EXAM
              </button>
            )}

            <button
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------
  // ACTIVE EXAM SCREEN
  // ----------------------------------

  return (
    <div
      className="min-h-screen bg-gray-50 select-none relative"
      // Anti-copy / anti-context menu
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => {
        e.preventDefault();
        handleViolation('copy');
      }}
      onCut={(e) => {
        e.preventDefault();
        handleViolation('cut');
      }}
      onPaste={(e) => {
        e.preventDefault();
        handleViolation('paste');
      }}
    >
      <video ref={videoRef} autoPlay muted className="fixed opacity-0 pointer-events-none" />

      {/* Fullscreen Curtain */}
      {!isFullScreen && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-8 text-center">
          <div className="bg-red-50 p-10 rounded-2xl border-4 border-red-500 shadow-2xl max-w-lg animate-pulse">
            <AlertOctagon className="w-24 h-24 text-red-600 mx-auto mb-6" />
            <h1 className="text-4xl font-black text-red-700 mb-4">EXAM PAUSED</h1>
            <p className="text-xl text-gray-800 mb-8 font-medium">
              You have exited Full Screen mode.
            </p>

            <button
              onClick={() => {
                requestFullScreen();
                setIsFullScreen(true);
              }}
              className="bg-red-600 text-white text-xl px-8 py-4 rounded-xl font-bold hover:bg-red-700 shadow-lg w-full flex items-center justify-center gap-3"
            >
              <Maximize className="w-6 h-6" /> RETURN TO EXAM
            </button>
          </div>
        </div>
      )}

      <div className={!isFullScreen ? 'opacity-0 pointer-events-none' : ''}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 shadow-sm z-50">
          <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-900">{exam.title}</h2>

              <div
                className={`text-xs font-bold mt-1 flex items-center gap-2 ${warnings > 0 ? 'text-red-600' : 'text-green-600'
                  }`}
              >
                {warnings > 0 && <AlertTriangle className="w-3 h-3" />}
                <span>Violations: {warnings}/{MAX_WARNINGS}</span>
                {!faceDetected && (
                  <span className="ml-3 text-red-600">
                    (No face detected – stay in camera view)
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 font-mono text-xl font-bold text-blue-600">
                <Clock className="w-5 h-5" />
                {Math.floor(timeLeft / 60)}:
                {(timeLeft % 60).toString().padStart(2, '0')}
              </div>

              <button
                onClick={finishExam}
                disabled={status === 'submitting'}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="max-w-4xl mx-auto px-4 py-8 pb-32 space-y-6">
          {questions.map((q, index) => (
            <div
              key={q.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>

                <div className="flex-1">
                  <p className="text-lg font-medium text-gray-900 mb-4">
                    {q.question_text}
                  </p>

                  <div className="space-y-3">
                    {['A', 'B', 'C', 'D'].map((option) => (
                      <label
                        key={option}
                        className={`
                          flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${answers[q.id] === option
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={option}
                          checked={answers[q.id] === option}
                          onChange={() => handleAnswerSelect(q.id, option)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-gray-700">
                          <span className="font-semibold mr-2">{option}.</span>
                          {q[`option_${option.toLowerCase()}` as keyof Question] as string}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
