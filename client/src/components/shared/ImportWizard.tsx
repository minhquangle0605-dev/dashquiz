import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import api from '@/services/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  SubjectChapterTopicSelect,
  emptyCurriculumSelection,
  type CurriculumSelection,
} from './SubjectChapterTopicSelect';
import { QuestionPreviewEditor } from './QuestionPreviewEditor';
import { AiSuggestionPanel } from './AiSuggestionPanel';
import { aiSuggestQuestion } from '@/services/question.api';
import { API_ENDPOINTS } from '@/utils/constants';
import {
  createImportJob,
  getImportJob,
  getImportPreview,
  updateImportPreviewItem,
  bulkFixImportJob,
  revalidateImportJob,
  commitImportJob,
  listImportJobs,
  retryImportJob,
  deleteImportJob,
} from '@/services/importJob.api';
import type {
  AiSuggestion,
  ImportCommitResult,
  ImportJob,
  ImportPreviewItem,
  NormalizedImportQuestion,
  QuestionKind,
} from '@/types/question';

type Step = 'upload' | 'processing' | 'review' | 'committing' | 'result';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const VALID_EXT = /\.(xlsx|xls|docx?|pdf|txt|gift|zip|png|jpe?g|webp)$/i;
const POLL_INTERVAL_MS = 1200;

const QUESTION_TYPE_LABELS: Record<QuestionKind, string> = {
  SINGLE_CHOICE: 'Single choice',
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer',
  MATCHING: 'Matching',
};

export interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  /** Optional: open straight onto an existing job's review step (from the dashboard). */
  resumeJobId?: number | null;
}

const JOB_STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600',
  PARSING: 'bg-sky-100 text-sky-700',
  READY: 'bg-emerald-100 text-emerald-700',
  COMMITTING: 'bg-indigo-100 text-indigo-700',
  COMPLETED: 'bg-indigo-100 text-indigo-700',
  FAILED: 'bg-red-100 text-red-700',
};

function JobStatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${JOB_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.toLowerCase()}
    </span>
  );
}

function detectKindLabel(name: string): string {
  if (/\.zip$/i.test(name)) return 'ZIP bundle (questions.json + images)';
  if (/\.(xlsx|xls)$/i.test(name)) return 'Excel spreadsheet';
  if (/\.(png|jpe?g|webp)$/i.test(name)) return 'Image — read with OCR';
  if (/\.(docx?|pdf|txt|gift)$/i.test(name)) return 'Document (Word / PDF / TXT / GIFT)';
  return 'Unknown';
}

async function downloadTemplate(endpoint: string, filename: string) {
  try {
    const { data } = await api.get(endpoint, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error('Could not download the template.');
  }
}

function validItemSelection(items: ImportPreviewItem[]): Set<number> {
  return new Set(items.filter((i) => i.status === 'VALID').map((i) => i.id));
}

export function ImportWizard({ isOpen, onClose, onImported, resumeJobId }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumSelection>(emptyCurriculumSelection());
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [job, setJob] = useState<ImportJob | null>(null);
  const [items, setItems] = useState<ImportPreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDifficulty, setBulkDifficulty] = useState('');
  const [bulkType, setBulkType] = useState('');
  const [recentJobs, setRecentJobs] = useState<ImportJob[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, AiSuggestion>>({});
  const [aiLoadingId, setAiLoadingId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<Map<number, NormalizedImportQuestion>>(new Map());
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setCurriculum(emptyCurriculumSelection());
    setDragActive(false);
    setUploadProgress(0);
    setJob(null);
    setItems([]);
    setSelectedIds(new Set());
    setSavingIds(new Set());
    setCommitResult(null);
    setShowOnlyIssues(false);
    setBulkDifficulty('');
    setBulkType('');
    pendingRef.current.clear();
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'processing' || step === 'committing') return;
    reset();
    onClose();
  }, [step, reset, onClose]);

  // ── Load an existing job's preview (resume from dashboard) ──
  const loadPreview = useCallback(async (jobId: number) => {
    const preview = await getImportPreview(jobId);
    setJob(preview.job);
    setItems(preview.items);
    setSelectedIds(validItemSelection(preview.items));
    setStep('review');
  }, []);

  useEffect(() => {
    if (isOpen && resumeJobId) {
      reset();
      loadPreview(resumeJobId).catch(() => {
        toast.error('Could not open this import job.');
        handleClose();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, resumeJobId]);

  // ── Recent imports dashboard (shown on the upload step) ──
  const loadJobs = useCallback(async () => {
    try {
      setRecentJobs(await listImportJobs());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    if (isOpen && step === 'upload' && !resumeJobId) void loadJobs();
  }, [isOpen, step, resumeJobId, loadJobs]);

  const handleResume = async (jobId: number) => {
    try {
      await loadPreview(jobId);
    } catch {
      toast.error('Could not open this import.');
    }
  };

  const handleRetry = async (jobId: number) => {
    try {
      const fresh = await retryImportJob(jobId);
      setJob(fresh);
      setFile(null);
      setStep('processing');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Retry failed.');
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    try {
      await deleteImportJob(jobId);
      await loadJobs();
    } catch {
      toast.error('Could not delete this import.');
    }
  };

  // ── Poll job status while parsing ──
  useEffect(() => {
    if (step !== 'processing' || !job) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const fresh = await getImportJob(job.id);
        if (cancelled) return;
        setJob(fresh);
        if (fresh.status === 'READY' || fresh.status === 'COMPLETED') {
          await loadPreview(fresh.id);
          return;
        }
        if (fresh.status === 'FAILED') return; // stay on processing screen, show error
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
      }
    };
    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step, job, loadPreview]);

  // ── File selection ──
  const handleFile = useCallback((selected: File) => {
    if (!VALID_EXT.test(selected.name)) {
      toast.error('Use Excel (.xlsx/.xls), Word/PDF/TXT/GIFT, or a ZIP bundle.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      toast.error('File size must be under 50 MB.');
      return;
    }
    setFile(selected);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragActive(false);
      if (event.dataTransfer.files?.[0]) handleFile(event.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const taxonomyReady = Boolean(curriculum.subjectId && curriculum.gradeLevel && curriculum.chapterId);

  const handleStart = async () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }
    if (!taxonomyReady) {
      toast.error('Please choose Subject, Grade and Chapter.');
      return;
    }
    setUploadProgress(0);
    try {
      const created = await createImportJob(
        file,
        {
          subjectId: Number(curriculum.subjectId),
          chapterId: Number(curriculum.chapterId),
          topicId: curriculum.topicId ? Number(curriculum.topicId) : undefined,
        },
        setUploadProgress,
      );
      setJob(created);
      setStep('processing');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start the import.';
      toast.error(message);
    }
  };

  // ── Per-item edit with debounced persistence ──
  const flushItem = useCallback(async (itemId: number) => {
    const pending = pendingRef.current.get(itemId);
    if (!pending) return;
    pendingRef.current.delete(itemId);
    setSavingIds((prev) => new Set(prev).add(itemId));
    try {
      const updated = await updateImportPreviewItem(itemId, pending);
      setItems((prev) => prev.map((it) => (it.id === itemId ? updated : it)));
      if (updated.status !== 'VALID') {
        setSelectedIds((prev) => {
          if (!prev.has(itemId)) return prev;
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }
    } catch {
      toast.error('Could not save the change to this question.');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, []);

  const handleItemChange = useCallback(
    (itemId: number, question: NormalizedImportQuestion) => {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, normalizedJson: question } : it)));
      pendingRef.current.set(itemId, question);
      const existing = timersRef.current.get(itemId);
      if (existing) clearTimeout(existing);
      timersRef.current.set(itemId, setTimeout(() => void flushItem(itemId), 700));
    },
    [flushItem],
  );

  const flushAll = useCallback(async () => {
    const ids = Array.from(pendingRef.current.keys());
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current.clear();
    await Promise.all(ids.map((id) => flushItem(id)));
  }, [flushItem]);

  // ── Bulk repair ──
  const applyBulk = useCallback(
    async (run: () => Promise<{ job: ImportJob; items: ImportPreviewItem[] }>) => {
      setBulkBusy(true);
      try {
        await flushAll();
        const preview = await run();
        setJob(preview.job);
        setItems(preview.items);
        setSelectedIds((prev) => {
          // keep the user's selection where still valid, default-add newly valid
          const next = new Set<number>();
          preview.items.forEach((it) => {
            if (it.status === 'VALID' && (prev.has(it.id) || prev.size === 0)) next.add(it.id);
          });
          return next.size > 0 ? next : validItemSelection(preview.items);
        });
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Bulk action failed.');
      } finally {
        setBulkBusy(false);
      }
    },
    [flushAll],
  );

  const handleTaxonomyChange = (next: CurriculumSelection) => {
    setCurriculum(next);
    if (job && next.subjectId && next.chapterId) {
      bulkFixImportJob(job.id, {
        type: 'set-taxonomy',
        subjectId: Number(next.subjectId),
        chapterId: Number(next.chapterId),
        topicId: next.topicId ? Number(next.topicId) : null,
      }).catch(() => undefined);
    }
  };

  // ── AI enrichment suggestions ──
  const handleAiSuggest = async (item: ImportPreviewItem) => {
    setAiLoadingId(item.id);
    try {
      const q = item.normalizedJson;
      const suggestion = await aiSuggestQuestion({
        content: q.content,
        questionType: q.questionType,
        options: q.options.map((o) => ({ label: o.label, content: o.content, isCorrect: o.isCorrect })),
        currentDifficulty: q.difficulty,
      });
      setAiSuggestions((prev) => ({ ...prev, [item.id]: suggestion }));
      if (!suggestion.available) toast.error('AI suggestions are not configured on the server.');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'AI suggestion failed.');
    } finally {
      setAiLoadingId(null);
    }
  };

  const dismissAi = (itemId: number) =>
    setAiSuggestions((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });

  // ── Commit ──
  const handleCommit = async () => {
    if (!job) return;
    if (selectedIds.size === 0) {
      toast.error('Select at least one question to save.');
      return;
    }
    setStep('committing');
    try {
      await flushAll();
      const result = await commitImportJob(job.id, Array.from(selectedIds));
      setCommitResult(result);
      if (result.imported > 0) {
        toast.success(`Saved ${result.imported} question(s).`);
        onImported();
      } else {
        toast.error('No questions were saved.');
      }
      const fresh = await getImportJob(job.id);
      setJob(fresh);
      setStep('result');
    } catch (error: unknown) {
      setStep('review');
      toast.error(error instanceof Error ? error.message : 'Failed to save questions.');
    }
  };

  // ── Derived counts (computed locally for responsiveness) ──
  const counts = {
    total: items.length,
    valid: items.filter((i) => i.status === 'VALID').length,
    invalid: items.filter((i) => i.status === 'INVALID').length,
    committed: items.filter((i) => i.status === 'COMMITTED').length,
    skipped: items.filter((i) => i.status === 'SKIPPED').length,
    warnings: items.reduce((n, i) => n + (i.validationJson?.warnings?.length ?? 0), 0),
  };

  const visibleItems = items.filter((it) => {
    if (it.status === 'SKIPPED' || it.status === 'COMMITTED') return false;
    if (!showOnlyIssues) return true;
    return (
      (it.validationJson?.critical?.length ?? 0) > 0 ||
      (it.validationJson?.warnings?.length ?? 0) > 0 ||
      (it.duplicateJson?.matches?.length ?? 0) > 0
    );
  });

  const allValidSelected =
    counts.valid > 0 && items.filter((i) => i.status === 'VALID').every((i) => selectedIds.has(i.id));

  const toggleSelectAll = () => {
    setSelectedIds(allValidSelected ? new Set() : validItemSelection(items));
  };

  const failed = job?.status === 'FAILED';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Questions"
      size="lg"
      className="!max-w-5xl"
    >
      {/* STEP 1 — UPLOAD */}
      {step === 'upload' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
            <span className="font-semibold">One importer for every source.</span>
            <span>Excel, Word, PDF (incl. scanned via OCR), TXT, GIFT, images (PNG/JPG/WebP via OCR), or a ZIP bundle — we detect the type automatically.</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadTemplate(API_ENDPOINTS.QUESTIONS.IMPORT_TEMPLATE, 'question_import_template.xlsx')}
                className="rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
              >
                Excel template
              </button>
              <button
                type="button"
                onClick={() => downloadTemplate(API_ENDPOINTS.QUESTIONS.DOCUMENT_IMPORT_TEMPLATE, 'question_document_template.pdf')}
                className="rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
              >
                Document guide
              </button>
              <button
                type="button"
                onClick={() => downloadTemplate(API_ENDPOINTS.QUESTIONS.ZIP_IMPORT_TEMPLATE, 'question_image_import_template.zip')}
                className="rounded-lg border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
              >
                ZIP sample
              </button>
            </div>
          </div>

          <div
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragActive
                ? 'border-indigo-400 bg-indigo-50'
                : file
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-300 bg-slate-50 hover:border-slate-400'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.docx,.doc,.pdf,.txt,.gift,.zip,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />
            {file ? (
              <>
                <p className="text-sm font-semibold text-emerald-800">{file.name}</p>
                <p className="mt-1 text-xs text-emerald-600">
                  {(file.size / 1024).toFixed(1)} KB · {detectKindLabel(file.name)}
                </p>
                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-slate-500 underline hover:text-slate-700"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                >
                  Change file
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-700">Drag and drop a file here</p>
                <p className="mt-1 text-xs text-slate-500">
                  or{' '}
                  <button
                    type="button"
                    className="font-semibold text-indigo-600 hover:text-indigo-500"
                    onClick={() => inputRef.current?.click()}
                  >
                    browse files
                  </button>
                </p>
                <p className="mt-2 text-xs text-slate-400">.xlsx .xls .docx .pdf .txt .gift .zip .png .jpg .webp · max 50 MB</p>
              </>
            )}
          </div>

          <SubjectChapterTopicSelect
            value={curriculum}
            onChange={setCurriculum}
            allowEmpty={false}
            showTopic
            labels={{
              subject: 'Target Subject *',
              grade: 'Target Grade *',
              chapter: 'Target Chapter *',
              topic: 'Target Topic (optional)',
            }}
          />

          {recentJobs.length > 0 && (
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                Recent imports
              </div>
              <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto">
                {recentJobs.map((j) => (
                  <li key={j.id} className="flex items-center gap-3 px-3 py-2">
                    <JobStatusBadge status={j.status} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{j.fileName}</p>
                      <p className="text-xs text-slate-400">
                        {j.sourceFormat} · {j.validItems} valid / {j.invalidItems} review · {j.importedCount} saved
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {(j.status === 'READY' || j.status === 'COMPLETED' || j.status === 'COMMITTING') &&
                        j.totalItems > 0 && (
                          <button
                            type="button"
                            onClick={() => void handleResume(j.id)}
                            className="font-semibold text-indigo-600 hover:text-indigo-500"
                          >
                            Review
                          </button>
                        )}
                      {j.status === 'FAILED' && (
                        <button
                          type="button"
                          onClick={() => void handleRetry(j.id)}
                          className="font-semibold text-amber-600 hover:text-amber-500"
                        >
                          Retry
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteJob(j.id)}
                        className="font-medium text-slate-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!file || !taxonomyReady} onClick={handleStart}>
              Start Import
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — PROCESSING */}
      {step === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          {failed ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">!</div>
              <p className="text-sm font-semibold text-red-700">Import failed</p>
              <p className="max-w-md text-center text-xs text-slate-500">
                {job?.errorMessage || 'The file could not be parsed.'}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { reset(); }}>
                  Start over
                </Button>
                <Button variant="primary" onClick={handleClose}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
              <p className="text-sm font-medium text-slate-600">
                {uploadProgress < 100 ? 'Uploading' : 'Parsing & validating'} <strong>{file?.name ?? job?.fileName}</strong>
              </p>
              <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-[width] duration-200"
                  style={{ width: `${Math.max(uploadProgress < 100 ? uploadProgress : (job?.progress ?? 50), 8)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">You can keep this open — large files process in the background.</p>
            </>
          )}
        </div>
      )}

      {/* STEP 3 — REVIEW */}
      {step === 'review' && job && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: 'Total', value: counts.total, cls: 'bg-slate-50 text-slate-800' },
              { label: 'Valid', value: counts.valid, cls: 'bg-emerald-50 text-emerald-700' },
              { label: 'Need review', value: counts.invalid, cls: 'bg-red-50 text-red-700' },
              { label: 'Warnings', value: counts.warnings, cls: 'bg-amber-50 text-amber-700' },
              { label: 'Saved', value: counts.committed, cls: 'bg-indigo-50 text-indigo-700' },
            ].map((c) => (
              <div key={c.label} className={`rounded-lg p-3 text-center ${c.cls}`}>
                <p className="text-xl font-bold">{c.value}</p>
                <p className="text-xs opacity-80">{c.label}</p>
              </div>
            ))}
          </div>

          <SubjectChapterTopicSelect
            value={curriculum}
            onChange={handleTaxonomyChange}
            allowEmpty={false}
            showTopic
            labels={{
              subject: 'Target Subject *',
              grade: 'Target Grade *',
              chapter: 'Target Chapter *',
              topic: 'Target Topic (optional)',
            }}
          />

          {/* Bulk repair toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
            <span className="font-semibold text-slate-600">Bulk repair:</span>
            <select
              value={bulkDifficulty}
              disabled={bulkBusy}
              onChange={(e) => {
                const v = e.target.value;
                setBulkDifficulty(v);
                if (v) void applyBulk(() => bulkFixImportJob(job.id, { type: 'set-difficulty', difficulty: Number(v) }));
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1"
            >
              <option value="">Set difficulty…</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  Difficulty {d}
                </option>
              ))}
            </select>
            <select
              value={bulkType}
              disabled={bulkBusy}
              onChange={(e) => {
                const v = e.target.value;
                setBulkType(v);
                if (v) void applyBulk(() => bulkFixImportJob(job.id, { type: 'set-type', questionType: v as QuestionKind }));
              }}
              className="rounded border border-slate-300 bg-white px-2 py-1"
            >
              <option value="">Set type…</option>
              {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={bulkBusy || counts.invalid === 0}
              onClick={() => void applyBulk(() => bulkFixImportJob(job.id, { type: 'skip-invalid' }))}
              className="rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Skip all invalid
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void applyBulk(() => revalidateImportJob(job.id))}
              className="rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              Re-validate
            </button>
            <label className="ml-auto flex items-center gap-1.5 text-slate-600">
              <input
                type="checkbox"
                checked={showOnlyIssues}
                onChange={(e) => setShowOnlyIssues(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Only show items with issues
            </label>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <button type="button" onClick={toggleSelectAll} className="font-semibold text-indigo-600 hover:text-indigo-500">
              {allValidSelected ? 'Deselect all' : 'Select all valid'}
            </button>
            <span>{selectedIds.size} selected for import</span>
          </div>

          <div className="max-h-[52vh] space-y-3 overflow-y-auto pr-1">
            {visibleItems.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nothing to review here.</p>
            ) : (
              visibleItems.map((item) => (
                <QuestionPreviewEditor
                  key={item.id}
                  index={item.orderIndex}
                  question={item.normalizedJson}
                  validation={item.validationJson}
                  status={item.status}
                  sourceLine={item.sourceLine}
                  selected={selectedIds.has(item.id)}
                  saving={savingIds.has(item.id)}
                  duplicates={item.duplicateJson?.matches}
                  aiLoading={aiLoadingId === item.id}
                  onAiSuggest={() => void handleAiSuggest(item)}
                  aiPanel={
                    aiSuggestions[item.id] ? (
                      <AiSuggestionPanel
                        suggestion={aiSuggestions[item.id]}
                        current={{
                          difficulty: item.normalizedJson.difficulty,
                          explanation: item.normalizedJson.explanation,
                        }}
                        onApplyDifficulty={(d) =>
                          handleItemChange(item.id, { ...item.normalizedJson, difficulty: d })
                        }
                        onApplyExplanation={(t) =>
                          handleItemChange(item.id, { ...item.normalizedJson, explanation: t })
                        }
                        onDismiss={() => dismissAi(item.id)}
                      />
                    ) : null
                  }
                  onSelectChange={(checked) =>
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    })
                  }
                  onChange={(q) => handleItemChange(item.id, q)}
                  onSkip={() => void applyBulk(() => bulkFixImportJob(job.id, { type: 'skip', itemIds: [item.id] }))}
                />
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <p className="mr-auto text-xs text-slate-500">
              {job.parserSource ? `Parsed by ${job.parserSource}` : ''}
            </p>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
            <Button variant="primary" disabled={selectedIds.size === 0 || bulkBusy} onClick={handleCommit}>
              Save {selectedIds.size} to bank
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — COMMITTING */}
      {step === 'committing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-medium text-slate-600">Saving {selectedIds.size} question(s)…</p>
        </div>
      )}

      {/* RESULT */}
      {step === 'result' && commitResult && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Selected', value: commitResult.total, cls: 'bg-slate-50 text-slate-800' },
              { label: 'Saved', value: commitResult.imported, cls: 'bg-emerald-50 text-emerald-700' },
              { label: 'Skipped', value: commitResult.skipped, cls: 'bg-amber-50 text-amber-700' },
              { label: 'Failed', value: commitResult.failed, cls: 'bg-red-50 text-red-700' },
            ].map((c) => (
              <div key={c.label} className={`rounded-lg p-4 text-center ${c.cls}`}>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs opacity-80">{c.label}</p>
              </div>
            ))}
          </div>

          {commitResult.errors && commitResult.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50">
              <table className="w-full text-sm">
                <tbody>
                  {commitResult.errors.map((error, i) => (
                    <tr key={i} className="border-b border-red-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-red-800">#{error.index + 1}</td>
                      <td className="px-4 py-2 text-xs text-red-700">{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {counts.valid > 0 && (
            <p className="text-xs text-slate-500">
              {counts.valid} more valid question(s) remain in this job — you can keep reviewing and saving them.
            </p>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            {counts.valid > 0 ? (
              <Button variant="outline" onClick={() => setStep('review')}>
                Back to review
              </Button>
            ) : (
              <Button variant="outline" onClick={reset}>
                Import another
              </Button>
            )}
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
