import { useEffect, useState, useCallback } from 'react';
import type {
  CurriculumSubject,
  CurriculumChapter,
  CurriculumTopic,
} from '@/types/question';
import {
  listSubjects,
  getChaptersBySubject,
  getTopicsByChapter,
} from '@/services/question.api';

export interface CurriculumSelection {
  subjectId: string;
  chapterId: string;
  topicId: string;
}

export interface SubjectChapterTopicSelectProps {
  value: CurriculumSelection;
  onChange: (next: CurriculumSelection) => void;
  disabled?: boolean;
  className?: string;
  /** Allow all-empty as a valid selection (for filters) */
  allowEmpty?: boolean;
  labels?: {
    subject?: string;
    chapter?: string;
    topic?: string;
  };
  layout?: 'row' | 'column';
}

export function SubjectChapterTopicSelect({
  value,
  onChange,
  disabled = false,
  className = '',
  allowEmpty = true,
  labels = {},
  layout = 'row',
}: SubjectChapterTopicSelectProps) {
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [chapters, setChapters] = useState<CurriculumChapter[]>([]);
  const [topics, setTopics] = useState<CurriculumTopic[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSubjects()
      .then((data) => {
        if (!cancelled) setSubjects(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!value.subjectId) {
      setChapters([]);
      return;
    }
    let cancelled = false;
    getChaptersBySubject(Number(value.subjectId))
      .then((data) => {
        if (!cancelled) setChapters(data);
      })
      .catch(() => {
        if (!cancelled) setChapters([]);
      });
    return () => { cancelled = true; };
  }, [value.subjectId]);

  useEffect(() => {
    if (!value.chapterId) {
      setTopics([]);
      return;
    }
    let cancelled = false;
    getTopicsByChapter(Number(value.chapterId))
      .then((data) => {
        if (!cancelled) setTopics(data);
      })
      .catch(() => {
        if (!cancelled) setTopics([]);
      });
    return () => { cancelled = true; };
  }, [value.chapterId]);

  const handleSubjectChange = useCallback(
    (subjectId: string) => {
      onChange({ subjectId, chapterId: '', topicId: '' });
    },
    [onChange],
  );

  const handleChapterChange = useCallback(
    (chapterId: string) => {
      onChange({ ...value, chapterId, topicId: '' });
    },
    [onChange, value],
  );

  const handleTopicChange = useCallback(
    (topicId: string) => {
      onChange({ ...value, topicId });
    },
    [onChange, value],
  );

  const selectBase =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50';

  const gridClass =
    layout === 'row' ? 'grid gap-4 sm:grid-cols-3' : 'flex flex-col gap-4';

  return (
    <div className={`${gridClass} ${className}`}>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {labels.subject ?? 'Subject'}
        </label>
        <select
          className={selectBase}
          disabled={disabled || loading}
          value={value.subjectId}
          onChange={(e) => handleSubjectChange(e.target.value)}
        >
          <option value="">{allowEmpty ? 'All subjects' : 'Select subject'}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {labels.chapter ?? 'Chapter'}
        </label>
        <select
          className={selectBase}
          disabled={disabled || !value.subjectId}
          value={value.chapterId}
          onChange={(e) => handleChapterChange(e.target.value)}
        >
          <option value="">{allowEmpty ? 'All chapters' : 'Select chapter'}</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {labels.topic ?? 'Topic'}
        </label>
        <select
          className={selectBase}
          disabled={disabled || !value.chapterId}
          value={value.topicId}
          onChange={(e) => handleTopicChange(e.target.value)}
        >
          <option value="">{allowEmpty ? 'All topics' : 'Select topic'}</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export const emptyCurriculumSelection = (): CurriculumSelection => ({
  subjectId: '',
  chapterId: '',
  topicId: '',
});
