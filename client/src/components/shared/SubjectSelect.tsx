export interface TopicOption {
  id: string;
  name: string;
}

export interface ChapterOption {
  id: string;
  name: string;
  topics: TopicOption[];
}

export interface SubjectOption {
  id: string;
  name: string;
  chapters: ChapterOption[];
}

export interface SubjectSelectValue {
  subjectId: string;
  chapterId: string;
  topicId: string;
}

export interface SubjectSelectProps {
  subjects: SubjectOption[];
  value: SubjectSelectValue;
  onSelect: (next: SubjectSelectValue) => void;
  disabled?: boolean;
  className?: string;
  labels?: {
    subject?: string;
    chapter?: string;
    topic?: string;
  };
}

const emptyValue = (): SubjectSelectValue => ({
  subjectId: '',
  chapterId: '',
  topicId: '',
});

export function SubjectSelect({
  subjects,
  value,
  onSelect,
  disabled = false,
  className = '',
  labels = {},
}: SubjectSelectProps) {
  const subject = subjects.find((s) => s.id === value.subjectId);
  const chapter = subject?.chapters.find((c) => c.id === value.chapterId);

  const selectBase =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50';

  return (
    <div className={`grid gap-4 sm:grid-cols-3 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          {labels.subject ?? 'Subject'}
        </label>
        <select
          className={selectBase}
          disabled={disabled}
          value={value.subjectId}
          onChange={(e) => {
            const subjectId = e.target.value;
            const sub = subjects.find((s) => s.id === subjectId);
            const firstChapter = sub?.chapters[0];
            const firstTopic = firstChapter?.topics[0];
            onSelect({
              subjectId,
              chapterId: firstChapter?.id ?? '',
              topicId: firstTopic?.id ?? '',
            });
          }}
        >
          <option value="">Select subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          {labels.chapter ?? 'Chapter'}
        </label>
        <select
          className={selectBase}
          disabled={disabled || subject === undefined}
          value={value.chapterId}
          onChange={(e) => {
            const chapterId = e.target.value;
            const ch = subject?.chapters.find((c) => c.id === chapterId);
            const firstTopic = ch?.topics[0];
            onSelect({
              ...value,
              chapterId,
              topicId: firstTopic?.id ?? '',
            });
          }}
        >
          <option value="">Select chapter</option>
          {(subject?.chapters ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          {labels.topic ?? 'Topic'}
        </label>
        <select
          className={selectBase}
          disabled={disabled || chapter === undefined}
          value={value.topicId}
          onChange={(e) => {
            onSelect({
              ...value,
              topicId: e.target.value,
            });
          }}
        >
          <option value="">Select topic</option>
          {(chapter?.topics ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export { emptyValue as emptySubjectSelectValue };
