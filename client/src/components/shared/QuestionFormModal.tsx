import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  SubjectChapterTopicSelect,
  emptyCurriculumSelection,
  type CurriculumSelection,
} from './SubjectChapterTopicSelect';
import { DIFFICULTY_OPTIONS } from './DifficultyBadge';
import type {
  Question,
  CreateQuestionPayload,
  QuestionKind,
} from '@/types/question';
import {
  createQuestion,
  updateQuestion,
  addTags,
} from '@/services/question.api';
import { generateMatchingDistractor } from '@/services/ai.api';
import { MathText } from './MathText';
import { RichTextEditor } from './RichTextEditor';

interface OptionField {
  label: string;
  content: string;
  isCorrect: boolean;
}

const LABELS = ['A', 'B', 'C', 'D'];
const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionKind; label: string }> = [
  { value: 'SINGLE_CHOICE', label: 'Single Choice' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'MATCHING', label: 'Matching' },
];

function defaultOptions(): OptionField[] {
  return LABELS.map((l) => ({ label: l, content: '', isCorrect: false }));
}

function labelFromIndex(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function relabelOptions(options: OptionField[]): OptionField[] {
  return options.map((option, index) => ({ ...option, label: labelFromIndex(index) }));
}

function trueFalseOptions(): OptionField[] {
  return [
    { label: 'A', content: 'True', isCorrect: true },
    { label: 'B', content: 'False', isCorrect: false },
  ];
}

function shortAnswerOptions(): OptionField[] {
  return [{ label: 'A', content: '', isCorrect: true }];
}

function matchingOptions(): OptionField[] {
  return [
    { label: 'A', content: 'Left 1 => Right 1', isCorrect: true },
    { label: 'B', content: 'Left 2 => Right 2', isCorrect: true },
  ];
}

function splitMatchingContent(content: string): { left: string; right: string } {
  const [left = '', ...rightParts] = content.split(/\s*=>\s*/);
  return { left: left.trim(), right: rightParts.join(' => ').trim() };
}

function isDistractorOption(option: OptionField): boolean {
  return !option.isCorrect;
}

function hasRichTextContent(value: string): boolean {
  if (/<img\b/i.test(value)) return true;
  const template = document.createElement('template');
  template.innerHTML = value;
  return (template.content.textContent || '').trim().length > 0;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const responseMessage = (
    error as { response?: { data?: { message?: unknown } } }
  )?.response?.data?.message;

  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

export interface QuestionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editQuestion?: Question | null;
}

export function QuestionFormModal({
  isOpen,
  onClose,
  onSaved,
  editQuestion,
}: QuestionFormModalProps) {
  const isEditing = editQuestion != null;

  const [curriculum, setCurriculum] = useState<CurriculumSelection>(
    emptyCurriculumSelection(),
  );
  const [content, setContent] = useState('');
  const [questionType, setQuestionType] = useState<QuestionKind>('SINGLE_CHOICE');
  const [difficulty, setDifficulty] = useState<number>(3);
  const [explanation, setExplanation] = useState('');
  const [options, setOptions] = useState<OptionField[]>(defaultOptions);
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingDistractor, setGeneratingDistractor] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editQuestion) {
      setCurriculum({
        subjectId: String(editQuestion.subjectId),
        gradeLevel: editQuestion.chapter?.gradeLevel
          ? String(editQuestion.chapter.gradeLevel)
          : '',
        chapterId: editQuestion.chapterId ? String(editQuestion.chapterId) : '',
        topicId: editQuestion.topicId ? String(editQuestion.topicId) : '',
      });
      setContent(editQuestion.content);
      setQuestionType(editQuestion.questionType);
      setDifficulty(editQuestion.difficulty);
      setExplanation(editQuestion.explanation ?? '');
      setOptions(
        editQuestion.options.length > 0
          ? editQuestion.options.map((o) => ({
              label: o.label,
              content: o.content,
              isCorrect: o.isCorrect,
            }))
          : defaultOptions(),
      );
      setTagsInput(
        editQuestion.tags.map((t) => t.tagName).join(', '),
      );
    } else {
      setCurriculum(emptyCurriculumSelection());
      setContent('');
      setQuestionType('SINGLE_CHOICE');
      setDifficulty(3);
      setExplanation('');
      setOptions(defaultOptions());
      setTagsInput('');
    }
  }, [isOpen, editQuestion]);

  const setOptionContent = useCallback((idx: number, val: string) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, content: val } : o)),
    );
  }, []);

  const addOption = useCallback(() => {
    setOptions((prev) => [
      ...prev,
      {
        label: labelFromIndex(prev.length),
        content: questionType === 'MATCHING' ? 'Left => Right' : '',
        isCorrect: questionType === 'SHORT_ANSWER' || questionType === 'MATCHING',
      },
    ]);
  }, [questionType]);

  const removeOption = useCallback((idx: number) => {
    setOptions((prev) => relabelOptions(prev.filter((_, i) => i !== idx)));
  }, []);

  const setCorrectOption = useCallback(
    (idx: number) => {
      if (questionType === 'SINGLE_CHOICE' || questionType === 'TRUE_FALSE') {
        setOptions((prev) =>
          prev.map((o, i) => ({ ...o, isCorrect: i === idx })),
        );
      } else if (questionType === 'MULTIPLE_CHOICE') {
        setOptions((prev) =>
          prev.map((o, i) =>
            i === idx ? { ...o, isCorrect: !o.isCorrect } : o,
          ),
        );
      }
    },
    [questionType],
  );

  const validate = (): string | null => {
    if (!curriculum.subjectId) return 'Please select a subject.';
    if (!curriculum.gradeLevel) return 'Please select a grade.';
    if (!curriculum.chapterId) return 'Please select a chapter.';
    if (!hasRichTextContent(content)) return 'Question content is required.';
    if (options.some((o) => !hasRichTextContent(o.content)))
      return 'All answer rows need content.';
    if (questionType === 'SINGLE_CHOICE' && options.filter((o) => o.isCorrect).length !== 1)
      return 'Select exactly one correct answer.';
    if (questionType === 'TRUE_FALSE' && options.filter((o) => o.isCorrect).length !== 1)
      return 'Select True or False as the correct answer.';
    if (questionType === 'MULTIPLE_CHOICE' && !options.some((o) => o.isCorrect))
      return 'Select at least one correct answer.';
    if (questionType === 'SHORT_ANSWER' && options.length < 1)
      return 'Add at least one accepted answer.';
    if (questionType === 'MATCHING') {
      const pairOptions = options.filter((o) => o.isCorrect);
      if (pairOptions.length < 2) return 'Add at least two matching pairs.';
      for (const opt of pairOptions) {
        const { left, right } = splitMatchingContent(opt.content);
        if (!left || !right)
          return `Pair ${opt.label} must use the format "Left => Right".`;
      }
      if (options.filter((o) => !o.isCorrect).length > 1)
        return 'Only one distractor is allowed per matching question.';
    }
    return null;
  };

  const handleGenerateDistractor = useCallback(async () => {
    const pairs = options
      .filter((o) => o.isCorrect)
      .map((o) => splitMatchingContent(o.content))
      .filter((p) => p.left && p.right);
    if (pairs.length < 2) {
      toast.error('Add at least 2 valid pairs (Left => Right) first.');
      return;
    }
    if (options.some((o) => !o.isCorrect)) {
      toast.error('A distractor already exists. Remove it before generating a new one.');
      return;
    }
    setGeneratingDistractor(true);
    try {
      const distractor = await generateMatchingDistractor({
        pairs,
        questionContent: content || undefined,
      });
      setOptions((prev) => [
        ...prev,
        {
          label: labelFromIndex(prev.length),
          content: distractor,
          isCorrect: false,
        },
      ]);
      toast.success('AI distractor added.');
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, 'Failed to generate distractor.'));
    } finally {
      setGeneratingDistractor(false);
    }
  }, [options, content]);

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      const payload: CreateQuestionPayload = {
        subjectId: Number(curriculum.subjectId),
        chapterId: curriculum.chapterId
          ? Number(curriculum.chapterId)
          : undefined,
        content: content.trim(),
        questionType,
        difficulty,
        explanation: explanation.trim() || undefined,
        options: options.map((o) => ({
          label: o.label,
          content: o.content.trim(),
          isCorrect: o.isCorrect,
        })),
      };

      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (isEditing) {
        await updateQuestion(editQuestion.id, payload);
        if (parsedTags.length > 0) {
          await addTags(editQuestion.id, parsedTags);
        }
        toast.success('Question updated successfully.');
      } else {
        const created = await createQuestion(payload);
        if (parsedTags.length > 0) {
          await addTags(created.id, parsedTags);
        }
        toast.success('Question created successfully.');
      }

      onSaved();
      onClose();
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, 'Failed to save question.'));
    } finally {
      setSaving(false);
    }
  };

  const difficultyColors: Record<number, string> = {
    1: 'bg-sky-500',
    2: 'bg-emerald-500',
    3: 'bg-amber-500',
    4: 'bg-orange-500',
    5: 'bg-red-500',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Question' : 'Create New Question'}
      size="lg"
      className="!max-w-3xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-5">
        {/* Curriculum selection */}
        <SubjectChapterTopicSelect
          value={curriculum}
          onChange={setCurriculum}
          allowEmpty={false}
          layout="row"
          showTopic={false}
        />

        {/* Question type & Difficulty */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Question Type
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              value={questionType}
              onChange={(e) => {
                const next = e.target.value as QuestionKind;
                setQuestionType(next);
                if (next === 'TRUE_FALSE') {
                  setOptions(trueFalseOptions());
                } else if (next === 'SHORT_ANSWER') {
                  setOptions(shortAnswerOptions());
                } else if (next === 'MATCHING') {
                  setOptions(matchingOptions());
                } else if (next === 'SINGLE_CHOICE') {
                  setOptions((prev) => {
                    const firstCorrect = prev.findIndex((o) => o.isCorrect);
                    const normalized = prev.length >= 2 ? relabelOptions(prev) : defaultOptions();
                    return normalized.map((o, i) => ({
                      ...o,
                      isCorrect: i === (firstCorrect >= 0 ? firstCorrect : 0),
                    }));
                  });
                } else {
                  setOptions((prev) => (prev.length >= 2 ? relabelOptions(prev) : defaultOptions()));
                }
              }}
            >
              {QUESTION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Difficulty ({DIFFICULTY_OPTIONS[difficulty - 1]?.label})
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600"
              />
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${difficultyColors[difficulty]}`}
              >
                {difficulty}
              </span>
            </div>
          </div>
        </div>

        {/* Question content */}
        <div>
          <label className="mb-1.5 flex justify-between text-sm font-medium text-slate-700">
            <span>Question Content</span>
            <span className="text-xs font-normal text-slate-500">Supports LaTeX and images</span>
          </label>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Enter the question text..."
          />
          {(content.includes('$') || content.includes('<img')) && (
            <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-800">
              <MathText>{content}</MathText>
            </div>
          )}
        </div>

        {/* Answer options */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            {questionType === 'SHORT_ANSWER'
              ? 'Accepted Answers'
              : questionType === 'MATCHING'
                ? 'Matching Pairs'
                : 'Answer Options'}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {questionType === 'SINGLE_CHOICE' || questionType === 'TRUE_FALSE'
                ? '(Select one correct)'
                : questionType === 'MULTIPLE_CHOICE'
                  ? '(Select all correct)'
                  : ''}
            </span>
          </label>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={opt.label} className="flex items-center gap-3">
                {questionType === 'MATCHING' && isDistractorOption(opt) ? (
                  <span
                    className="flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-bold text-amber-700"
                    title="AI-generated distractor (does not match any left side)"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                    </svg>
                    Distractor
                  </span>
                ) : questionType === 'SHORT_ANSWER' || questionType === 'MATCHING' ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-sm font-bold text-slate-600">
                    {opt.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCorrectOption(idx)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold transition-colors ${
                      opt.isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'
                    }`}
                    title={opt.isCorrect ? 'Correct answer' : 'Mark as correct'}
                  >
                    {opt.label}
                  </button>
                )}
                <div className="flex-1 flex flex-col gap-1">
                  {questionType === 'TRUE_FALSE' ? (
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-sm"
                      value={opt.content}
                      disabled
                      readOnly
                    />
                  ) : (
                    <RichTextEditor
                      value={opt.content}
                      minHeightClassName="min-h-[72px]"
                      placeholder={
                        questionType === 'MATCHING'
                          ? isDistractorOption(opt)
                            ? 'Distractor value (no left side)'
                            : 'Left item => Right answer'
                          : questionType === 'SHORT_ANSWER'
                            ? 'Accepted answer'
                            : `Option ${opt.label}...`
                      }
                      onChange={(nextValue) => {
                        if (questionType === 'SHORT_ANSWER') {
                          setOptions((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, content: nextValue, isCorrect: true } : o,
                            ),
                          );
                        } else if (questionType === 'MATCHING') {
                          setOptions((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, content: nextValue } : o,
                            ),
                          );
                        } else {
                          setOptionContent(idx, nextValue);
                        }
                      }}
                    />
                  )}
                  {(opt.content.includes('$') || opt.content.includes('<img')) && (
                    <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1 text-sm text-slate-700">
                      <MathText>{opt.content}</MathText>
                    </div>
                  )}
                </div>
                {opt.isCorrect && (
                  <svg
                    className="h-5 w-5 shrink-0 text-emerald-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {questionType !== 'TRUE_FALSE' && options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="text-xs font-medium text-red-600 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {questionType !== 'TRUE_FALSE' && options.length < 26 && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Add answer row
            </button>
          )}
          {questionType === 'MATCHING' && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
              <button
                type="button"
                onClick={handleGenerateDistractor}
                disabled={generatingDistractor || options.some((o) => !o.isCorrect)}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingDistractor ? (
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                  </svg>
                )}
                {generatingDistractor ? 'Generating…' : 'Generate distractor with AI'}
              </button>
              <span className="text-xs text-amber-800">
                Adds one plausible-looking wrong answer to the drag pool, based on your existing pairs.
              </span>
            </div>
          )}
        </div>

        {/* Explanation */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Explanation
            <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <RichTextEditor
            value={explanation}
            onChange={setExplanation}
            placeholder="Explain why the correct answer is right..."
            minHeightClassName="min-h-[96px]"
          />
        </div>

        {/* Tags */}
        <Input
          label="Tags"
          placeholder="e.g. algebra, equations, grade-10 (comma separated)"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={saving}
            onClick={handleSubmit}
          >
            {isEditing ? 'Save Changes' : 'Create Question'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
