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
import {
  createAttemptSecuritySession,
  recordAttemptEvent,
  recordAttemptEventsBatch,
  recordSecurityHeartbeat,
  runStudentExamPrecheck,
} from '@/services/studentExam.api';
import type {
  ExamSecuritySettings,
  ExamQuestion,
  RecordAttemptEventPayload,
  StartExamData,
  StudentPrecheckData,
  StudentPrecheckPayload,
  StudentAnswerValue,
} from '@/types/exam';
import {
  clearAttemptDraft,
  loadAttemptDraft,
  saveAttemptDraft,
} from '@/utils/examDraftQueue';

import { ExamBanners } from './take-exam/ExamBanners';
import { ExamHeader } from './take-exam/ExamHeader';
import { QuestionPanel } from './take-exam/QuestionPanel';
import { QuestionNavigator } from './take-exam/QuestionNavigator';
import { ExamFooter } from './take-exam/ExamFooter';
import { SubmitDialog } from './take-exam/SubmitDialog';

const AUTO_SAVE_INTERVAL = 30_000;
const MONITORING_HEARTBEAT_INTERVAL = 15_000;
const MONITORING_BATCH_INTERVAL = 7_000;
const WARNING_THRESHOLD = 300;
const CRITICAL_THRESHOLD = 60;
const TAB_SWITCH_WARN_LIMIT = 3;
const DEVICE_ID_STORAGE_KEY = 'webquiz_device_id';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'pending' | 'offline' | 'error';

const DEFAULT_SECURITY_SETTINGS: ExamSecuritySettings = {
  id: null,
  examId: null,
  securityLevel: 'MEDIUM',
  requireFullscreen: true,
  blockCopyPaste: true,
  blockRightClick: true,
  blockShortcuts: true,
  requireCamera: false,
  requirePreCheck: true,
  allowedIpRanges: [],
  maxDevices: 1,
  allowResume: true,
  warningThreshold: 15,
  autoSubmitThreshold: 100,
  snapshotIntervalSec: null,
  retentionDays: 30,
};

function getOrCreateDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  return id;
}

function getScreenSize() {
  return `${window.screen.width}x${window.screen.height}`;
}

async function getCameraPermissionState(): Promise<StudentPrecheckPayload['cameraPermission']> {
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state;
  } catch {
    return 'unknown';
  }
}

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

function areAnswerSetsEqual(
  a: Record<string, StudentAnswerValue>,
  b: Record<string, StudentAnswerValue>,
) {
  return JSON.stringify(a) === JSON.stringify(b);
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [precheckData, setPrecheckData] = useState<StudentPrecheckData | null>(null);
  const [precheckLoading, setPrecheckLoading] = useState(true);
  const [precheckError, setPrecheckError] = useState<string | null>(null);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [enteringExam, setEnteringExam] = useState(false);
  const [fullscreenWarning, setFullscreenWarning] = useState(false);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);

  const pendingSave = useRef<Record<string, StudentAnswerValue>>({});
  const pendingEvents = useRef<RecordAttemptEventPayload[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasSubmitted = useRef(false);
  const handleAutoSubmitRef = useRef<() => void>(() => {});
  const deviceIdRef = useRef(getOrCreateDeviceId());
  const lastServerAnswersRef = useRef<Record<string, StudentAnswerValue>>({});

  const startMutation = useStartStudentExam();
  const saveMutation = useSaveAnswers();
  const submitMutation = useSubmitStudentExam();
  const { socket } = useSocketContext();

  const attemptId = examData?.attempt.id;
  const securitySettings = examData?.securitySettings ?? precheckData?.settings ?? DEFAULT_SECURITY_SETTINGS;
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
      immediate = false,
    ) => {
      if (!attemptId || hasSubmitted.current) return;
      const metadata = buildMonitoringMetadata(extra);
      const elapsedSec = examData
        ? Math.max(0, examData.exam.durationMin * 60 - monitoringRef.current.timeLeft)
        : undefined;

      const payload: RecordAttemptEventPayload = {
        type,
        clientElapsedSec: elapsedSec,
        questionId: monitoringRef.current.currentQuestionId ?? undefined,
        metadata,
      };

      if (immediate) {
        void recordAttemptEvent(attemptId, payload).catch(() => {});
        return;
      }
      pendingEvents.current.push(payload);
    },
    [attemptId, buildMonitoringMetadata, examData],
  );
  const sendMonitoringEventRef = useRef(sendMonitoringEvent);
  sendMonitoringEventRef.current = sendMonitoringEvent;

  const flushMonitoringEvents = useCallback(() => {
    if (!attemptId || pendingEvents.current.length === 0 || hasSubmitted.current) return;
    const events = pendingEvents.current.splice(0, pendingEvents.current.length);
    const request =
      events.length === 1
        ? recordAttemptEvent(attemptId, events[0])
        : recordAttemptEventsBatch(attemptId, events);

    void request.catch(() => {
      pendingEvents.current = [...events, ...pendingEvents.current].slice(0, 100);
    });
  }, [attemptId]);

  // Start or resume exam (re-runnable with a password for protected exams)
  const runStart = useCallback(
    (password?: string) => {
      if (!examId || isNaN(examId)) {
        setError('Invalid exam ID');
        setLoading(false);
        return;
      }
      setLoading(true);
      if (password !== undefined) setPasswordSubmitting(true);

      startMutation.mutate(
        { examId, password },
        {
          onSuccess: (res) => {
            const d = res.data;
            const serverAnswers = d.savedAnswers ?? {};
            setExamData(d);
            setAnswers(serverAnswers);
            lastServerAnswersRef.current = serverAnswers;
            setTimeLeft(d.attempt.timeRemainingsSec);
            setNeedsPassword(false);
            setPasswordError(null);
            setPasswordSubmitting(false);
            setLoading(false);
            setSaveStatus('idle');

            void loadAttemptDraft(d.attempt.id).then((draft) => {
              if (!draft || hasSubmitted.current) return;
              if (areAnswerSetsEqual(draft.answers, serverAnswers)) return;

              const mergedAnswers = { ...serverAnswers, ...draft.answers };
              pendingSave.current = mergedAnswers;
              setAnswers(mergedAnswers);
              setSaveStatus(navigator.onLine ? 'pending' : 'offline');
              toast.success('Recovered locally saved answers from this device.');
            });
          },
          onError: (err) => {
            const resp = (
              err as { response?: { data?: { message?: string; data?: { code?: string } } } }
            ).response;
            const code = resp?.data?.data?.code;
            const message = resp?.data?.message;
            setPasswordSubmitting(false);
            setLoading(false);
            if (code === 'PASSWORD_REQUIRED' || code === 'PASSWORD_INCORRECT') {
              setNeedsPassword(true);
              setPasswordError(
                code === 'PASSWORD_INCORRECT' ? message ?? 'Incorrect password' : null,
              );
              return;
            }
            setError(message || err.message || 'Failed to start exam');
          },
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [examId],
  );

  const enterSecureExam = useCallback(
    async (password?: string) => {
      if (precheckData && !precheckData.canStart) return;
      setEnteringExam(true);
      try {
        if (
          securitySettings.requireFullscreen &&
          !document.fullscreenElement &&
          document.documentElement.requestFullscreen
        ) {
          await document.documentElement.requestFullscreen();
        }
        setFullscreenWarning(false);
        runStart(password);
      } catch {
        setFullscreenWarning(true);
        toast.error('Fullscreen mode is required before this exam can start.');
      } finally {
        setEnteringExam(false);
      }
    },
    [precheckData, runStart, securitySettings.requireFullscreen],
  );

  useEffect(() => {
    let cancelled = false;

    async function runPrecheck() {
      if (!examId || isNaN(examId)) {
        setError('Invalid exam ID');
        setPrecheckLoading(false);
        setLoading(false);
        return;
      }

      setPrecheckLoading(true);
      setLoading(false);
      try {
        const cameraPermission = await getCameraPermissionState();
        const payload: StudentPrecheckPayload = {
          deviceId: deviceIdRef.current,
          userAgent: navigator.userAgent,
          supportsFullscreen: Boolean(document.documentElement.requestFullscreen),
          cameraPermission,
          screenSize: getScreenSize(),
          timezoneOffsetMin: new Date().getTimezoneOffset(),
        };
        const result = await runStudentExamPrecheck(examId, payload);
        if (cancelled) return;
        setPrecheckData(result.data);
        setPrecheckError(null);

        const needsGate =
          result.data.settings.requirePreCheck || result.data.settings.securityLevel !== 'LOW';
        if (result.data.canStart && !needsGate) {
          runStart();
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string }).response?.data
            ?.message ||
          (err as Error).message ||
          'Pre-check failed';
        setPrecheckError(message);
      } finally {
        if (!cancelled) setPrecheckLoading(false);
      }
    }

    void runPrecheck();
    return () => {
      cancelled = true;
    };
  }, [examId, runStart]);

  useEffect(() => {
    if (!attemptId) return;
    const interval = setInterval(flushMonitoringEvents, MONITORING_BATCH_INTERVAL);
    return () => {
      clearInterval(interval);
      flushMonitoringEvents();
    };
  }, [attemptId, flushMonitoringEvents]);

  useEffect(() => {
    if (!attemptId || !examData || hasSubmitted.current) return;
    let cancelled = false;

    async function createSession() {
      try {
        const cameraPermission = await getCameraPermissionState();
        await createAttemptSecuritySession(attemptId!, {
          deviceId: deviceIdRef.current,
          userAgent: navigator.userAgent,
          fullscreenState: Boolean(document.fullscreenElement),
          cameraPermission,
          screenSize: getScreenSize(),
        });
      } catch (err) {
        if (cancelled) return;
        const message =
          (err as { response?: { data?: { message?: string } }; message?: string }).response?.data
            ?.message ||
          (err as Error).message ||
          'Security session could not be started.';
        setSecurityWarning(message);
        toast.error(message);
      }
    }

    void createSession();
    return () => {
      cancelled = true;
    };
  }, [attemptId, examData]);

  useEffect(() => {
    if (!examData || !attemptId || hasSubmitted.current) return;

    socket?.emit(CLIENT_SOCKET_EVENTS.JOIN_EXAM, { examId });

    const sendHeartbeat = () => {
      const metadata = buildMonitoringMetadata();
      const heartbeatPayload = {
        deviceId: deviceIdRef.current,
        fullscreenState: Boolean(document.fullscreenElement),
        focusState: document.hasFocus(),
        cameraPermission: securitySettings.requireCamera ? 'unknown' : undefined,
        screenSize: getScreenSize(),
        answeredCount: metadata.answeredCount,
        unansweredCount: metadata.unansweredCount,
        timeRemainingSec: metadata.timeRemainingSec,
        currentQuestionId: metadata.currentQuestionId,
      };
      socket?.emit(CLIENT_SOCKET_EVENTS.EXAM_HEARTBEAT, {
        examId,
        attemptId,
        answeredCount: metadata.answeredCount,
        unansweredCount: metadata.unansweredCount,
        timeRemainingSec: metadata.timeRemainingSec,
        currentQuestionId: metadata.currentQuestionId,
      });
      void recordSecurityHeartbeat(attemptId, heartbeatPayload)
        .then(() => setSecurityWarning(null))
        .catch((err) => {
          const message =
            (err as { response?: { data?: { message?: string } } }).response?.data?.message;
          if (message) setSecurityWarning(message);
        });
    };

    sendHeartbeat();
    const heartbeat = setInterval(sendHeartbeat, MONITORING_HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(heartbeat);
      socket?.emit(CLIENT_SOCKET_EVENTS.LEAVE_EXAM, { examId });
    };
  }, [attemptId, buildMonitoringMetadata, examData, examId, securitySettings.requireCamera, socket]);

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

  useEffect(() => {
    if (!attemptId || hasSubmitted.current) return;
    if (areAnswerSetsEqual(answers, lastServerAnswersRef.current)) return;

    pendingSave.current = { ...pendingSave.current, ...answers };
    setSaveStatus(isOnline ? 'pending' : 'offline');
    void saveAttemptDraft(attemptId, answers);
  }, [answers, attemptId, isOnline]);

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

  useEffect(() => {
    if (!examData || hasSubmitted.current || !securitySettings.requireFullscreen) return;
    let lastExitAt = 0;

    const handleFullscreenChange = () => {
      // Ignore the fullscreen drop we trigger ourselves on submit/unmount.
      if (hasSubmitted.current) return;
      const isFullscreen = Boolean(document.fullscreenElement);
      if (!isFullscreen) {
        const now = Date.now();
        if (now - lastExitAt < 2000) return;
        lastExitAt = now;
        setFullscreenWarning(true);
        sendMonitoringEvent('FULLSCREEN_EXITED', { fullscreenState: false }, true);
        // Best-effort silent re-entry. Most browsers reject re-requesting
        // fullscreen without a fresh user gesture (e.g. after Esc), so the
        // blocking overlay is the reliable way back in.
        void document.documentElement.requestFullscreen?.().catch(() => {});
        return;
      }
      setFullscreenWarning(false);
      sendMonitoringEvent('FULLSCREEN_RESTORED', { fullscreenState: true });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [examData, securitySettings.requireFullscreen, sendMonitoringEvent]);

  // Always release fullscreen when leaving the runner (submit, time-up, or
  // navigating away) so the student isn't stuck in fullscreen elsewhere.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!examData || hasSubmitted.current || !securitySettings.requireCamera) return;
    let cancelled = false;

    async function checkCamera() {
      const permission = await getCameraPermissionState();
      if (cancelled || permission === 'granted') return;
      sendMonitoringEvent('CAMERA_PERMISSION_MISSING', { cameraPermission: permission }, true);
      setSecurityWarning('Camera permission is required for this exam.');
    }

    void checkCamera();
    const interval = setInterval(() => void checkCamera(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [examData, securitySettings.requireCamera, sendMonitoringEvent]);

  // Anti-cheat: Prevent copy/paste/right-click/devtools
  useEffect(() => {
    if (!examData || hasSubmitted.current) return;

    const preventCopy = (e: ClipboardEvent) => {
      if (!securitySettings.blockCopyPaste) return;
      e.preventDefault();
      const type =
        e.type === 'paste' ? 'PASTE' : e.type === 'cut' ? 'CUT' : 'COPY';
      sendMonitoringEvent(type);
      toast.error('Clipboard actions are not allowed during this exam.');
    };
    const preventContextMenu = (e: MouseEvent) => {
      if (!securitySettings.blockRightClick) return;
      e.preventDefault();
      sendMonitoringEvent('CONTEXT_MENU');
    };
    const preventShortcuts = (e: KeyboardEvent) => {
      // Discourage the F11 fullscreen toggle while fullscreen is enforced.
      if (securitySettings.requireFullscreen && e.key === 'F11') {
        e.preventDefault();
        return;
      }
      if (!securitySettings.blockShortcuts) return;
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
    document.addEventListener('cut', preventCopy);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventShortcuts);
    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('paste', preventCopy);
      document.removeEventListener('cut', preventCopy);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventShortcuts);
    };
  }, [
    examData,
    securitySettings.blockCopyPaste,
    securitySettings.blockRightClick,
    securitySettings.blockShortcuts,
    securitySettings.requireFullscreen,
    sendMonitoringEvent,
  ]);

  const performSave = useCallback(() => {
    if (!attemptId || hasSubmitted.current) return;

    const toSave = { ...answers, ...pendingSave.current };
    if (areAnswerSetsEqual(toSave, lastServerAnswersRef.current)) return;

    if (!isOnline) {
      pendingSave.current = toSave;
      setSaveStatus('offline');
      void saveAttemptDraft(attemptId, toSave);
      return;
    }

    pendingSave.current = {};
    setSaveStatus('saving');
    void saveAttemptDraft(attemptId, toSave);

    saveMutation.mutate(
      { attemptId, answers: toSave },
      {
        onSuccess: () => {
          lastServerAnswersRef.current = toSave;
          setLastSaved(new Date());
          setSaveStatus('saved');
          void clearAttemptDraft(attemptId);
        },
        onError: () => {
          pendingSave.current = { ...pendingSave.current, ...toSave };
          setSaveStatus('error');
          void saveAttemptDraft(attemptId, toSave);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, answers, isOnline]);

  const handleAutoSubmit = useCallback(() => {
    if (!attemptId || hasSubmitted.current) return;

    if (!isOnline) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      pendingSave.current = { ...answers };
      setSaveStatus('offline');
      void saveAttemptDraft(attemptId, answers);
      toast.error('Time is up, but you are offline. Reconnect and submit as soon as possible.');
      return;
    }

    flushMonitoringEvents();
    hasSubmitted.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);

    submitMutation.mutate(
      { attemptId, answers },
      {
        onSuccess: (res) => {
          void clearAttemptDraft(attemptId);
          toast.success('Time is up! Your exam has been submitted automatically.');
          navigate(`/student/attempts/${res.data.attemptId}/result`, { replace: true });
        },
        onError: () => {
          setSaveStatus('error');
          void saveAttemptDraft(attemptId, answers);
          toast.error('Auto-submit failed. Please try submitting manually.');
          hasSubmitted.current = false;
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, answers, flushMonitoringEvents, isOnline, navigate]);

  useEffect(() => {
    handleAutoSubmitRef.current = handleAutoSubmit;
  }, [handleAutoSubmit]);

  const handleManualSubmit = () => {
    if (!attemptId || hasSubmitted.current) return;
    if (!isOnline) {
      pendingSave.current = { ...answers };
      setSaveStatus('offline');
      void saveAttemptDraft(attemptId, answers);
      setShowSubmitDialog(false);
      toast.error('You are offline. Reconnect before submitting; your answers are saved on this device.');
      return;
    }

    flushMonitoringEvents();
    hasSubmitted.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    setShowSubmitDialog(false);

    submitMutation.mutate(
      { attemptId, answers },
      {
        onSuccess: (res) => {
          void clearAttemptDraft(attemptId);
          toast.success('Exam submitted successfully!');
          navigate(`/student/attempts/${res.data.attemptId}/result`, { replace: true });
        },
        onError: () => {
          setSaveStatus('error');
          void saveAttemptDraft(attemptId, answers);
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

  if (precheckLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            Running exam security checks...
          </p>
        </div>
      </div>
    );
  }

  if (precheckError && !precheckData) {
    return (
      <div className="mx-auto mt-16 max-w-lg animate-fade-in-up">
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] p-8 text-center">
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
            Security Check Failed
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{precheckError}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/student/exams')}>
              Back to Exams
            </Button>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Run Checks Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">
            Preparing your exam...
          </p>
        </div>
      </div>
    );
  }

  // Password gate (§9): exam requires a password before a fresh attempt
  if (needsPassword && !examData) {
    return (
      <div className="mx-auto mt-16 max-w-md animate-fade-in-up">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (passwordInput.trim()) void enterSecureExam(passwordInput);
          }}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center shadow-[var(--shadow-md)]"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)]">
            <svg className="h-7 w-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 00-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
            This exam requires a password
          </h2>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Enter the password provided by your teacher to start the exam.
          </p>
          <input
            type="password"
            autoFocus
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Password"
            className="mt-5 w-full rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-bg-input)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-primary)] focus:outline-none"
          />
          {passwordError && (
            <p className="mt-2 text-sm font-medium text-[var(--color-danger)]">{passwordError}</p>
          )}
          <div className="mt-5 flex gap-3">
            <Button
              type="button"
              variant="outline"
              fullWidth
              onClick={() => navigate('/student/exams')}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={passwordSubmitting}
              disabled={!passwordInput.trim()}
            >
              Start exam
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (!examData && precheckData) {
    const settings = precheckData.settings;
    const requiredChecks = precheckData.checks.filter((check) => check.required);
    const optionalChecks = precheckData.checks.filter((check) => !check.required);
    const rules = [
      settings.requireFullscreen ? 'Stay in fullscreen mode until you submit.' : null,
      settings.blockCopyPaste ? 'Clipboard actions are blocked and recorded.' : null,
      settings.blockRightClick ? 'Right-click menu attempts are blocked and recorded.' : null,
      settings.blockShortcuts ? 'Common browser shortcuts are blocked and recorded.' : null,
      settings.requireCamera ? 'Camera permission is required for this exam.' : null,
      settings.maxDevices <= 1 ? 'Use one browser/device session for this attempt.' : null,
      settings.allowedIpRanges.length > 0 ? 'This exam is restricted to an approved network.' : null,
    ].filter(Boolean);

    return (
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Security Level
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]">
                {settings.securityLevel.replace('_', ' ')} Exam Rules
              </h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                Review the checks and rules before entering the exam. Your answers remain protected by autosave during the attempt.
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-bg-muted)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]">
              IP: {precheckData.ipAddress}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Required Checks
              </h2>
              <div className="space-y-2">
                {requiredChecks.map((check) => (
                  <div
                    key={check.key}
                    className="flex items-start gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-4 py-3"
                  >
                    <span
                      className={`mt-0.5 h-2.5 w-2.5 rounded-full ${
                        check.status === 'passed'
                          ? 'bg-[var(--color-success)]'
                          : 'bg-[var(--color-danger)]'
                      }`}
                    />
                    <div>
                      <div className="text-sm font-bold text-[var(--color-text-primary)]">
                        {check.label}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)]">
                        {check.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {optionalChecks.length > 0 && (
                <div className="pt-2">
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                    Informational Checks
                  </h2>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {optionalChecks.map((check) => (
                      <div
                        key={check.key}
                        className="rounded-xl border border-[var(--color-border-subtle)] px-4 py-3 text-xs text-[var(--color-text-secondary)]"
                      >
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {check.label}:
                        </span>{' '}
                        {check.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                Exam Rules
              </h2>
              <ul className="space-y-2">
                {rules.length > 0 ? (
                  rules.map((rule) => (
                    <li
                      key={rule}
                      className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]"
                    >
                      {rule}
                    </li>
                  ))
                ) : (
                  <li className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    Basic activity monitoring is enabled for this attempt.
                  </li>
                )}
              </ul>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 text-sm text-[var(--color-text-primary)]">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                />
                <span>
                  I understand that suspicious activity may be recorded for teacher review.
                </span>
              </label>
            </div>
          </div>

          {fullscreenWarning && (
            <p className="mt-4 rounded-xl bg-[var(--color-danger-soft)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
              Fullscreen mode is required before this exam can start.
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => navigate('/student/exams')}>
              Back
            </Button>
            <Button
              variant="primary"
              isLoading={enteringExam}
              disabled={!precheckData.canStart || !rulesAccepted}
              onClick={() => void enterSecureExam()}
            >
              Enter Exam
            </Button>
          </div>
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

  // Pagination (§7): group questions into pages; default 1 question/page.
  const navigationMode = examData.exam.navigationMode ?? 'FREE';
  const isSequential = navigationMode === 'SEQUENTIAL';
  const perPage =
    examData.exam.questionsPerPage && examData.exam.questionsPerPage > 0
      ? examData.exam.questionsPerPage
      : 1;
  const totalPages = Math.max(1, Math.ceil(questions.length / perPage));
  const currentPage = Math.floor(currentIndex / perPage);
  const pageStart = currentPage * perPage;
  const pageQuestions = questions.slice(pageStart, pageStart + perPage);
  const canPrev = currentPage > 0 && !isSequential;
  const canNext = currentPage < totalPages - 1;
  const canSelectQuestion = (i: number) =>
    !isSequential || Math.floor(i / perPage) === currentPage;

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg-page)]">
      <ExamBanners
        showTabWarning={showTabWarning}
        tabSwitchCount={tabSwitchCount}
        tabSwitchLimit={TAB_SWITCH_WARN_LIMIT}
        isOnline={isOnline}
      />

      {securityWarning && (
        <div className="border-b border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-4 py-2 text-sm text-[var(--color-warning)]">
          <div className="mx-auto flex max-w-6xl items-center justify-center">
            <span className="font-medium">{securityWarning}</span>
          </div>
        </div>
      )}

      {/* Blocking overlay: the exam cannot continue outside fullscreen. */}
      {fullscreenWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
              <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
              </svg>
            </div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
              Fullscreen is required
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              You must stay in fullscreen for the whole exam. Exiting fullscreen has been
              recorded. Return to fullscreen to continue.
            </p>
            <Button
              variant="primary"
              fullWidth
              className="mt-6"
              onClick={() => {
                void document.documentElement
                  .requestFullscreen?.()
                  .then(() => setFullscreenWarning(false))
                  .catch(() => {});
              }}
            >
              Return to fullscreen
            </Button>
          </div>
        </div>
      )}

      <ExamHeader
        title={examData.exam.title}
        lastSaved={lastSaved}
        saveStatus={saveStatus}
        tabSwitchCount={tabSwitchCount}
        timeLeft={timeLeft}
        isWarning={isWarning}
        isCritical={isCritical}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
            {pageQuestions.map((q, idx) => {
              const globalIndex = pageStart + idx;
              return (
                <QuestionPanel
                  key={q.questionId}
                  question={q}
                  currentIndex={globalIndex}
                  total={questions.length}
                  compact={perPage > 1}
                  isFlagged={flagged.has(globalIndex)}
                  onToggleFlag={() => toggleFlag(globalIndex)}
                  answer={answers[String(q.questionId)]}
                  onSingleSelect={selectAnswer}
                  onMultiSelect={toggleMultiAnswer}
                  onTextAnswer={setTextAnswer}
                  onMatchingAnswer={setMatchingAnswer}
                />
              );
            })}
          </div>
        </div>

        <QuestionNavigator
          questions={questions}
          answers={answers}
          flagged={flagged}
          currentIndex={currentIndex}
          sidebarOpen={sidebarOpen}
          unansweredCount={unansweredCount}
          canSelect={canSelectQuestion}
          onSelect={(i) => {
            setCurrentIndex(i);
            setSidebarOpen(false);
          }}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      <ExamFooter
        canPrev={canPrev}
        canNext={canNext}
        pageLabel={
          perPage > 1
            ? `Page ${currentPage + 1}/${totalPages}`
            : `Question ${currentPage + 1}/${totalPages}`
        }
        isSubmitting={submitMutation.isPending}
        onPrev={() => setCurrentIndex(Math.max(0, pageStart - perPage))}
        onNext={() => setCurrentIndex(Math.min(questions.length - 1, pageStart + perPage))}
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
