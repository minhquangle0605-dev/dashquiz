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
  bulkCreateQuestions,
  downloadZipImportTemplate,
  importQuestionsFromZip,
} from '@/services/question.api';
import { MathText } from './MathText';
import type {
  BulkCreateResult,
  ExtractedOption,
  ExtractedQuestion,
  QuestionKind,
  ZipImportResult,
} from '@/types/question';

type Step = 'upload' | 'parsing' | 'preview' | 'saving' | 'result';

export interface ImportZipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

const MAX_ZIP_SIZE = 50 * 1024 * 1024;

const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

const QUESTION_TYPE_LABELS: Record<QuestionKind, string> = {
  SINGLE_CHOICE: 'Single choice',
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer',
  MATCHING: 'Matching',
};

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Merge an inline image URL into rich-HTML content for saving. */
function withImage(text: string, url?: string | null): string {
  const trimmed = text.trim();
  if (!url) return trimmed;
  const img = `<img src="${escapeHtmlAttribute(url)}" alt="question image" />`;
  return trimmed ? `${trimmed}<br/>${img}` : img;
}

function questionValidationErrors(q: ExtractedQuestion): string[] {
  const errors: string[] = [];
  if (!q.content.trim() && !q.questionImageUrl) {
    errors.push('Question content is empty.');
  }

  const correctCount = q.options.filter((o) => o.isCorrect).length;
  const optionEmpty = (o: ExtractedOption) => !o.content.trim() && !o.imageUrl;

  if (q.questionType === 'SINGLE_CHOICE') {
    if (q.options.length < 2) errors.push('At least two options are required.');
    if (q.options.some(optionEmpty)) errors.push('All options need content.');
    if (correctCount !== 1) errors.push('Exactly one correct option is required.');
  }

  if (q.questionType === 'MULTIPLE_CHOICE') {
    if (q.options.length < 2) errors.push('At least two options are required.');
    if (q.options.some(optionEmpty)) errors.push('All options need content.');
    if (correctCount < 1) errors.push('Select at least one correct option.');
  }

  if (q.questionType === 'TRUE_FALSE') {
    if (q.options.length !== 2) errors.push('True/False needs exactly two options.');
    if (correctCount !== 1) errors.push('Choose one correct answer.');
  }

  if (q.questionType === 'SHORT_ANSWER') {
    if (q.options.length < 1) errors.push('Add at least one accepted answer.');
    if (q.options.some(optionEmpty)) errors.push('Accepted answers cannot be empty.');
  }

  if (q.questionType === 'MATCHING' && q.options.length < 2) {
    errors.push('Add at least two matching pairs.');
  }

  return errors;
}

function ImageThumb({ url, label }: { url?: string | null; label: string }) {
  if (!url) return null;
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <img
        src={url}
        alt={label}
        loading="lazy"
        className="max-h-40 max-w-full rounded border border-slate-200 object-contain"
      />
    </div>
  );
}

export function ImportZipModal({ isOpen, onClose, onImported }: ImportZipModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumSelection>(
    emptyCurriculumSelection(),
  );
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseResult, setParseResult] = useState<ZipImportResult | null>(null);
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [saveResult, setSaveResult] = useState<BulkCreateResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setCurriculum(emptyCurriculumSelection());
    setDragActive(false);
    setUploadProgress(0);
    setParseResult(null);
    setQuestions([]);
    setSaveResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'parsing' || step === 'saving') return;
    reset();
    onClose();
  }, [step, reset, onClose]);

  const handleFile = useCallback((selected: File) => {
    if (!/\.zip$/i.test(selected.name)) {
      toast.error('Please upload a .zip file.');
      return;
    }
    if (selected.size > MAX_ZIP_SIZE) {
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

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadZipImportTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'question_image_import_template.zip';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the template.');
    }
  };

  const handleParse = async () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }
    setStep('parsing');
    setUploadProgress(0);
    try {
      const result = await importQuestionsFromZip(file, setUploadProgress);
      setParseResult(result);
      setQuestions(result.questions);
      if (result.questions.length === 0) {
        toast.error('No questions were found in the ZIP.');
        setStep('upload');
        return;
      }
      toast.success(
        result.invalid > 0
          ? `Parsed ${result.total} question(s), ${result.invalid} need review.`
          : `Parsed ${result.total} question(s).`,
      );
      setStep('preview');
    } catch (error: unknown) {
      setStep('upload');
      const message = error instanceof Error ? error.message : 'Failed to parse the ZIP.';
      toast.error(message);
    }
  };

  const updateQuestion = (index: number, patch: Partial<ExtractedQuestion>) => {
    setQuestions((prev) =>
      prev.map((question, i) => (i === index ? { ...question, ...patch } : question)),
    );
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    patch: Partial<ExtractedOption>,
  ) => {
    setQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;
        const single =
          question.questionType === 'SINGLE_CHOICE' ||
          question.questionType === 'TRUE_FALSE';
        const nextOptions = question.options.map((option, currentIndex) => {
          if (currentIndex !== optionIndex) {
            if (patch.isCorrect && single) return { ...option, isCorrect: false };
            return option;
          }
          return { ...option, ...patch };
        });
        return { ...question, options: nextOptions };
      }),
    );
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!curriculum.subjectId || !curriculum.gradeLevel || !curriculum.chapterId) {
      toast.error('Please select Subject, Grade and Chapter.');
      return;
    }
    const firstError = questions
      .flatMap((question, index) =>
        questionValidationErrors(question).map((message) => `Question #${index + 1}: ${message}`),
      )[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }

    // Merge inline image URLs into the rich-HTML content before saving.
    const payload: ExtractedQuestion[] = questions.map((question) => ({
      content: withImage(question.content, question.questionImageUrl),
      questionType: question.questionType,
      difficulty: question.difficulty,
      explanation:
        question.explanation || question.explanationImageUrl
          ? withImage(question.explanation ?? '', question.explanationImageUrl)
          : null,
      options: question.options.map((option) => ({
        label: option.label,
        content: withImage(option.content, option.imageUrl),
        isCorrect: option.isCorrect,
      })),
      warnings: [],
    }));

    setStep('saving');
    try {
      const result = await bulkCreateQuestions(
        payload,
        Number(curriculum.subjectId),
        Number(curriculum.chapterId),
      );
      setSaveResult(result);
      if (result.imported > 0) {
        toast.success(`Saved ${result.imported} question(s).`);
        onImported();
      } else {
        toast.error('No questions were saved.');
      }
      setStep('result');
    } catch (error: unknown) {
      setStep('preview');
      const message = error instanceof Error ? error.message : 'Failed to save questions.';
      toast.error(message);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Questions with Images (ZIP)"
      size="lg"
      className="!max-w-5xl"
    >
      {/* Upload */}
      {step === 'upload' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="flex-1 text-sm text-sky-800">
              <span className="font-semibold">Format:</span> a .zip containing{' '}
              <code className="rounded bg-white px-1">questions.json</code> and an{' '}
              <code className="rounded bg-white px-1">images/</code> folder. Each question can
              reference an image by its path, e.g. <code className="rounded bg-white px-1">images/q1.png</code>.
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
            >
              Download sample ZIP
            </button>
          </div>

          <div
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
              dragActive
                ? 'border-indigo-400 bg-indigo-50'
                : file
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-300 bg-slate-50 hover:border-slate-400'
            }`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.[0]) handleFile(event.target.files[0]);
              }}
            />

            {file ? (
              <>
                <p className="text-sm font-semibold text-emerald-800">{file.name}</p>
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
                <p className="text-sm font-medium text-slate-700">
                  Drag and drop a .zip file here
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
                <p className="mt-2 text-xs text-slate-400">.zip, max 50 MB, up to 500 questions</p>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!file} onClick={handleParse}>
              Upload &amp; Preview
            </Button>
          </div>
        </div>
      )}

      {/* Parsing */}
      {step === 'parsing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-600">
            Uploading and processing <strong>{file?.name}</strong>
          </p>
          <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-[width] duration-200"
              style={{ width: `${Math.max(uploadProgress, uploadProgress > 0 ? 12 : 0)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            Upload {uploadProgress}% complete. Images are stored after upload.
          </p>
        </div>
      )}

      {/* Preview */}
      {step === 'preview' && parseResult && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 text-center">
              <p className="text-xl font-bold text-slate-800">{parseResult.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <p className="text-xl font-bold text-emerald-700">{parseResult.valid}</p>
              <p className="text-xs text-emerald-600">Valid</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <p className="text-xl font-bold text-red-700">{parseResult.invalid}</p>
              <p className="text-xs text-red-600">Need review</p>
            </div>
          </div>

          {parseResult.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {parseResult.warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
            </div>
          )}

          <SubjectChapterTopicSelect
            value={curriculum}
            onChange={setCurriculum}
            allowEmpty={false}
            showTopic={false}
            labels={{
              subject: 'Target Subject *',
              grade: 'Target Grade *',
              chapter: 'Target Chapter *',
            }}
          />

          <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
            {questions.map((question, questionIndex) => {
              const detectedErrors = question.errors ?? [];
              const liveErrors = questionValidationErrors(question);
              const hasIssue = detectedErrors.length > 0 || liveErrors.length > 0;
              const isMultiple = question.questionType === 'MULTIPLE_CHOICE';
              const isChoice =
                question.questionType === 'SINGLE_CHOICE' ||
                question.questionType === 'MULTIPLE_CHOICE' ||
                question.questionType === 'TRUE_FALSE';
              return (
                <div
                  key={questionIndex}
                  className={`rounded-xl border bg-white p-4 ${
                    hasIssue ? 'border-red-300' : 'border-slate-200'
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                      <span>Question #{questionIndex + 1}</span>
                      <span className="rounded bg-slate-100 px-2 py-0.5">
                        {QUESTION_TYPE_LABELS[question.questionType]}
                      </span>
                      {hasIssue && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
                          needs review
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(questionIndex)}
                      className="text-xs font-medium text-red-600 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                    <textarea
                      className="min-h-[68px] w-full resize-y rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={question.content}
                      onChange={(event) =>
                        updateQuestion(questionIndex, { content: event.target.value })
                      }
                      placeholder="Question content"
                    />
                    <select
                      value={question.difficulty}
                      onChange={(event) =>
                        updateQuestion(questionIndex, { difficulty: Number(event.target.value) })
                      }
                      className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {[1, 2, 3, 4, 5].map((difficulty) => (
                        <option key={difficulty} value={difficulty}>
                          {difficulty} - {DIFFICULTY_LABELS[difficulty]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <ImageThumb url={question.questionImageUrl} label="Question image" />

                  {question.content.includes('$') && (
                    <div className="mt-2 rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">
                      <MathText>{question.content}</MathText>
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className={`rounded-lg border px-3 py-2 ${
                          option.isCorrect
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {isChoice && (
                            <input
                              type={isMultiple ? 'checkbox' : 'radio'}
                              name={`zip-correct-${questionIndex}`}
                              checked={option.isCorrect}
                              onChange={() =>
                                updateOption(questionIndex, optionIndex, {
                                  isCorrect: isMultiple ? !option.isCorrect : true,
                                })
                              }
                              className="mt-2 h-4 w-4 text-emerald-600"
                            />
                          )}
                          <span
                            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold ${
                              option.isCorrect
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {option.label}
                          </span>
                          <input
                            type="text"
                            value={option.content}
                            disabled={question.questionType === 'TRUE_FALSE'}
                            onChange={(event) =>
                              updateOption(questionIndex, optionIndex, {
                                content: event.target.value,
                              })
                            }
                            className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 disabled:bg-slate-50"
                            placeholder={`Option ${option.label}`}
                          />
                        </div>
                        <ImageThumb url={option.imageUrl} label={`Option ${option.label} image`} />
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <input
                      type="text"
                      value={question.explanation || ''}
                      onChange={(event) =>
                        updateQuestion(questionIndex, {
                          explanation: event.target.value || null,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Explanation (optional)"
                    />
                    <ImageThumb url={question.explanationImageUrl} label="Explanation image" />
                  </div>

                  {(detectedErrors.length > 0 || liveErrors.length > 0) && (
                    <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {[...new Set([...detectedErrors, ...liveErrors])].map((message, index) => (
                        <p key={index}>{message}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <p className="mr-auto text-xs text-slate-500">
              {questions.length} question(s) ready for review
            </p>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={questions.length === 0} onClick={handleSave}>
              Confirm and Import
            </Button>
          </div>
        </div>
      )}

      {/* Saving */}
      {step === 'saving' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-medium text-slate-600">
            Saving {questions.length} question(s)
          </p>
        </div>
      )}

      {/* Result */}
      {step === 'result' && saveResult && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-slate-50 p-4 text-center">
              <p className="text-2xl font-bold text-slate-800">{saveResult.total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{saveResult.imported}</p>
              <p className="text-xs text-emerald-600">Saved</p>
            </div>
            <div className="rounded-lg bg-red-50 p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{saveResult.failed}</p>
              <p className="text-xs text-red-600">Failed</p>
            </div>
          </div>

          {saveResult.errors && saveResult.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50">
              <table className="w-full text-sm">
                <tbody>
                  {saveResult.errors.map((error, index) => (
                    <tr key={index} className="border-b border-red-100 last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-red-800">
                        #{error.index + 1}
                      </td>
                      <td className="px-4 py-2 text-xs text-red-700">{error.message}</td>
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
