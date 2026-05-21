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
import { Spinner } from '@/components/ui/Spinner';
import { CLIENT_SOCKET_EVENTS } from '@/constants/socketEvents';
import {
  useStartStudentExam,
  useSaveAnswers,
  useSubmitStudentExam,
} from '@/hooks/useExam';
import { useSocketContext } from '@/providers/SocketProvider';
import { recordAttemptEvent } from '@/services/studentExam.api';
import type {
  ExamQuestion,
  RecordAttemptEventPayload,
  StartExamData,
  StudentAnswerValue,
} from '@/types/exam';

import { ExamBanners } from './take-exam/ExamBanners';
import { ExamHeader } from './take-exam/ExamHeader';
import { QuestionPanel } from './take-exam/QuestionPanel';
import { QuestionNavigator } from './take-exam/QuestionNavigator';
import { ExamFooter } from './take-exam/ExamFooter';
import { SubmitDialog } from './take-exam/SubmitDialog';

const AUTO_SAVE_INTERVAL = 30_000;
const MONITORING_HEARTBEAT_INTERVAL = 30_000;
const WARNING_THRESHOLD = 300;
const CRITICAL_THRESHOLD = 60;
const TAB_SWITCH_WARN_LIMIT = 3;

function getAnsweredCount(
  questions: ExamQuestion[],
  answers: Record<string, StudentAnswerValue>,
) {
  return questions.length - questions.filter((q) => {
    const answer = answers[String(q.questionId)];
    if (answer === undefined || answer === null) return true;
    if (Array.isArray(answer)) return answer.length === 0;
    if (typeof answer === 'string') return answer.trim().length === 0;
    if (typeof answer === 'object') {
      const pairLabels = q.options
        .filter((opt) => opt.content.includes('=>'))
        .map((opt) => opt.label);
      if (pairLabels.length === 0) return false;
      return pairLabels.some((label) => !String(answer[label] || '').trim());
    }
    return false;
  }).length;
}

export default function TakeExamPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const examId = Number(id);

  const [examData, setExamData] = useState<StartExamData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswerValue>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);

  const pendingSave = useRef<Record<string, StudentAnswerValue>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSubmitted = useRef(false);
  const handleAutoSubmitRef = useRef<() => void>(() => {});

  const startMutation = useStartStudentExam();
  const saveMutation = useSaveAnswers();
  const submitMutation = useSubmitStudentExam();
  const { socket } = useSocketContext();

  const attemptId = examData?.attempt.id;
  const questions: ExamQuestion[] = examData?.questions ?? [];
  const currentQuestion = questions[currentIndex];
  const monitoringRef = useRef({
    answers,
    questions,
    timeLeft,
    currentQuestionId: currentQuestion?.questionId ?? null,
    flaggedCount: flagged.size,
    tabSwitchCount,
  });

  monitoringRef.current = {
    answers,
    questions,
    timeLeft,
    currentQuestionId: currentQuestion?.questionId ?? null,
    flaggedCount: flagged.size,
    tabSwitchCount,
  };

  const buildMonitoringMetadata = useCallback((extra?: Record<string, unknown>) => {
    const snapshot = monitoringRef.current;
    const answeredCount = getAnsweredCount(snapshot.questions, snapshot.answers);
    return {
      answeredCount,
      unansweredCount: Math.max(0, snapshot.questions.length - answeredCount),
      totalQuestions: snapshot.questions.length,
      timeRemainingSec: snapshot.timeLeft,
      currentQuestionId: snapshot.currentQuestionId,
      flaggedCount: snapshot.flaggedCount,
      tabSwitchCount: snapshot.tabSwitchCount,
      ...extra,
    };
  }, []);

  const sendMonitoringEvent = useCallback(
    (
      type: RecordAttemptEventPayload['type'],
      extra?: Record<string, unknown>,
    ) => {
      if (!attemptId || hasSubmitted.current) return;
      const metadata = buildMonitoringMetadata(extra);
      const elapsedSec = examData
        ? Math.max(0, examData.exam.durationMin * 60 - monitoringRef.current.timeLeft)
        : undefined;

      void recordAttemptEvent(attemptId, {
        type,
        clientElapsedSec: elapsedSec,
        questionId: monitoringRef.current.currentQuestionId ?? undefined,
        metadata,
      }).catch(() => {});
    },
    [attemptId, buildMonitoringMetadata, examData],
  );
  const sendMonitoringEventRef = useRef(sendMonitoringEvent);
  sendMonitoringEventRef.current = sendMonitoringEvent;

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

  useEffect(() => {
    if (!examData || !attemptId || hasSubmitted.current) return;

    socket?.emit(CLIENT_SOCKET_EVENTS.JOIN_EXAM, { examId });

    const sendHeartbeat = () => {
      const metadata = buildMonitoringMetadata();
      socket?.emit(CLIENT_SOCKET_EVENTS.EXAM_HEARTBEAT, {
        examId,
        attemptId,
        answeredCount: metadata.answeredCount,
        unansweredCount: metadata.unansweredCount,
        timeRemainingSec: metadata.timeRemainingSec,
        currentQuestionId: metadata.currentQuestionId,
      });
      sendMonitoringEvent('HEARTBEAT');
    };

    sendHeartbeat();
    const heartbeat = setInterval(sendHeartbeat, MONITORING_HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(heartbeat);
      socket?.emit(CLIENT_SOCKET_EVENTS.LEAVE_EXAM, { examId });
    };
  }, [attemptId, buildMonitoringMetadata, examData, examId, sendMonitoringEvent, socket]);

  // Countdown timer
  useEffect(() => {
    if (!examData || hasSubmitted.current) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAutoSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examData]);

  // Auto-save
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
      sendMonitoringEventRef.current('ONLINE');
    };
    const goOffline = () => {
      setIsOnline(false);
      sendMonitoringEventRef.current('OFFLINE');
    };

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

  // Anti-cheat: Tab switch
  useEffect(() => {
    if (!examData || hasSubmitted.current) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((prev) => {
          const next = prev + 1;
          sendMonitoringEvent('TAB_HIDDEN', { tabSwitchCount: next });
          if (next >= TAB_SWITCH_WARN_LIMIT) {
            toast.error(
              `Warning: You have switched tabs ${next} times. This activity is being recorded.`,
              { duration: 5000 },
            );
          }
          return next;
        });
        setShowTabWarning(true);
        setTimeout(() => setShowTabWarning(false), 5000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [examData, sendMonitoringEvent]);

  useEffect(() => {
    if (!examData || hasSubmitted.current) return;
    let lastBlurAt = 0;
    const handleBlur = () => {
      const now = Date.now();
      if (now - lastBlurAt < 3000) return;
      lastBlurAt = now;
      sendMonitoringEvent('WINDOW_BLUR');
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [examData, sendMonitoringEvent]);

  // Anti-cheat: Prevent copy/paste/right-click/devtools
  useEffect(() => {
    if (!examData || hasSubmitted.current) return;

    const preventCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      sendMonitoringEvent(e.type === 'paste' ? 'PASTE' : 'COPY');
      toast.error('Copying is not allowed during the exam.');
    };
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      sendMonitoringEvent('CONTEXT_MENU');
    };
    const preventShortcuts = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'v', 'a', 'u', 'p'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        sendMonitoringEvent('SHORTCUT_BLOCKED', { key: e.key.toLowerCase() });
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        sendMonitoringEvent('SHORTCUT_BLOCKED', { key: e.key });
      }
    };

    document.addEventListener('copy', preventCopy);
    document.addEventListener('paste', preventCopy);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventShortcuts);
    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('paste', preventCopy);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventShortcuts);
    };
  }, [examData, sendMonitoringEvent]);

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
          navigate(`/student/attempts/${res.data.attemptId}/result`, { replace: true });
        },
        onError: () => {
          toast.error('Auto-submit failed. Please try submitting manually.');
          hasSubmitted.current = false;
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, answers, navigate]);

  useEffect(() => {
    handleAutoSubmitRef.current = handleAutoSubmit;
  }, [handleAutoSubmit]);

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
          navigate(`/student/attempts/${res.data.attemptId}/result`, { replace: true });
        },
        onError: () => {
          toast.error('Submit failed. Please try again.');
          hasSubmitted.current = false;
        },
      },
    );
  };

  const selectAnswer = (questionId: number, optionId: number) => {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: optionId }));
  };

  const toggleMultiAnswer = (questionId: number, optionId: number) => {
    setAnswers((prev) => {
      const key = String(questionId);
      const current = Array.isArray(prev[key]) ? (prev[key] as number[]) : [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [key]: next.length > 0 ? next : null };
    });
  };

  const setTextAnswer = (questionId: number, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [String(questionId)]: value.trim() ? value : null,
    }));
  };

  const setMatchingAnswer = (questionId: number, label: string, value: string) => {
    setAnswers((prev) => {
      const key = String(questionId);
      const current =
        prev[key] && typeof prev[key] === 'object' && !Array.isArray(prev[key])
          ? (prev[key] as Record<string, string>)
          : {};
      return {
        ...prev,
        [key]: { ...current, [label]: value },
      };
    });
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
    return questions.filter((q) => {
      const answer = answers[String(q.questionId)];
      if (answer === undefined || answer === null) return true;
      if (Array.isArray(answer)) return answer.length === 0;
      if (typeof answer === 'string') return answer.trim().length === 0;
      if (typeof answer === 'object') {
        const pairLabels = q.options
          .filter((opt) => opt.content.includes('=>'))
          .map((opt) => opt.label);
        if (pairLabels.length === 0) return false;
        return pairLabels.some((label) => !String(answer[label] || '').trim());
      }
      return false;
    }).length;
  }, [questions, answers]);

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            Preparing your exam…
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !examData) {
    return (
      <div className="mx-auto mt-16 max-w-lg animate-fade-in-up">
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-danger)]/15">
            <svg className="h-7 w-7 text-[var(--color-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
            Cannot Start Exam
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{error}</p>
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
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col sm:-m-6 lg:-m-8">
      <ExamBanners
        showTabWarning={showTabWarning}
        tabSwitchCount={tabSwitchCount}
        tabSwitchLimit={TAB_SWITCH_WARN_LIMIT}
        isOnline={isOnline}
      />

      <ExamHeader
        title={examData.exam.title}
        lastSaved={lastSaved}
        tabSwitchCount={tabSwitchCount}
        timeLeft={timeLeft}
        isWarning={isWarning}
        isCritical={isCritical}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
            <QuestionPanel
              question={currentQuestion}
              currentIndex={currentIndex}
              total={questions.length}
              answer={answers[String(currentQuestion?.questionId ?? 0)]}
              onSingleSelect={selectAnswer}
              onMultiSelect={toggleMultiAnswer}
              onTextAnswer={setTextAnswer}
              onMatchingAnswer={setMatchingAnswer}
            />
          </div>
        </div>

        <QuestionNavigator
          questions={questions}
          answers={answers}
          flagged={flagged}
          currentIndex={currentIndex}
          sidebarOpen={sidebarOpen}
          unansweredCount={unansweredCount}
          onSelect={(i) => {
            setCurrentIndex(i);
            setSidebarOpen(false);
          }}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <ExamFooter
        currentIndex={currentIndex}
        total={questions.length}
        isFlagged={flagged.has(currentIndex)}
        isSubmitting={submitMutation.isPending}
        onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        onNext={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
        onToggleFlag={() => toggleFlag(currentIndex)}
        onOpenSubmit={() => setShowSubmitDialog(true)}
      />

      <SubmitDialog
        isOpen={showSubmitDialog}
        unansweredCount={unansweredCount}
        totalQuestions={questions.length}
        flaggedCount={flagged.size}
        isSubmitting={submitMutation.isPending}
        onClose={() => setShowSubmitDialog(false)}
        onConfirm={handleManualSubmit}
      />
    </div>
  );
}
