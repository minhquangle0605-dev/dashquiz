/**
 * ═══════════════════════════════════════════════
 * IMPORT QUESTIONS FROM WORD / PDF
 * ───────────────────────────────────────────────
 * Three steps:
 *   1. upload    – pick file + curriculum target
 *   2. preview   – review parsed questions, edit
 *   3. result    – summary of saved questions
 * ═══════════════════════════════════════════════
 */
import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  SubjectChapterTopicSelect,
  emptyCurriculumSelection,
  type CurriculumSelection,
} from './SubjectChapterTopicSelect';
import {
  extractQuestionsFromDocument,
  bulkCreateQuestions,
} from '@/services/question.api';
import { MathText } from './MathText';
import type {
  ExtractedQuestion,
  ExtractFromDocumentResult,
  BulkCreateResult,
} from '@/types/question';

type Step = 'upload' | 'extracting' | 'preview' | 'saving' | 'result';

export interface ImportDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

export function ImportDocumentModal({
  isOpen,
  onClose,
  onImported,
}: ImportDocumentModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumSelection>(
    emptyCurriculumSelection(),
  );
  const [dragActive, setDragActive] = useState(false);
  const [extraction, setExtraction] = useState<ExtractFromDocumentResult | null>(
    null,
  );
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [saveResult, setSaveResult] = useState<BulkCreateResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setCurriculum(emptyCurriculumSelection());
    setExtraction(null);
    setQuestions([]);
    setSaveResult(null);
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'extracting' || step === 'saving') return;
    reset();
    onClose();
  }, [step, reset, onClose]);

  const handleFile = useCallback((f: File) => {
    const validExt = /\.(docx?|pdf)$/i;
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf',
    ];
    if (!validTypes.includes(f.type) && !validExt.test(f.name)) {
      toast.error('Please upload a Word (.docx) or PDF (.pdf) file.');
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast.error('File size must be under 15 MB.');
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile],
  );

  const handleExtract = async () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }
    setStep('extracting');
    try {
      const res = await extractQuestionsFromDocument(file);
      setExtraction(res);
      setQuestions(res.questions);
      if (res.questions.length === 0) {
        toast.error('No questions could be detected. Try a clearer file.');
        setStep('upload');
        return;
      }
      toast.success(
        `Detected ${res.questions.length} question(s) — please review.`,
      );
      setStep('preview');
    } catch (e: unknown) {
      setStep('upload');
      const msg =
        e instanceof Error ? e.message : 'Failed to extract. Please try again.';
      toast.error(msg);
    }
  };

  // ── Per-question editing helpers ──────────────────
  const updateQuestion = (
    idx: number,
    patch: Partial<ExtractedQuestion>,
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)),
    );
  };

  const updateOption = (
    qIdx: number,
    optIdx: number,
    patch: Partial<{ content: string; isCorrect: boolean }>,
  ) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = q.options.map((o, j) => {
          if (j !== optIdx) {
            return patch.isCorrect ? { ...o, isCorrect: false } : o;
          }
          return { ...o, ...patch };
        });
        return { ...q, options: opts };
      }),
    );
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Validate before saving ────────────────────────
  const validationErrors = (): string[] => {
    const errs: string[] = [];
    if (!curriculum.subjectId || !curriculum.chapterId || !curriculum.topicId) {
      errs.push('Please select Subject, Chapter, and Topic for the saved questions.');
    }
    questions.forEach((q, idx) => {
      if (!q.content.trim()) {
        errs.push(`Question #${idx + 1}: content is empty.`);
      }
      if (q.options.some((o) => !o.content.trim())) {
        errs.push(`Question #${idx + 1}: one or more options are empty.`);
      }
      if (q.options.filter((o) => o.isCorrect).length !== 1) {
        errs.push(`Question #${idx + 1}: exactly one correct option required.`);
      }
    });
    return errs;
  };

  const handleSave = async () => {
    const errs = validationErrors();
    if (errs.length > 0) {
      toast.error(errs[0]);
      return;
    }
    setStep('saving');
    try {
      const res = await bulkCreateQuestions(
        questions,
        Number(curriculum.subjectId),
        Number(curriculum.chapterId),
        Number(curriculum.topicId),
      );
      setSaveResult(res);
      if (res.imported > 0) {
        toast.success(`Saved ${res.imported} question(s).`);
        onImported();
      } else {
        toast.error('No questions were saved.');
      }
      setStep('result');
    } catch (e: unknown) {
      setStep('preview');
      const msg =
        e instanceof Error ? e.message : 'Failed to save questions.';
      toast.error(msg);
    }
  };

  // ─── Render ──────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Questions from Word / PDF"
      size="lg"
      className="!max-w-4xl"
    >
      {/* UPLOAD */}
      {step === 'upload' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <svg
              className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            <div className="text-sm text-indigo-900">
              <p className="font-semibold">AI-Powered Question Extraction</p>
              <p className="mt-0.5 text-indigo-700">
                Upload a Word or PDF file containing multiple-choice questions.
                We&apos;ll automatically detect the question content, options
                (A/B/C/D), correct answer and explanation.
                <br />
                <strong className="mt-1 block text-indigo-800">
                  ⚠️ Note for Math/Physics:
                </strong>
                Please convert equations to LaTeX format (e.g., using MathType's "Toggle TeX") before uploading.
              </p>
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
              accept=".docx,.doc,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFile(e.target.files[0]);
              }}
            />

            {file ? (
              <>
                <svg
                  className="mb-2 h-10 w-10 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-semibold text-emerald-800">
                  {file.name}
                </p>
                <p className="mt-1 text-xs text-emerald-600">
                  {(file.size / 1024).toFixed(1)} KB
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
                <svg
                  className="mb-3 h-10 w-10 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-700">
                  Drag &amp; drop your Word or PDF file here
                </p>
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
                <p className="mt-2 text-xs text-slate-400">
                  .docx, .doc or .pdf — max 15 MB
                </p>
              </>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">
              Recommended format
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-white p-2 text-[11px] leading-relaxed text-slate-600">
{`Câu 1: Phương trình nào sau đây là phương trình bậc hai?
A. x + 1 = 0
B. x² + 2x + 1 = 0
C. x³ = 8
D. 2x = 4
Đáp án: B
Giải thích: Phương trình bậc hai có dạng ax² + bx + c = 0`}
            </pre>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!file}
              onClick={handleExtract}
            >
              Extract Questions
            </Button>
          </div>
        </div>
      )}

      {/* EXTRACTING */}
      {step === 'extracting' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-600">
            Analyzing <strong>{file?.name}</strong>...
          </p>
          <p className="text-xs text-slate-400">
            AI is reading your file and bóc tách câu hỏi. This usually takes
            10–30 seconds.
          </p>
        </div>
      )}

      {/* PREVIEW */}
      {step === 'preview' && extraction && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">
                Detected {questions.length} question(s)
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  via {extraction.source === 'openai' ? 'AI' : 'Heuristic parser'}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-emerald-700">
                Review &amp; edit before saving. The correct option is
                highlighted.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
              Re-upload
            </Button>
          </div>

          {extraction.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {extraction.warnings.map((w, i) => (
                <p key={i}>• {w}</p>
              ))}
            </div>
          )}

          <SubjectChapterTopicSelect
            value={curriculum}
            onChange={setCurriculum}
            allowEmpty={false}
            labels={{
              subject: 'Target Subject *',
              chapter: 'Target Chapter *',
              topic: 'Target Topic *',
            }}
          />

          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {questions.map((q, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="text-xs font-semibold text-slate-500">
                    Question #{idx + 1}
                    {q.warnings.length > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        ⚠ needs review
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="text-xs font-medium text-red-600 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>

                <textarea
                  className="w-full resize-y rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  rows={2}
                  value={q.content}
                  onChange={(e) =>
                    updateQuestion(idx, { content: e.target.value })
                  }
                  placeholder="Question content"
                />
                {q.content.includes('$') && (
                  <div className="mt-1 rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">
                    <MathText>{q.content}</MathText>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {q.options.map((opt, oIdx) => (
                    <label
                      key={opt.label}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition-colors ${
                        opt.isCorrect
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`correct-${idx}`}
                        checked={opt.isCorrect}
                        onChange={() =>
                          updateOption(idx, oIdx, { isCorrect: true })
                        }
                        className="mt-2 h-4 w-4 text-emerald-600"
                      />
                      <span
                        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                          opt.isCorrect
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <div className="flex-1 flex flex-col gap-1">
                        <input
                          type="text"
                          value={opt.content}
                          onChange={(e) =>
                            updateOption(idx, oIdx, { content: e.target.value })
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                          placeholder={`Option ${opt.label}`}
                        />
                        {opt.content.includes('$') && (
                          <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1 text-sm text-slate-700">
                            <MathText>{opt.content}</MathText>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Difficulty
                    </label>
                    <select
                      value={q.difficulty}
                      onChange={(e) =>
                        updateQuestion(idx, {
                          difficulty: Number(e.target.value),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {[1, 2, 3, 4, 5].map((d) => (
                        <option key={d} value={d}>
                          {d} — {DIFFICULTY_LABELS[d]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">
                      Explanation (optional)
                    </label>
                    <input
                      type="text"
                      value={q.explanation || ''}
                      onChange={(e) =>
                        updateQuestion(idx, {
                          explanation: e.target.value || null,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Add an explanation"
                    />
                  </div>
                </div>

                {q.warnings.length > 0 && (
                  <ul className="mt-2 text-xs text-amber-700">
                    {q.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <p className="mr-auto text-xs text-slate-500">
              {questions.length} question(s) ready to save
            </p>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={questions.length === 0}
              onClick={handleSave}
            >
              Save {questions.length} Question{questions.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {/* SAVING */}
      {step === 'saving' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-medium text-slate-600">
            Saving {questions.length} question(s)...
          </p>
        </div>
      )}

      {/* RESULT */}
      {step === 'result' && saveResult && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">
                {saveResult.total}
              </p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">
                {saveResult.imported}
              </p>
              <p className="text-xs text-emerald-600">Saved</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">
                {saveResult.failed}
              </p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
          </div>

          {saveResult.errors && saveResult.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-red-200 text-left text-xs font-semibold text-red-700">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {saveResult.errors.map((err, i) => (
                    <tr
                      key={i}
                      className="border-b border-red-100 last:border-0"
                    >
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-red-800">
                        #{err.index + 1}
                      </td>
                      <td className="px-4 py-2 text-xs text-red-700">
                        {err.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={reset}>
              Import Another
            </Button>
            <Button variant="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
