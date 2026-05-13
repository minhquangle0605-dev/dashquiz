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
  downloadDocumentImportTemplate,
  extractQuestionsFromDocument,
} from '@/services/question.api';
import { MathText } from './MathText';
import type {
  BulkCreateResult,
  ExtractedOption,
  ExtractedQuestion,
  ExtractFromDocumentResult,
  QuestionKind,
} from '@/types/question';

type Step = 'upload' | 'extracting' | 'preview' | 'saving' | 'result';

export interface ImportDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

const DIFFICULTY_LABELS = ['', 'Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard'];

const QUESTION_TYPE_LABELS: Record<QuestionKind, string> = {
  SINGLE_CHOICE: 'Single choice',
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer',
  MATCHING: 'Matching',
};

function labelFromIndex(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function relabelOptions(options: ExtractedOption[]): ExtractedOption[] {
  return options.map((option, index) => ({
    ...option,
    label: labelFromIndex(index),
  }));
}

function makeOption(index: number, content = '', isCorrect = false): ExtractedOption {
  return {
    label: labelFromIndex(index),
    content,
    isCorrect,
  };
}

function splitMatchingPair(content: string): { left: string; right: string } {
  const [left = '', ...rightParts] = content.split(/\s*=>\s*/);
  return {
    left: left.trim(),
    right: rightParts.join(' => ').trim(),
  };
}

function formatMatchingPair(left: string, right: string): string {
  return `${left.trim()} => ${right.trim()}`.trim();
}

function questionValidationErrors(q: ExtractedQuestion): string[] {
  const errors: string[] = [];
  if (!q.content.trim()) errors.push('Question content is empty.');

  if (q.questionType === 'SINGLE_CHOICE') {
    if (q.options.length < 2) errors.push('At least two options are required.');
    if (q.options.some((option) => !option.content.trim())) {
      errors.push('All options need content.');
    }
    if (q.options.filter((option) => option.isCorrect).length !== 1) {
      errors.push('Exactly one correct option is required.');
    }
  }

  if (q.questionType === 'MULTIPLE_CHOICE') {
    if (q.options.length < 2) errors.push('At least two options are required.');
    if (q.options.some((option) => !option.content.trim())) {
      errors.push('All options need content.');
    }
    if (q.options.filter((option) => option.isCorrect).length < 1) {
      errors.push('Select at least one correct option.');
    }
  }

  if (q.questionType === 'TRUE_FALSE') {
    if (q.options.length !== 2) errors.push('True/False needs exactly two options.');
    if (q.options.filter((option) => option.isCorrect).length !== 1) {
      errors.push('Choose True or False as the correct answer.');
    }
  }

  if (q.questionType === 'SHORT_ANSWER') {
    if (q.options.length < 1) errors.push('Add at least one accepted answer.');
    if (q.options.some((option) => !option.content.trim())) {
      errors.push('Accepted answers cannot be empty.');
    }
  }

  if (q.questionType === 'MATCHING') {
    if (q.options.length < 2) errors.push('Add at least two matching pairs.');
    q.options.forEach((option, index) => {
      const pair = splitMatchingPair(option.content);
      if (!pair.left || !pair.right) {
        errors.push(`Pair #${index + 1} needs both left and right values.`);
      }
    });
  }

  return errors;
}

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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extraction, setExtraction] = useState<ExtractFromDocumentResult | null>(null);
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [saveResult, setSaveResult] = useState<BulkCreateResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setCurriculum(emptyCurriculumSelection());
    setDragActive(false);
    setUploadProgress(0);
    setExtraction(null);
    setQuestions([]);
    setSaveResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleClose = useCallback(() => {
    if (step === 'extracting' || step === 'saving') return;
    reset();
    onClose();
  }, [step, reset, onClose]);

  const handleFile = useCallback((selected: File) => {
    const validExt = /\.(docx?|pdf|txt|gift)$/i;
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf',
      'text/plain',
      'application/gift',
    ];
    if (!validTypes.includes(selected.type) && !validExt.test(selected.name)) {
      toast.error('Please upload a Word, PDF, TXT, or GIFT file.');
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      toast.error('File size must be under 15 MB.');
      return;
    }
    setFile(selected);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragActive(false);
      if (event.dataTransfer.files?.[0]) {
        handleFile(event.dataTransfer.files[0]);
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
    setUploadProgress(0);
    try {
      const result = await extractQuestionsFromDocument(file, setUploadProgress);
      setExtraction(result);
      setQuestions(result.questions);
      if (result.questions.length === 0) {
        toast.error('No questions could be detected.');
        setStep('upload');
        return;
      }
      const issueCount = result.questions.filter(
        (question) =>
          (question.errors?.length ?? 0) > 0 ||
          questionValidationErrors(question).length > 0,
      ).length;
      toast.success(
        issueCount > 0
          ? `Detected ${result.questions.length} question(s), ${issueCount} need review.`
          : `Detected ${result.questions.length} question(s).`,
      );
      setStep('preview');
    } catch (error: unknown) {
      setStep('upload');
      const message = error instanceof Error ? error.message : 'Failed to extract questions.';
      toast.error(message);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadDocumentImportTemplate();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'question_document_import_template.pdf';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the template.');
    }
  };

  const updateQuestion = (index: number, patch: Partial<ExtractedQuestion>) => {
    setQuestions((prev) =>
      prev.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
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
        const nextOptions = question.options.map((option, currentIndex) => {
          if (currentIndex !== optionIndex) {
            if (
              patch.isCorrect &&
              (question.questionType === 'SINGLE_CHOICE' ||
                question.questionType === 'TRUE_FALSE')
            ) {
              return { ...option, isCorrect: false };
            }
            return option;
          }
          return { ...option, ...patch };
        });
        return { ...question, options: nextOptions };
      }),
    );
  };

  const changeQuestionType = (questionIndex: number, questionType: QuestionKind) => {
    setQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;
        let options = question.options;
        if (questionType === 'TRUE_FALSE') {
          const existingCorrect = options.find((option) => option.isCorrect)?.label;
          options = [
            { label: 'A', content: 'True', isCorrect: existingCorrect !== 'B' },
            { label: 'B', content: 'False', isCorrect: existingCorrect === 'B' },
          ];
        } else if (questionType === 'SHORT_ANSWER') {
          options = options.length > 0 ? relabelOptions(options.map((o) => ({ ...o, isCorrect: true }))) : [makeOption(0, '', true)];
        } else if (questionType === 'MATCHING') {
          options = options.length >= 2 ? relabelOptions(options.map((o) => ({ ...o, isCorrect: true }))) : [makeOption(0, 'Left 1 => Right 1', true), makeOption(1, 'Left 2 => Right 2', true)];
        } else {
          options = options.length >= 2 ? relabelOptions(options) : [makeOption(0), makeOption(1)];
          if (questionType === 'SINGLE_CHOICE') {
            const firstCorrect = options.findIndex((option) => option.isCorrect);
            options = options.map((option, optIndex) => ({
              ...option,
              isCorrect: optIndex === (firstCorrect >= 0 ? firstCorrect : 0),
            }));
          }
        }
        return { ...question, questionType, options };
      }),
    );
  };

  const addOption = (questionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;
        const next =
          question.questionType === 'MATCHING'
            ? makeOption(question.options.length, 'Left => Right', true)
            : makeOption(question.options.length, '', question.questionType === 'SHORT_ANSWER');
        return { ...question, options: [...question.options, next] };
      }),
    );
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;
        return {
          ...question,
          options: relabelOptions(question.options.filter((_, currentIndex) => currentIndex !== optionIndex)),
        };
      }),
    );
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const validationErrors = (): string[] => {
    const errors: string[] = [];
    if (!curriculum.subjectId || !curriculum.chapterId || !curriculum.topicId) {
      errors.push('Please select Subject, Chapter, and Topic.');
    }
    questions.forEach((question, index) => {
      questionValidationErrors(question).forEach((error) => {
        errors.push(`Question #${index + 1}: ${error}`);
      });
    });
    return errors;
  };

  const handleSave = async () => {
    const errors = validationErrors();
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }
    setStep('saving');
    try {
      const result = await bulkCreateQuestions(
        questions,
        Number(curriculum.subjectId),
        Number(curriculum.chapterId),
        Number(curriculum.topicId),
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
      title="Import Questions from Document / GIFT"
      size="lg"
      className="!max-w-5xl"
    >
      {step === 'upload' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="flex-1 text-sm text-sky-800">
              <span className="font-semibold">Template rules:</span> use "Cau 1:",
              answer labels such as "A.", "Dap an:", or GIFT syntax for short answer and matching.
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100"
            >
              Download PDF template
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
              accept=".docx,.doc,.pdf,.txt,.gift,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
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
                  Drag and drop a Word, PDF, TXT, or GIFT file here
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
                <p className="mt-2 text-xs text-slate-400">.docx, .doc, .pdf, .txt or .gift, max 15 MB</p>
              </>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] leading-relaxed text-slate-600">
{`Cau 1: Which equation is quadratic?
A. x + 1 = 0
*B. x^2 + 2x + 1 = 0
C. x^3 = 8
D. 2x = 4
Giai thich: A quadratic equation has degree 2.

Cau 2: Water boils at 100C [T]

Cau 3: Type: Short Answer
Chemical symbol of water?
Dap an: H2O

Cau 4: Short Answer GIFT
Capital of Vietnam is {=Ha Noi =Hanoi}

Cau 5: Matching GIFT
Match each country to its capital: {
=Vietnam -> Hanoi
=Japan -> Tokyo
}`}
            </pre>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!file} onClick={handleExtract}>
              Extract Questions
            </Button>
          </div>
        </div>
      )}

      {step === 'extracting' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm font-medium text-slate-600">
            Processing <strong>{file?.name}</strong>
          </p>
          <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-[width] duration-200"
              style={{ width: `${Math.max(uploadProgress, uploadProgress > 0 ? 12 : 0)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            Upload {uploadProgress}% complete. Text extraction continues after upload.
          </p>
        </div>
      )}

      {step === 'preview' && extraction && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-sm text-emerald-900">
              <p className="font-semibold">
                Detected {questions.length} question(s)
                <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {extraction.source === 'openai' ? 'AI parser' : 'Template parser'}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-emerald-700">
                Review every highlighted item before saving.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
              Re-upload
            </Button>
          </div>

          {extraction.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {extraction.warnings.map((warning, index) => (
                <p key={index}>{warning}</p>
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

          <div className="max-h-[58vh] space-y-3 overflow-y-auto pr-1">
            {questions.map((question, questionIndex) => {
              const liveErrors = questionValidationErrors(question);
              const detectedErrors = question.errors ?? [];
              const hasIssue = detectedErrors.length > 0 || liveErrors.length > 0;
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
                      {question.sourceLine && (
                        <span className="rounded bg-slate-100 px-2 py-0.5">
                          line {question.sourceLine}
                        </span>
                      )}
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

                  <div className="grid gap-3 sm:grid-cols-[1fr_180px_150px]">
                    <textarea
                      className="min-h-[78px] w-full resize-y rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      value={question.content}
                      onChange={(event) =>
                        updateQuestion(questionIndex, { content: event.target.value })
                      }
                      placeholder="Question content"
                    />
                    <select
                      value={question.questionType}
                      onChange={(event) =>
                        changeQuestionType(questionIndex, event.target.value as QuestionKind)
                      }
                      className="h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
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

                  {question.content.includes('$') && (
                    <div className="mt-2 rounded border border-slate-100 bg-slate-50 p-2 text-sm text-slate-700">
                      <MathText>{question.content}</MathText>
                    </div>
                  )}

                  <div className="mt-3 space-y-2">
                    {(question.questionType === 'SINGLE_CHOICE' ||
                      question.questionType === 'MULTIPLE_CHOICE' ||
                      question.questionType === 'TRUE_FALSE') &&
                      question.options.map((option, optionIndex) => {
                        const isMultiple = question.questionType === 'MULTIPLE_CHOICE';
                        return (
                          <label
                            key={option.label}
                            className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                              option.isCorrect
                                ? 'border-emerald-300 bg-emerald-50'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <input
                              type={isMultiple ? 'checkbox' : 'radio'}
                              name={`correct-${questionIndex}`}
                              checked={option.isCorrect}
                              onChange={() =>
                                updateOption(questionIndex, optionIndex, {
                                  isCorrect: isMultiple ? !option.isCorrect : true,
                                })
                              }
                              className="mt-2 h-4 w-4 text-emerald-600"
                            />
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
                            {question.questionType !== 'TRUE_FALSE' && question.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeOption(questionIndex, optionIndex)}
                                className="mt-1 text-xs font-medium text-red-600"
                              >
                                Remove
                              </button>
                            )}
                          </label>
                        );
                      })}

                    {question.questionType === 'SHORT_ANSWER' &&
                      question.options.map((option, optionIndex) => (
                        <div key={option.label} className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600">
                            {option.label}
                          </span>
                          <input
                            type="text"
                            value={option.content}
                            onChange={(event) =>
                              updateOption(questionIndex, optionIndex, {
                                content: event.target.value,
                                isCorrect: true,
                              })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                            placeholder="Accepted answer"
                          />
                          {question.options.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeOption(questionIndex, optionIndex)}
                              className="text-xs font-medium text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}

                    {question.questionType === 'MATCHING' &&
                      question.options.map((option, optionIndex) => {
                        const pair = splitMatchingPair(option.content);
                        return (
                          <div key={option.label} className="grid items-center gap-2 sm:grid-cols-[32px_1fr_1fr_auto]">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600">
                              {option.label}
                            </span>
                            <input
                              type="text"
                              value={pair.left}
                              onChange={(event) =>
                                updateOption(questionIndex, optionIndex, {
                                  content: formatMatchingPair(event.target.value, pair.right),
                                  isCorrect: true,
                                })
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              placeholder="Left item"
                            />
                            <input
                              type="text"
                              value={pair.right}
                              onChange={(event) =>
                                updateOption(questionIndex, optionIndex, {
                                  content: formatMatchingPair(pair.left, event.target.value),
                                  isCorrect: true,
                                })
                              }
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              placeholder="Right answer"
                            />
                            {question.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => removeOption(questionIndex, optionIndex)}
                                className="text-xs font-medium text-red-600"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {question.questionType !== 'TRUE_FALSE' && (
                    <button
                      type="button"
                      onClick={() => addOption(questionIndex)}
                      className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                    >
                      Add answer row
                    </button>
                  )}

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
                  </div>

                  {(detectedErrors.length > 0 || liveErrors.length > 0 || question.warnings.length > 0) && (
                    <div className="mt-3 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                      {[...detectedErrors, ...liveErrors, ...question.warnings].map((message, index) => (
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

      {step === 'saving' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <span className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-medium text-slate-600">
            Saving {questions.length} question(s)
          </p>
        </div>
      )}

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
