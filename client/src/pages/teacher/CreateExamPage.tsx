import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge, DIFFICULTY_OPTIONS } from '@/components/shared/DifficultyBadge';
import { MathText } from '@/components/shared/MathText';
import { useDebounce } from '@/hooks/useDebounce';
import {
  getChaptersBySubject,
  listQuestions,
  listSubjects,
} from '@/services/question.api';
import {
  createExam,
  addExamQuestions,
  scheduleExam,
  assignExam,
  publishExam,
} from '@/services/exam.api';
import { listClasses } from '@/services/class.api';
import type {
  Question as BankQuestion,
  CurriculumChapter,
  CurriculumSubject,
} from '@/types/question';
import type {
  ClassItem,
  GradeComponentType,
  GradingMethod,
  NavigationMode,
  ReviewOptions,
  ReviewWindowFlags,
  ReviewWindowName,
} from '@/types/exam';
import {
  GRADE_COMPONENT_INFO,
  GRADING_METHOD_LABELS,
  REVIEW_ROW_LABELS,
  REVIEW_WINDOW_LABELS,
} from '@/types/exam';

const REVIEW_ALL_ON: ReviewWindowFlags = {
  responses: true,
  marks: true,
  correctness: true,
  correctAnswer: true,
  generalFeedback: true,
};
const REVIEW_ALL_OFF: ReviewWindowFlags = {
  responses: false,
  marks: false,
  correctness: false,
  correctAnswer: false,
  generalFeedback: false,
};
const REVIEW_MARKS_ONLY: ReviewWindowFlags = { ...REVIEW_ALL_OFF, marks: true };

// Practice preset: full review as soon as the student submits (§14).
const PRACTICE_REVIEW: ReviewOptions = {
  duringAttempt: { ...REVIEW_ALL_OFF },
  afterSubmit: { ...REVIEW_ALL_ON },
  laterOpen: { ...REVIEW_ALL_ON },
  afterClosed: { ...REVIEW_ALL_ON },
};
// Strict-exam preset: only the score until the exam closes, then full review.
const STRICT_REVIEW: ReviewOptions = {
  duringAttempt: { ...REVIEW_ALL_OFF },
  afterSubmit: { ...REVIEW_MARKS_ONLY },
  laterOpen: { ...REVIEW_MARKS_ONLY },
  afterClosed: { ...REVIEW_ALL_ON },
};

function cloneReview(options: ReviewOptions): ReviewOptions {
  return {
    duringAttempt: { ...options.duringAttempt },
    afterSubmit: { ...options.afterSubmit },
    laterOpen: { ...options.laterOpen },
    afterClosed: { ...options.afterClosed },
  };
}

const STEPS = [
  { label: 'Basic Info', icon: '1' },
  { label: 'Questions', icon: '2' },
  { label: 'Settings', icon: '3' },
  { label: 'Schedule', icon: '4' },
  { label: 'Assign', icon: '5' },
] as const;

const GRADE_LEVELS = [10, 11, 12] as const;
const MAX_ATTEMPTS = 99;

interface BankCurriculumFilters {
  gradeLevel: string;
  chapterId: string;
}

interface ExamFormState {
  title: string;
  subjectId: string;
  durationMin: number;
  passingScore: number;
  selectedQuestionIds: number[];
  pointsPerQuestion: number;
  shuffle: boolean;
  shuffleAnswers: boolean;
  navigationMode: NavigationMode;
  questionsPerPage: number;
  accessPassword: string;
  showResult: boolean;
  reviewOptions: ReviewOptions;
  maxAttempts: number;
  gradingMethod: GradingMethod;
  scheduleEnabled: boolean;
  startTime: string;
  endTime: string;
  selectedClassIds: number[];
  gradeComponentType: GradeComponentType | '';
}

const defaultForm: ExamFormState = {
  title: '',
  subjectId: '',
  durationMin: 45,
  passingScore: 50,
  selectedQuestionIds: [],
  pointsPerQuestion: 1,
  shuffle: false,
  shuffleAnswers: false,
  navigationMode: 'FREE',
  questionsPerPage: 0,
  accessPassword: '',
  showResult: true,
  reviewOptions: cloneReview(PRACTICE_REVIEW),
  maxAttempts: 1,
  gradingMethod: 'HIGHEST',
  scheduleEnabled: false,
  startTime: '',
  endTime: '',
  selectedClassIds: [],
  gradeComponentType: '',
};

export default function CreateExamPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledClassId = searchParams.get('classId');
  const prefilledSubjectId = searchParams.get('subjectId');
  const returnTo = searchParams.get('returnTo');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ExamFormState>(() => ({
    ...defaultForm,
    subjectId: prefilledSubjectId ?? '',
    selectedClassIds: prefilledClassId ? [Number(prefilledClassId)] : [],
  }));
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showReviewMatrix, setShowReviewMatrix] = useState(false);

  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankPage, setBankPage] = useState(1);
  const [bankSearch, setBankSearch] = useState('');
  const debouncedSearch = useDebounce(bankSearch, 400);
  const [bankCurriculum, setBankCurriculum] = useState<BankCurriculumFilters>({
    gradeLevel: '',
    chapterId: '',
  });
  const [bankChapters, setBankChapters] = useState<CurriculumChapter[]>([]);
  const [bankChaptersLoading, setBankChaptersLoading] = useState(false);
  const [bankDifficulty, setBankDifficulty] = useState('');
  const [classGradeFilter, setClassGradeFilter] = useState<number | null>(null);

  const availableGrades = useMemo(
    () => Array.from(new Set(classes.map((c) => c.gradeLevel))).sort((a, b) => a - b),
    [classes],
  );

  const filteredClasses = useMemo(
    () =>
      classGradeFilter == null
        ? classes
        : classes.filter((c) => c.gradeLevel === classGradeFilter),
    [classes, classGradeFilter],
  );

  const filteredBankChapters = useMemo(() => {
    if (!bankCurriculum.gradeLevel) return bankChapters;
    const gradeLevel = Number(bankCurriculum.gradeLevel);
    return bankChapters.filter((chapter) => chapter.gradeLevel === gradeLevel);
  }, [bankChapters, bankCurriculum.gradeLevel]);

  const classStripRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = classStripRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    if (step !== 4) return;
    // Defer to next tick so layout is ready.
    const id = window.setTimeout(updateScrollState, 0);
    const onResize = () => updateScrollState();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('resize', onResize);
    };
  }, [step, filteredClasses, updateScrollState]);

  const scrollStrip = (dir: 'left' | 'right') => {
    const el = classStripRef.current;
    if (!el) return;
    const delta = Math.max(240, Math.round(el.clientWidth * 0.8));
    el.scrollBy({ left: dir === 'left' ? -delta : delta, behavior: 'smooth' });
  };

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => {});
    listClasses({ pageSize: 200 }).then((r) => setClasses(r.items ?? r as unknown as ClassItem[])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.subjectId) {
      setBankChapters([]);
      setBankCurriculum((prev) => ({ ...prev, chapterId: '' }));
      return;
    }

    let cancelled = false;
    setBankChaptersLoading(true);
    getChaptersBySubject(Number(form.subjectId))
      .then((chapters) => {
        if (cancelled) return;
        setBankChapters(chapters);
        setBankCurriculum((prev) => {
          const selectedChapterStillValid =
            prev.chapterId &&
            chapters.some(
              (chapter) =>
                String(chapter.id) === prev.chapterId &&
                (!prev.gradeLevel || chapter.gradeLevel === Number(prev.gradeLevel)),
            );

          return selectedChapterStillValid ? prev : { ...prev, chapterId: '' };
        });
      })
      .catch(() => {
        if (!cancelled) setBankChapters([]);
      })
      .finally(() => {
        if (!cancelled) setBankChaptersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.subjectId]);

  useEffect(() => {
    if (!bankCurriculum.chapterId || !bankCurriculum.gradeLevel) return;
    const selectedChapter = bankChapters.find(
      (chapter) => String(chapter.id) === bankCurriculum.chapterId,
    );
    if (selectedChapter && selectedChapter.gradeLevel !== Number(bankCurriculum.gradeLevel)) {
      setBankCurriculum((prev) => ({ ...prev, chapterId: '' }));
    }
  }, [bankChapters, bankCurriculum.chapterId, bankCurriculum.gradeLevel]);

  const fetchBankQuestions = useCallback(async () => {
    setBankLoading(true);
    try {
      const params: Record<string, unknown> = {
        page: bankPage,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc' as const,
      };
      if (form.subjectId) params.subjectId = Number(form.subjectId);
      if (bankCurriculum.gradeLevel) params.gradeLevel = Number(bankCurriculum.gradeLevel);
      if (bankCurriculum.chapterId) params.chapterId = Number(bankCurriculum.chapterId);
      if (bankDifficulty) params.difficulty = Number(bankDifficulty);
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await listQuestions(params as never);
      setBankQuestions(res.items ?? []);
      setBankTotal(res.total ?? 0);
    } catch {
      toast.error('Failed to load questions.');
    } finally {
      setBankLoading(false);
    }
  }, [bankPage, form.subjectId, bankCurriculum, bankDifficulty, debouncedSearch]);

  useEffect(() => {
    if (step === 1) fetchBankQuestions();
  }, [step, fetchBankQuestions]);

  useEffect(() => {
    setBankPage(1);
  }, [bankCurriculum, bankDifficulty, debouncedSearch]);

  const updateForm = <K extends keyof ExamFormState>(key: K, value: ExamFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleQuestion = (id: number) => {
    setForm((prev) => {
      const ids = prev.selectedQuestionIds.includes(id)
        ? prev.selectedQuestionIds.filter((qid) => qid !== id)
        : [...prev.selectedQuestionIds, id];
      return { ...prev, selectedQuestionIds: ids };
    });
  };

  const selectAllOnPage = () => {
    const ids = bankQuestions.map((q) => q.id);
    setForm((prev) => {
      const merged = new Set([...prev.selectedQuestionIds, ...ids]);
      return { ...prev, selectedQuestionIds: [...merged] };
    });
  };

  const deselectAllOnPage = () => {
    const ids = new Set(bankQuestions.map((q) => q.id));
    setForm((prev) => ({
      ...prev,
      selectedQuestionIds: prev.selectedQuestionIds.filter((qid) => !ids.has(qid)),
    }));
  };

  const canGoNext = useMemo(() => {
    switch (step) {
      case 0:
        return form.title.trim() !== '' && form.subjectId !== '' && form.durationMin > 0;
      case 1:
        return form.selectedQuestionIds.length > 0;
      case 2:
        return form.maxAttempts >= 1 && form.maxAttempts <= MAX_ATTEMPTS;
      case 3:
        if (!form.scheduleEnabled) return true;
        return form.startTime !== '' && form.endTime !== '' && form.startTime < form.endTime;
      case 4:
        return true;
      default:
        return false;
    }
  }, [step, form]);

  const goNext = () => {
    if (canGoNext && step < STEPS.length - 1) setStep(step + 1);
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const subjectName = subjects.find((s) => String(s.id) === form.subjectId)?.name ?? '—';

  const handleCreate = async () => {
    setSaving(true);
    try {
      const exam = await createExam({
        title: form.title.trim(),
        subjectId: Number(form.subjectId),
        durationMin: form.durationMin,
        totalQuestions: form.selectedQuestionIds.length,
        // Backend stores passingScore on the 0–10 scale (total exam = 10 pts).
        // The UI captures it as a percentage (0–100), so convert here.
        passingScore: Number((form.passingScore / 10).toFixed(2)),
        shuffle: form.shuffle,
        // Legacy fallback flag — true if anything is shown right after submit.
        showResult: Object.values(form.reviewOptions.afterSubmit).some(Boolean),
        maxAttempts: form.maxAttempts,
        gradingMethod: form.maxAttempts > 1 ? form.gradingMethod : 'HIGHEST',
        shuffleAnswers: form.shuffleAnswers,
        navigationMode: form.navigationMode,
        questionsPerPage: form.questionsPerPage > 0 ? form.questionsPerPage : null,
        accessPassword: form.accessPassword.trim() ? form.accessPassword.trim() : null,
        reviewOptions: form.reviewOptions,
      });

      await addExamQuestions(exam.id, {
        mode: 'manual',
        questionIds: form.selectedQuestionIds,
      });

      // Exam must leave DRAFT before classes can be assigned.
      // Schedule => SCHEDULED; otherwise publish to PUBLISHED so assign works
      // even when the teacher leaves schedule disabled.
      if (form.scheduleEnabled && form.startTime && form.endTime) {
        await scheduleExam(exam.id, {
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
        });
      } else if (form.selectedClassIds.length > 0) {
        await publishExam(exam.id);
      }

      if (form.selectedClassIds.length > 0) {
        await assignExam(exam.id, {
          classIds: form.selectedClassIds,
          gradeComponentType:
            form.gradeComponentType === '' ? null : form.gradeComponentType,
        });
      }

      toast.success('Exam created successfully!');
      navigate(returnTo ?? '/teacher/exams');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        (err instanceof Error ? err.message : '') ||
        'Failed to create exam. Please try again.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (previewMode) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Exam Preview</h1>
          <Button variant="outline" onClick={() => setPreviewMode(false)}>
            Back to Editor
          </Button>
        </div>
        <Card padding="lg">
          <h2 className="mb-2 text-xl font-bold text-slate-900">{form.title || 'Untitled Exam'}</h2>
          <div className="mb-6 flex flex-wrap gap-3 text-sm text-slate-500">
            <span>Subject: <strong className="text-slate-700">{subjectName}</strong></span>
            <span>Duration: <strong className="text-slate-700">{form.durationMin} min</strong></span>
            <span>Questions: <strong className="text-slate-700">{form.selectedQuestionIds.length}</strong></span>
            <span>Passing: <strong className="text-slate-700">{form.passingScore}%</strong></span>
          </div>
          <div className="space-y-4">
            {bankQuestions
              .filter((q) => form.selectedQuestionIds.includes(q.id))
              .map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 text-sm font-medium text-slate-800">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700">
                      {idx + 1}
                    </span>
                    <MathText>{q.content}</MathText>
                  </div>
                  <div className="space-y-2 pl-8">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-500">
                          {opt.label}
                        </span>
                        <div className="min-w-0 flex-1">
                          <MathText>{opt.content}</MathText>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            {form.selectedQuestionIds.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No questions selected yet.</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create Exam</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Step {step + 1} of {STEPS.length} — {STEPS[step].label}
          </p>
        </div>
        <Button variant="ghost" onClick={() => setPreviewMode(true)}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview
        </Button>
      </div>

      {/* Step indicator */}
      <nav className="mb-8" aria-label="Progress">
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={i} className="flex items-center gap-2 flex-1">
                <button
                  type="button"
                  onClick={() => i <= step && setStep(i)}
                  disabled={i > step}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : current
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {done ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    s.icon
                  )}
                </button>
                <span className={`hidden text-xs font-medium sm:block ${current ? 'text-indigo-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`hidden h-0.5 flex-1 sm:block ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <Card padding="lg" className={step === 4 ? '' : 'min-h-[400px]'}>
        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Exam Information</h2>
            <Input
              label="Exam Title"
              placeholder="e.g. Chapter 3 Mid-term Test"
              value={form.title}
              onChange={(e) => updateForm('title', e.target.value)}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject</label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={form.subjectId}
                onChange={(e) => updateForm('subjectId', e.target.value)}
              >
                <option value="">Select a subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Duration (minutes)"
                type="number"
                min={1}
                max={300}
                value={String(form.durationMin)}
                onChange={(e) => updateForm('durationMin', Math.max(1, Number(e.target.value)))}
              />
              <Input
                label="Passing Score (%)"
                type="number"
                min={0}
                max={100}
                value={String(form.passingScore)}
                onChange={(e) => updateForm('passingScore', Math.max(0, Math.min(100, Number(e.target.value))))}
              />
            </div>
          </div>
        )}

        {/* Step 2: Select Questions */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Select Questions</h2>
              <Badge variant="info">{form.selectedQuestionIds.length} selected</Badge>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="relative flex-1">
                  <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Search questions..."
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                  />
                </div>
                <div>
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={bankDifficulty}
                    onChange={(e) => setBankDifficulty(e.target.value)}
                  >
                    <option value="">All Difficulty</option>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Subject
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={form.subjectId}
                    onChange={(e) => {
                      updateForm('subjectId', e.target.value);
                      setBankCurriculum({ gradeLevel: '', chapterId: '' });
                    }}
                  >
                    <option value="">All subjects</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Grade
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={bankCurriculum.gradeLevel}
                    onChange={(e) => {
                      const gradeLevel = e.target.value;
                      setBankCurriculum((prev) => {
                        const chapterStillValid =
                          prev.chapterId &&
                          bankChapters.some(
                            (chapter) =>
                              String(chapter.id) === prev.chapterId &&
                              (!gradeLevel || chapter.gradeLevel === Number(gradeLevel)),
                          );

                        return {
                          gradeLevel,
                          chapterId: chapterStillValid ? prev.chapterId : '',
                        };
                      });
                    }}
                  >
                    <option value="">All grades</option>
                    {GRADE_LEVELS.map((gradeLevel) => (
                      <option key={gradeLevel} value={gradeLevel}>
                        Grade {gradeLevel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Chapter
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                    disabled={!form.subjectId || bankChaptersLoading}
                    value={bankCurriculum.chapterId}
                    onChange={(e) =>
                      setBankCurriculum((prev) => ({
                        ...prev,
                        chapterId: e.target.value,
                      }))
                    }
                  >
                    <option value="">All chapters</option>
                    {filteredBankChapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {bankCurriculum.gradeLevel
                          ? chapter.name
                          : `Grade ${chapter.gradeLevel} - ${chapter.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Batch actions */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={selectAllOnPage}>Select all on page</Button>
              <Button variant="ghost" size="sm" onClick={deselectAllOnPage}>Deselect all on page</Button>
              <div className="ml-auto">
                <Input
                  label=""
                  type="number"
                  min={0.5}
                  step={0.5}
                  className="w-32"
                  placeholder="Points each"
                  value={String(form.pointsPerQuestion)}
                  onChange={(e) => updateForm('pointsPerQuestion', Math.max(0.5, Number(e.target.value)))}
                />
                <span className="ml-2 text-xs text-slate-500">pts / question</span>
              </div>
            </div>

            {/* Question list */}
            {bankLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" label="Loading questions" />
              </div>
            ) : bankQuestions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-600">No questions found.</p>
                <p className="mt-1 text-xs text-slate-400">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bankQuestions.map((q) => {
                  const checked = form.selectedQuestionIds.includes(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => toggleQuestion(q.id)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                        checked
                          ? 'border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          checked
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && (
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <DifficultyBadge level={q.difficulty} />
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {q.questionType.replace('_', ' ')}
                          </span>
                          {q.chapter && (
                            <span className="text-xs text-slate-400">{q.chapter.name}</span>
                          )}
                        </div>
                        <div className="line-clamp-2 text-sm text-slate-800">
                          <MathText>{q.content}</MathText>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!bankLoading && bankTotal > 10 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">
                  Page {bankPage} — {bankTotal} total
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={bankPage <= 1} onClick={() => setBankPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={bankPage >= Math.ceil(bankTotal / 10)} onClick={() => setBankPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Configuration */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Exam Settings</h2>

            <ToggleSwitch
              label="Shuffle Questions"
              description="Randomize question order for each student."
              checked={form.shuffle}
              onChange={(v) => updateForm('shuffle', v)}
            />

            <ToggleSwitch
              label="Shuffle Answer Order"
              description="Randomize the order of answer options for each student."
              checked={form.shuffleAnswers}
              onChange={(v) => updateForm('shuffleAnswers', v)}
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Question Navigation
              </label>
              <p className="mb-2 text-xs text-slate-500">
                Free: students can go back to previous questions. Sequential: must follow the order, no going back.
              </p>
              <div className="flex gap-2">
                {(['FREE', 'SEQUENTIAL'] as NavigationMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateForm('navigationMode', mode)}
                    className={`flex h-11 flex-1 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                      form.navigationMode === mode
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {mode === 'FREE' ? 'Free' : 'Sequential'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Questions per Page
              </label>
              <p className="mb-2 text-xs text-slate-500">
                Leave 0 = one question per page (default). Enter a larger number to group multiple questions on one page.
              </p>
              <Input
                className="w-32"
                type="number"
                min={0}
                max={100}
                value={String(form.questionsPerPage)}
                onChange={(e) =>
                  updateForm('questionsPerPage', Math.max(0, Math.min(100, Number(e.target.value))))
                }
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Access Password (optional)
              </label>
              <p className="mb-2 text-xs text-slate-500">
                If set, students must enter the correct password before they can start the exam.
              </p>
              <Input
                className="max-w-xs"
                type="text"
                maxLength={100}
                placeholder="Leave blank = no password required"
                value={form.accessPassword}
                onChange={(e) => updateForm('accessPassword', e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                What can students see after submitting? (Review options)
              </label>
              <p className="mb-2 text-xs text-slate-500">
                Pick a preset quickly, or enable advanced customization to control the details for each time window.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateForm('reviewOptions', cloneReview(PRACTICE_REVIEW))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Practice — show right after submit
                </button>
                <button
                  type="button"
                  onClick={() => updateForm('reviewOptions', cloneReview(STRICT_REVIEW))}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Strict exam — score only until the exam closes
                </button>
                <button
                  type="button"
                  onClick={() => setShowReviewMatrix((s) => !s)}
                  className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                >
                  {showReviewMatrix ? 'Hide customization' : 'Advanced customization'}
                </button>
              </div>

              {showReviewMatrix && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-3 py-2 font-semibold text-slate-600">Content</th>
                        {REVIEW_WINDOW_LABELS.map((win) => (
                          <th key={win.key} className="px-3 py-2 text-center font-semibold text-slate-600">
                            {win.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {REVIEW_ROW_LABELS.map((row) => (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700">{row.label}</td>
                          {REVIEW_WINDOW_LABELS.map((win) => (
                            <td key={win.key} className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={form.reviewOptions[win.key as ReviewWindowName][row.key as keyof ReviewWindowFlags]}
                                onChange={() => {
                                  const next = cloneReview(form.reviewOptions);
                                  const w = win.key as ReviewWindowName;
                                  const r = row.key as keyof ReviewWindowFlags;
                                  next[w][r] = !next[w][r];
                                  updateForm('reviewOptions', next);
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Max Attempts
              </label>
              <p className="mb-2 text-xs text-slate-500">
                How many times a student can take this exam.
              </p>
              <div className="flex items-center gap-3">
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateForm('maxAttempts', n)}
                    className={`flex h-11 w-14 items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                      form.maxAttempts === n
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <Input
                  className="w-24"
                  type="number"
                  min={1}
                  max={MAX_ATTEMPTS}
                  placeholder="Custom"
                  value={![1, 2, 3, 5].includes(form.maxAttempts) ? String(form.maxAttempts) : ''}
                  onChange={(e) =>
                    updateForm(
                      'maxAttempts',
                      Math.max(1, Math.min(MAX_ATTEMPTS, Number(e.target.value))),
                    )
                  }
                />
              </div>
            </div>

            {form.maxAttempts > 1 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Final score calculation
                </label>
                <p className="mb-2 text-xs text-slate-500">
                  When multiple attempts are allowed, the final score is taken using this method.
                </p>
                <select
                  className="h-11 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={form.gradingMethod}
                  onChange={(e) => updateForm('gradingMethod', e.target.value as GradingMethod)}
                >
                  {(Object.keys(GRADING_METHOD_LABELS) as GradingMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {GRADING_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Schedule */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Schedule (Optional)</h2>
            <p className="text-sm text-slate-500">
              Set a time window when the exam is available. Leave disabled to publish manually later.
            </p>

            <ToggleSwitch
              label="Enable Schedule"
              description="Automatically open and close the exam at specified times."
              checked={form.scheduleEnabled}
              onChange={(v) => updateForm('scheduleEnabled', v)}
            />

            {form.scheduleEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={form.startTime}
                    onChange={(e) => updateForm('startTime', e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">End Date & Time</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={form.endTime}
                    min={form.startTime}
                    onChange={(e) => updateForm('endTime', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Assign Classes + Review */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Assign to Classes</h2>
                <p className="text-xs text-slate-500">
                  Pick classes now or assign later.{' '}
                  <span className="font-semibold text-indigo-600">
                    {form.selectedClassIds.length} selected
                  </span>
                </p>
              </div>

              {availableGrades.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-medium text-slate-500">Grade:</span>
                  <button
                    type="button"
                    onClick={() => setClassGradeFilter(null)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      classGradeFilter === null
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All
                  </button>
                  {availableGrades.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setClassGradeFilter(g)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        classGradeFilter === g
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Grade {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {classes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-8 text-center">
                <p className="text-sm text-slate-500">No classes available. Create a class first.</p>
              </div>
            ) : filteredClasses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-8 text-center">
                <p className="text-sm text-slate-500">No classes in this grade.</p>
              </div>
            ) : (
              <div className="relative">
                {/* Left arrow */}
                <button
                  type="button"
                  onClick={() => scrollStrip('left')}
                  disabled={!canScrollLeft}
                  aria-label="Scroll left"
                  className={`absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 -translate-x-1 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-all hover:bg-indigo-50 hover:text-indigo-600 ${
                    canScrollLeft ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Right arrow */}
                <button
                  type="button"
                  onClick={() => scrollStrip('right')}
                  disabled={!canScrollRight}
                  aria-label="Scroll right"
                  className={`absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 translate-x-1 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition-all hover:bg-indigo-50 hover:text-indigo-600 ${
                    canScrollRight ? 'opacity-100' : 'pointer-events-none opacity-0'
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Edge fade hints */}
                <div
                  className={`pointer-events-none absolute left-0 top-0 z-[5] h-full w-8 bg-gradient-to-r from-white to-transparent transition-opacity ${
                    canScrollLeft ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <div
                  className={`pointer-events-none absolute right-0 top-0 z-[5] h-full w-8 bg-gradient-to-l from-white to-transparent transition-opacity ${
                    canScrollRight ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                <div
                  ref={classStripRef}
                  onScroll={updateScrollState}
                  className="flex flex-nowrap snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:thin]"
                >
                  {filteredClasses.map((cls) => {
                    const checked = form.selectedClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            selectedClassIds: checked
                              ? prev.selectedClassIds.filter((id) => id !== cls.id)
                              : [...prev.selectedClassIds, cls.id],
                          }));
                        }}
                        className={`group flex w-52 shrink-0 snap-start flex-col gap-2 rounded-xl border p-3 text-left transition-all ${
                          checked
                            ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            Grade {cls.gradeLevel}
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              checked
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 bg-white group-hover:border-indigo-400'
                            }`}
                          >
                            {checked && (
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </div>
                        <p className="truncate text-sm font-semibold text-slate-800">{cls.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {cls.subject?.name ?? '—'}
                          {cls._count?.classStudents != null && (
                            <span className="ml-1 text-slate-400">· {cls._count.classStudents} students</span>
                          )}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gradebook component */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">
                  Count toward gradebook
                </h3>
                <span className="text-[11px] uppercase tracking-wide text-slate-400">
                  Circular 22 — High School
                </span>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                When a grade component is selected, each student's best result is
                automatically added to the class gradebook with the matching coefficient.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => updateForm('gradeComponentType', '')}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                    form.gradeComponentType === ''
                      ? 'border-slate-600 bg-slate-600 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold">Not graded</div>
                  <div className="text-[11px] opacity-75">Practice only</div>
                </button>
                {(Object.keys(GRADE_COMPONENT_INFO) as GradeComponentType[]).map(
                  (key) => {
                    const info = GRADE_COMPONENT_INFO[key];
                    const checked = form.gradeComponentType === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => updateForm('gradeComponentType', key)}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                          checked
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'
                        }`}
                      >
                        <div className="font-bold">
                          {info.abbr} (coefficient {info.coefficient})
                        </div>
                        <div className="text-[11px] opacity-75">
                          {info.label}
                        </div>
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* Compact Review Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-slate-800">Review Summary</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3 lg:grid-cols-5">
                <SummaryItem label="Title" value={form.title || '—'} />
                <SummaryItem label="Subject" value={subjectName} />
                <SummaryItem label="Duration" value={`${form.durationMin} min`} />
                <SummaryItem label="Questions" value={form.selectedQuestionIds.length} />
                <SummaryItem label="Passing" value={`${form.passingScore}%`} />
                <SummaryItem label="Max Attempts" value={form.maxAttempts} />
                {form.maxAttempts > 1 && (
                  <SummaryItem label="Final score" value={GRADING_METHOD_LABELS[form.gradingMethod]} />
                )}
                <SummaryItem label="Shuffle" value={form.shuffle ? 'Yes' : 'No'} />
                <SummaryItem label="Shuffle answers" value={form.shuffleAnswers ? 'Yes' : 'No'} />
                <SummaryItem label="Navigation" value={form.navigationMode === 'SEQUENTIAL' ? 'Sequential' : 'Free'} />
                <SummaryItem label="Password" value={form.accessPassword.trim() ? 'Yes' : 'No'} />
                <SummaryItem
                  label="Review after submit"
                  value={
                    form.reviewOptions.afterSubmit.correctAnswer
                      ? 'Answer + explanation'
                      : form.reviewOptions.afterSubmit.marks
                        ? 'Score only'
                        : 'Hidden'
                  }
                />
                <SummaryItem label="Scheduled" value={form.scheduleEnabled ? 'Yes' : 'No'} />
                <SummaryItem label="Classes" value={form.selectedClassIds.length} />
                <SummaryItem
                  label="Gradebook"
                  value={
                    form.gradeComponentType
                      ? GRADE_COMPONENT_INFO[form.gradeComponentType].abbr
                      : '—'
                  }
                />
              </dl>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between">
        <Button variant="outline" onClick={goBack} disabled={step === 0}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>
        <div className="flex gap-2">
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={goNext} disabled={!canGoNext}>
              Next
              <svg className="ml-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          ) : (
            <Button variant="primary" onClick={handleCreate} isLoading={saving} disabled={!canGoNext}>
              <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Create Exam
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Summary item sub-component ────────────────────── */

function SummaryItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-white px-2.5 py-1.5">
      <dt className="truncate text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="truncate text-xs font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

/* ── Toggle Switch sub-component ───────────────────── */

function ToggleSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
          checked ? 'bg-indigo-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}
