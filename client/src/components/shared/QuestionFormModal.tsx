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

interface OptionField {
  label: string;
  content: string;
  isCorrect: boolean;
}

const LABELS = ['A', 'B', 'C', 'D'];

function defaultOptions(): OptionField[] {
  return LABELS.map((l) => ({ label: l, content: '', isCorrect: false }));
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

  useEffect(() => {
    if (!isOpen) return;
    if (editQuestion) {
      setCurriculum({
        subjectId: String(editQuestion.subjectId),
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

  const setCorrectOption = useCallback(
    (idx: number) => {
      if (questionType === 'SINGLE_CHOICE') {
        setOptions((prev) =>
          prev.map((o, i) => ({ ...o, isCorrect: i === idx })),
        );
      } else {
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
    if (!content.trim()) return 'Question content is required.';
    if (options.some((o) => !o.content.trim()))
      return 'All 4 answer options are required.';
    if (!options.some((o) => o.isCorrect))
      return 'Select at least one correct answer.';
    return null;
  };

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
        topicId: curriculum.topicId ? Number(curriculum.topicId) : undefined,
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
      const msg =
        e instanceof Error ? e.message : 'Failed to save question.';
      toast.error(msg);
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
                if (next === 'SINGLE_CHOICE') {
                  setOptions((prev) => {
                    const firstCorrect = prev.findIndex((o) => o.isCorrect);
                    return prev.map((o, i) => ({
                      ...o,
                      isCorrect: i === (firstCorrect >= 0 ? firstCorrect : 0),
                    }));
                  });
                }
              }}
            >
              <option value="SINGLE_CHOICE">Single Choice</option>
              <option value="MULTIPLE_CHOICE">Multiple Choice</option>
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
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Question Content
          </label>
          <textarea
            rows={4}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Enter the question text..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        {/* Answer options */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Answer Options
            <span className="ml-2 text-xs font-normal text-slate-400">
              ({questionType === 'SINGLE_CHOICE' ? 'Select one correct' : 'Select all correct'})
            </span>
          </label>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={opt.label} className="flex items-center gap-3">
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
                <input
                  type="text"
                  className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder={`Option ${opt.label}...`}
                  value={opt.content}
                  onChange={(e) => setOptionContent(idx, e.target.value)}
                />
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
              </div>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Explanation
            <span className="ml-1 text-xs font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            placeholder="Explain why the correct answer is right..."
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
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
