import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { DifficultyBadge, DIFFICULTY_OPTIONS } from '@/components/shared/DifficultyBadge';
import {
  SubjectChapterTopicSelect,
  emptyCurriculumSelection,
  type CurriculumSelection,
} from '@/components/shared/SubjectChapterTopicSelect';
import { useDebounce } from '@/hooks/useDebounce';
import { listQuestions } from '@/services/question.api';
import { listSubjects } from '@/services/question.api';
import {
  createExam,
  addExamQuestions,
  scheduleExam,
  assignExam,
  publishExam,
} from '@/services/exam.api';
import { listClasses } from '@/services/class.api';
import type { Question as BankQuestion, CurriculumSubject } from '@/types/question';
import type { ClassItem } from '@/types/exam';

const STEPS = [
  { label: 'Basic Info', icon: '1' },
  { label: 'Questions', icon: '2' },
  { label: 'Settings', icon: '3' },
  { label: 'Schedule', icon: '4' },
  { label: 'Assign', icon: '5' },
] as const;

interface ExamFormState {
  title: string;
  subjectId: string;
  durationMin: number;
  passingScore: number;
  selectedQuestionIds: number[];
  pointsPerQuestion: number;
  shuffle: boolean;
  showResult: boolean;
  maxAttempts: number;
  scheduleEnabled: boolean;
  startTime: string;
  endTime: string;
  selectedClassIds: number[];
}

const defaultForm: ExamFormState = {
  title: '',
  subjectId: '',
  durationMin: 45,
  passingScore: 50,
  selectedQuestionIds: [],
  pointsPerQuestion: 1,
  shuffle: false,
  showResult: true,
  maxAttempts: 1,
  scheduleEnabled: false,
  startTime: '',
  endTime: '',
  selectedClassIds: [],
};

export default function CreateExamPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ExamFormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankTotal, setBankTotal] = useState(0);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankPage, setBankPage] = useState(1);
  const [bankSearch, setBankSearch] = useState('');
  const debouncedSearch = useDebounce(bankSearch, 400);
  const [bankCurriculum, setBankCurriculum] = useState<CurriculumSelection>(
    emptyCurriculumSelection(),
  );
  const [bankDifficulty, setBankDifficulty] = useState('');

  useEffect(() => {
    listSubjects().then(setSubjects).catch(() => {});
    listClasses({ pageSize: 200 }).then((r) => setClasses(r.items ?? r as unknown as ClassItem[])).catch(() => {});
  }, []);

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
      if (bankCurriculum.chapterId) params.chapterId = Number(bankCurriculum.chapterId);
      if (bankCurriculum.topicId) params.topicId = Number(bankCurriculum.topicId);
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
        return form.maxAttempts >= 1;
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
        passingScore: form.passingScore,
        shuffle: form.shuffle,
        showResult: form.showResult,
        maxAttempts: form.maxAttempts,
      });

      await addExamQuestions(exam.id, {
        mode: 'manual',
        questionIds: form.selectedQuestionIds,
      });

      if (form.scheduleEnabled && form.startTime && form.endTime) {
        await scheduleExam(exam.id, {
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
        });
      }

      if (form.selectedClassIds.length > 0) {
        await assignExam(exam.id, { classIds: form.selectedClassIds });
      }

      if (form.selectedClassIds.length > 0 || (form.scheduleEnabled && form.startTime)) {
        try {
          await publishExam(exam.id);
        } catch { /* exam stays draft */ }
      }

      toast.success('Exam created successfully!');
      navigate('/teacher/exams');
    } catch {
      toast.error('Failed to create exam. Please try again.');
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
                  <p className="mb-3 text-sm font-medium text-slate-800">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-indigo-100 text-xs font-bold text-indigo-700">
                      {idx + 1}
                    </span>
                    {q.content}
                  </p>
                  <div className="space-y-2 pl-8">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-500">
                          {opt.label}
                        </span>
                        <span>{opt.content}</span>
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
      <Card padding="lg" className="min-h-[400px]">
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
              <SubjectChapterTopicSelect
                value={{ ...bankCurriculum, subjectId: form.subjectId || bankCurriculum.subjectId }}
                onChange={(v) => setBankCurriculum(v)}
                layout="row"
                allowEmpty
              />
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
                            {q.questionType === 'SINGLE_CHOICE' ? 'Single' : 'Multiple'}
                          </span>
                          {q.chapter && (
                            <span className="text-xs text-slate-400">{q.chapter.name}</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-800 line-clamp-2">{q.content}</p>
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
              label="Show Results After Submit"
              description="Students can view correct answers and explanations after submitting."
              checked={form.showResult}
              onChange={(v) => updateForm('showResult', v)}
            />

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
                  max={99}
                  placeholder="Custom"
                  value={![1, 2, 3, 5].includes(form.maxAttempts) ? String(form.maxAttempts) : ''}
                  onChange={(e) => updateForm('maxAttempts', Math.max(1, Number(e.target.value)))}
                />
              </div>
            </div>
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
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Assign to Classes</h2>
            <p className="text-sm text-slate-500">
              Select the classes that will take this exam. You can also assign later.
            </p>

            {classes.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-500">No classes available. Create a class first.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {classes.map((cls) => {
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
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                        checked
                          ? 'border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                          checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked && (
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{cls.name}</p>
                        <p className="text-xs text-slate-500">
                          Grade {cls.gradeLevel}
                          {cls.subject ? ` · ${cls.subject.name}` : ''}
                          {cls._count?.classStudents != null ? ` · ${cls._count.classStudents} students` : ''}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Review Summary</h3>
              <dl className="grid gap-y-2 gap-x-6 text-sm sm:grid-cols-2">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Title</dt>
                  <dd className="font-medium text-slate-800">{form.title || '—'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Subject</dt>
                  <dd className="font-medium text-slate-800">{subjectName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Duration</dt>
                  <dd className="font-medium text-slate-800">{form.durationMin} min</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Questions</dt>
                  <dd className="font-medium text-slate-800">{form.selectedQuestionIds.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Passing Score</dt>
                  <dd className="font-medium text-slate-800">{form.passingScore}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Max Attempts</dt>
                  <dd className="font-medium text-slate-800">{form.maxAttempts}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Shuffle</dt>
                  <dd className="font-medium text-slate-800">{form.shuffle ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Show Results</dt>
                  <dd className="font-medium text-slate-800">{form.showResult ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Scheduled</dt>
                  <dd className="font-medium text-slate-800">{form.scheduleEnabled ? 'Yes' : 'No'}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Classes</dt>
                  <dd className="font-medium text-slate-800">{form.selectedClassIds.length}</dd>
                </div>
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
