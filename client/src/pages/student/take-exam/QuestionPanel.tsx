import { motion } from 'framer-motion';

import { MathText } from '@/components/shared/MathText';
import type { ExamQuestion, StudentAnswerValue } from '@/types/exam';

import { AnswerOptions } from './AnswerOptions';

interface QuestionPanelProps {
  question: ExamQuestion | undefined;
  currentIndex: number;
  total: number;
  answer: StudentAnswerValue | undefined;
  onSingleSelect: (questionId: number, optionId: number) => void;
  onMultiSelect: (questionId: number, optionId: number) => void;
  onTextAnswer: (questionId: number, value: string) => void;
  onMatchingAnswer: (questionId: number, label: string, value: string) => void;
}

export function QuestionPanel({
  question,
  currentIndex,
  total,
  answer,
  onSingleSelect,
  onMultiSelect,
  onTextAnswer,
  onMatchingAnswer,
}: QuestionPanelProps) {
  if (!question) {
    return (
      <div className="py-20 text-center text-[var(--color-text-muted)]">
        No questions available
      </div>
    );
  }

  const progress = ((currentIndex + 1) / total) * 100;

  return (
    <motion.div
      key={question.questionId}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-primary)]">
            <span className="tabular-nums">{currentIndex + 1}</span>
            <span className="text-[var(--color-primary)]/60">/</span>
            <span className="tabular-nums">{total}</span>
          </span>
          {question.points > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-secondary-soft)] px-2.5 py-1 text-xs font-bold text-[var(--color-secondary)]">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {Number(question.points)} pt{Number(question.points) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          {Math.round(progress)}% complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg-muted)]">
        <motion.div
          className="h-full rounded-full bg-gradient-brand shadow-[var(--shadow-brand)]"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        />
      </div>

      {/* Question content */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-sm)]">
        <div className="text-base leading-relaxed text-[var(--color-text-primary)]">
          <MathText>{question.content}</MathText>
        </div>
      </div>

      <AnswerOptions
        question={question}
        answer={answer}
        onSingleSelect={onSingleSelect}
        onMultiSelect={onMultiSelect}
        onTextAnswer={onTextAnswer}
        onMatchingAnswer={onMatchingAnswer}
      />
    </motion.div>
  );
}
