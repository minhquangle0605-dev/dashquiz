import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  useStartStudentExam,
  useSaveAnswers,
  useSubmitStudentExam,
} from '@/hooks/useExam';
import type { ExamQuestion, StartExamData } from '@/types/exam';

const AUTO_SAVE_INTERVAL = 30_000;
const WARNING_THRESHOLD = 300;
const CRITICAL_THRESHOLD = 60;

export default function TakeExamPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const examId = Number(id);

  const [examData, setExamData] = useState<StartExamData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pendingSave = useRef<Record<string, number | null>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSubmitted = useRef(false);

  const startMutation = useStartStudentExam();
  const saveMutation = useSaveAnswers();
  const submitMutation = useSubmitStudentExam();

  const attemptId = examData?.attempt.id;
  const questions: ExamQuestion[] = examData?.questions ?? [];
  const currentQuestion = questions[currentIndex];

  // Start or resume exam
  useEffect(() => {
    if (!examId || isNaN(examId)) {
      setError('Invalid exam ID');
      setLoading(false);
      return;
    }

    startMutation.mutate(examId, {
      onSuccess: (res) => {
        const d = res.data;
        setExamData(d);
        setAnswers(d.savedAnswers ?? {});
        setTimeLeft(d.attempt.timeRemainingsSec);
        setLoading(false);
      },
      onError: (err) => {
        setError(err.message || 'Failed to start exam');
        setLoading(false);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  // Countdown timer
  useEffect(() => {
    if (!examData || hasSubmitted.current) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examData]);

  // Auto-save interval
  useEffect(() => {
    if (!attemptId || hasSubmitted.current) return;

    autoSaveRef.current = setInterval(() => {
      performSave();
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  // Online/offline detection
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      performSave();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Warn before leaving
  useEffect(() => {
    if (!examData || hasSubmitted.current) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [examData]);

  const performSave = useCallback(() => {
    if (!attemptId || hasSubmitted.current || !isOnline) {
      pendingSave.current = { ...answers };
      return;
    }
    const toSave = { ...answers, ...pendingSave.current };
    pendingSave.current = {};

    saveMutation.mutate(
      { attemptId, answers: toSave },
      {
        onSuccess: () => setLastSaved(new Date()),
        onError: () => {
          pendingSave.current = { ...pendingSave.current, ...toSave };
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, answers, isOnline]);

  const handleAutoSubmit = useCallback(() => {
    if (!attemptId || hasSubmitted.current) return;
    hasSubmitted.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);

    submitMutation.mutate(
      { attemptId, answers },
      {
        onSuccess: (res) => {
          toast.success('Time is up! Your exam has been submitted automatically.');
          navigate(
            `/student/attempts/${res.data.attemptId}/result`,
            { replace: true },
          );
        },
        onError: () => {
          toast.error('Auto-submit failed. Please try submitting manually.');
          hasSubmitted.current = false;
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, answers, navigate]);

  const handleManualSubmit = () => {
    if (!attemptId || hasSubmitted.current) return;
    hasSubmitted.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    setShowSubmitDialog(false);

    submitMutation.mutate(
      { attemptId, answers },
      {
        onSuccess: (res) => {
          toast.success('Exam submitted successfully!');
          navigate(
            `/student/attempts/${res.data.attemptId}/result`,
            { replace: true },
          );
        },
        onError: () => {
          toast.error('Submit failed. Please try again.');
          hasSubmitted.current = false;
        },
      },
    );
  };

  const selectAnswer = (questionId: number, optionId: number) => {
    setAnswers((prev) => ({
      ...prev,
      [String(questionId)]: optionId,
    }));
  };

  const toggleFlag = (index: number) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const unansweredCount = useMemo(() => {
    return questions.filter(
      (q) => answers[String(q.questionId)] === undefined || answers[String(q.questionId)] === null,
    ).length;
  }, [questions, answers]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Preparing your exam...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !examData) {
    return (
      <div className="mx-auto max-w-lg mt-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-red-800">Cannot Start Exam</h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate('/student/exams')}
          >
            Back to Exams
          </Button>
        </div>
      </div>
    );
  }

  const isWarning = timeLeft <= WARNING_THRESHOLD && timeLeft > CRITICAL_THRESHOLD;
  const isCritical = timeLeft <= CRITICAL_THRESHOLD;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 sm:-m-6">
      {/* Offline warning banner */}
      {!isOnline && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
          <svg className="mr-2 inline h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          You are offline. Your answers are saved locally and will sync when you reconnect.
        </div>
      )}

      {/* Header with timer */}
      <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">
            {examData.exam.title}
          </h1>
          {lastSaved && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-600">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold tabular-nums min-h-[44px] ${
              isCritical
                ? 'bg-red-100 text-red-700 animate-pulse'
                : isWarning
                  ? 'bg-red-50 text-red-600'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(timeLeft)}
          </div>

          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 lg:hidden"
            aria-label="Toggle question navigator"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Question area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            {currentQuestion ? (
              <div className="space-y-6">
                {/* Question counter */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-500">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  {currentQuestion.points > 0 && (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      {Number(currentQuestion.points)} pt{Number(currentQuestion.points) !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-[width] duration-300"
                    style={{
                      width: `${((currentIndex + 1) / questions.length) * 100}%`,
                    }}
                  />
                </div>

                {/* Question content */}
                <div
                  className="text-base leading-relaxed text-slate-800"
                  dangerouslySetInnerHTML={{
                    __html: currentQuestion.content,
                  }}
                />

                {/* Options */}
                <div className="space-y-3">
                  {currentQuestion.options.map((opt) => {
                    const selected =
                      answers[String(currentQuestion.questionId)] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          selectAnswer(currentQuestion.questionId, opt.id)
                        }
                        className={`flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-colors min-h-[44px] ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                            selected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span
                          className={`flex-1 pt-0.5 text-sm leading-relaxed ${
                            selected
                              ? 'text-indigo-900 font-medium'
                              : 'text-slate-700'
                          }`}
                          dangerouslySetInnerHTML={{ __html: opt.content }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500">
                No questions available
              </div>
            )}
          </div>
        </div>

        {/* Sidebar — question navigator (desktop always, mobile toggle) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`fixed right-0 top-0 z-40 h-full w-72 bg-white border-l border-slate-200 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-none ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">
                Questions
              </h2>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
                aria-label="Close navigator"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-slate-200" /> Not answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-indigo-500" /> Answered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-amber-400" /> Flagged
              </span>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, i) => {
                  const answered = answers[String(q.questionId)] != null;
                  const isFlagged = flagged.has(i);
                  const isCurrent = i === currentIndex;

                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(i);
                        setSidebarOpen(false);
                      }}
                      className={`relative flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-colors min-h-[44px] ${
                        isCurrent
                          ? 'ring-2 ring-indigo-500 ring-offset-1'
                          : ''
                      } ${
                        isFlagged
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : answered
                            ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {i + 1}
                      {isFlagged && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Answered</span>
                <span className="font-semibold text-slate-700">
                  {questions.length - unansweredCount} / {questions.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Flagged</span>
                <span className="font-semibold text-slate-700">
                  {flagged.size}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Footer navigation */}
      <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:px-6 shadow-[0_-2px_8px_rgba(0,0,0,.04)]">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="md"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="min-h-[44px]"
          >
            <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Previous
          </Button>
          <Button
            variant="outline"
            size="md"
            disabled={currentIndex === questions.length - 1}
            onClick={() =>
              setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
            }
            className="min-h-[44px]"
          >
            Next
            <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={() => toggleFlag(currentIndex)}
            className="min-h-[44px]"
          >
            {flagged.has(currentIndex) ? (
              <>
                <svg className="mr-1.5 h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-1.81.452A.75.75 0 013 14.175V3A.75.75 0 013.75 2.25z" clipRule="evenodd" />
                </svg>
                Unflag
              </>
            ) : (
              <>
                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
                Flag
              </>
            )}
          </Button>

          <Button
            variant="danger"
            size="md"
            onClick={() => setShowSubmitDialog(true)}
            isLoading={submitMutation.isPending}
            className="min-h-[44px]"
          >
            Submit Exam
          </Button>
        </div>
      </footer>

      {/* Submit confirmation dialog */}
      <Modal
        isOpen={showSubmitDialog}
        onClose={() => setShowSubmitDialog(false)}
        title="Submit Exam"
        size="sm"
      >
        <div className="space-y-4">
          {unansweredCount > 0 ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    You have {unansweredCount} unanswered question
                    {unansweredCount > 1 ? 's' : ''}
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    Once submitted, you cannot change your answers.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              You have answered all {questions.length} questions. Are you sure
              you want to submit?
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setShowSubmitDialog(false)}
              className="min-h-[44px]"
            >
              Go Back
            </Button>
            <Button
              variant="primary"
              onClick={handleManualSubmit}
              isLoading={submitMutation.isPending}
              className="min-h-[44px]"
            >
              Confirm Submit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
