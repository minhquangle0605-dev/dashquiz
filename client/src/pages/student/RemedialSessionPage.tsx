import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { MathText } from '@/components/shared/MathText';
import {
  useRemedialSession,
  useSubmitRemedialAnswer,
} from '@/hooks/useAiRemedial';
import type { RemedialQuestion } from '@/services/ai.api';

function QuestionCard({
  question,
  index,
  total,
  onSubmit,
  isSubmitting,
}: {
  question: RemedialQuestion;
  index: number;
  total: number;
  onSubmit: (label: string) => void;
  isSubmitting: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = question.studentAnswer !== null;
  const showResult = answered;

  const handleSubmit = () => {
    if (!selected || answered) return;
    onSubmit(selected);
  };

  return (
    <Card padding="lg" className="overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <Badge variant="neutral">
          Question {index + 1} / {total}
        </Badge>
        {showResult && (
          <Badge variant={question.isCorrect ? 'success' : 'danger'}>
            {question.isCorrect ? 'Correct' : 'Wrong'}
          </Badge>
        )}
      </div>

      <div className="text-base leading-relaxed text-slate-800 mb-4">
        <MathText>{question.content}</MathText>
      </div>

      <div className="space-y-2">
        {question.options.map((opt) => {
          const isSelectedNow = selected === opt.label;
          const wasChosen = answered && question.studentAnswer === opt.label;
          const isCorrectOption =
            answered && question.correctOption === opt.label;

          let optStyle = 'border-slate-200 bg-white hover:border-violet-300';
          let labelStyle = 'bg-slate-100 text-slate-600';

          if (!answered && isSelectedNow) {
            optStyle = 'border-violet-500 bg-violet-50';
            labelStyle = 'bg-violet-500 text-white';
          }

          if (showResult) {
            if (isCorrectOption) {
              optStyle = 'border-emerald-300 bg-emerald-50';
              labelStyle = 'bg-emerald-500 text-white';
            } else if (wasChosen) {
              optStyle = 'border-red-300 bg-red-50';
              labelStyle = 'bg-red-500 text-white';
            }
          }

          return (
            <button
              type="button"
              key={opt.label}
              disabled={answered || isSubmitting}
              onClick={() => setSelected(opt.label)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${optStyle} ${
                answered ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${labelStyle}`}
              >
                {opt.label}
              </span>
              <div className="flex-1 pt-0.5 text-sm text-slate-700">
                <MathText>{opt.content}</MathText>
              </div>
            </button>
          );
        })}
      </div>

      {showResult && question.explanation && (
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-semibold text-sky-800">Explanation</p>
          <div className="mt-1 text-sm leading-relaxed text-sky-700">
            <MathText>{question.explanation}</MathText>
          </div>
        </div>
      )}

      {!answered && (
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!selected || isSubmitting}
            className="bg-violet-600 hover:bg-violet-700 text-white min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Checking...
              </>
            ) : (
              'Check Answer'
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function RemedialSessionPage() {
  const { sessionId: paramId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessionId = paramId ? Number(paramId) : undefined;

  const { data: session, isLoading, isError, error } = useRemedialSession(sessionId);
  const submitAnswer = useSubmitRemedialAnswer(sessionId ?? 0);

  const stats = useMemo(() => {
    if (!session) return { answered: 0, correct: 0 };
    const answered = session.questions.filter((q) => q.studentAnswer !== null).length;
    const correct = session.questions.filter((q) => q.isCorrect === true).length;
    return { answered, correct };
  }, [session]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading practice session...</p>
        </div>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="mx-auto max-w-lg mt-16">
        <Card padding="lg">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-800">
              Failed to load practice session
            </h2>
            <p className="mt-2 text-sm text-red-600">
              {error instanceof Error ? error.message : 'Please try again later'}
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => navigate('/student/exams')}
            >
              Back to exam list
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const completed = stats.answered === session.totalQuestions;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() =>
          navigate(`/student/attempts/${session.sourceAttemptId}/result`)
        }
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors min-h-[44px]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to exam result
      </button>

      <Card padding="lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              AI Review: {session.topic.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {session.topic.subject} · {session.topic.chapter}
            </p>
          </div>
          <div className="flex gap-3 text-center">
            <div className="rounded-xl bg-slate-50 px-4 py-2">
              <p className="text-lg font-bold text-slate-800">
                {stats.answered} / {session.totalQuestions}
              </p>
              <p className="text-xs text-slate-500">Answered</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-4 py-2">
              <p className="text-lg font-bold text-emerald-700">{stats.correct}</p>
              <p className="text-xs text-emerald-600">Correct</p>
            </div>
          </div>
        </div>

        {completed && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-sm font-semibold text-emerald-800">
              Complete! You answered {stats.correct}/{session.totalQuestions} questions correctly.
            </p>
          </div>
        )}
      </Card>

      {session.questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          question={q}
          index={i}
          total={session.totalQuestions}
          isSubmitting={submitAnswer.isPending && submitAnswer.variables?.questionId === q.id}
          onSubmit={(label) =>
            submitAnswer.mutate({ questionId: q.id, selectedLabel: label })
          }
        />
      ))}
    </div>
  );
}
