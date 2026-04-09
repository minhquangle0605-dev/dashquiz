import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useAttemptResult } from '@/hooks/useExam';
import { formatDuration, formatDate } from '@/utils/format';
import type { ResultQuestion } from '@/types/exam';

function ScoreRing({
  percentage,
  passed,
}: {
  percentage: number;
  passed: boolean | null;
}) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color =
    passed === true
      ? 'text-emerald-500'
      : passed === false
        ? 'text-red-500'
        : percentage >= 50
          ? 'text-emerald-500'
          : 'text-red-500';
  const trackColor =
    passed === true
      ? 'text-emerald-100'
      : passed === false
        ? 'text-red-100'
        : percentage >= 50
          ? 'text-emerald-100'
          : 'text-red-100';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="136" height="136" className="-rotate-90">
        <circle
          cx="68"
          cy="68"
          r={radius}
          fill="none"
          strokeWidth="10"
          className={`stroke-current ${trackColor}`}
        />
        <circle
          cx="68"
          cy="68"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`stroke-current ${color} transition-[stroke-dashoffset] duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold ${color.replace('text-', 'text-')}`}>
          {percentage}%
        </span>
      </div>
    </div>
  );
}

function QuestionReview({
  question,
  index,
}: {
  question: ResultQuestion;
  index: number;
}) {
  const borderColor = question.selectedOption === null
    ? 'border-slate-200'
    : question.isCorrect
      ? 'border-emerald-200'
      : 'border-red-200';
  const bgColor = question.selectedOption === null
    ? 'bg-slate-50'
    : question.isCorrect
      ? 'bg-emerald-50'
      : 'bg-red-50';

  return (
    <div className={`rounded-xl border-2 ${borderColor} overflow-hidden`}>
      {/* Question header */}
      <div className={`flex items-center justify-between gap-3 px-5 py-3 ${bgColor}`}>
        <div className="flex items-center gap-3">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
              question.selectedOption === null
                ? 'bg-slate-200 text-slate-600'
                : question.isCorrect
                  ? 'bg-emerald-500 text-white'
                  : 'bg-red-500 text-white'
            }`}
          >
            {index + 1}
          </span>
          <Badge
            variant={
              question.selectedOption === null
                ? 'neutral'
                : question.isCorrect
                  ? 'success'
                  : 'danger'
            }
          >
            {question.selectedOption === null
              ? 'Skipped'
              : question.isCorrect
                ? 'Correct'
                : 'Incorrect'}
          </Badge>
        </div>
        {question.chapter && (
          <span className="text-xs text-slate-500">
            {question.chapter.name}
            {question.topic ? ` / ${question.topic.name}` : ''}
          </span>
        )}
      </div>

      {/* Question content */}
      <div className="px-5 py-4 space-y-4">
        <div
          className="text-sm leading-relaxed text-slate-800"
          dangerouslySetInnerHTML={{ __html: question.content }}
        />

        {/* Options */}
        <div className="space-y-2">
          {question.allOptions.map((opt) => {
            const wasSelected = question.selectedOption?.id === opt.id;
            const isCorrectOption = opt.isCorrect;

            let optStyle = 'border-slate-200 bg-white';
            let labelStyle = 'bg-slate-100 text-slate-600';
            let icon = null;

            if (isCorrectOption) {
              optStyle = 'border-emerald-300 bg-emerald-50';
              labelStyle = 'bg-emerald-500 text-white';
              icon = (
                <svg className="h-5 w-5 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              );
            }

            if (wasSelected && !isCorrectOption) {
              optStyle = 'border-red-300 bg-red-50';
              labelStyle = 'bg-red-500 text-white';
              icon = (
                <svg className="h-5 w-5 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              );
            }

            return (
              <div
                key={opt.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${optStyle}`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${labelStyle}`}
                >
                  {opt.label}
                </span>
                <span
                  className="flex-1 text-sm text-slate-700 pt-0.5"
                  dangerouslySetInnerHTML={{ __html: opt.content }}
                />
                {icon}
              </div>
            );
          })}
        </div>

        {/* Explanation */}
        {question.explanation && (
          <div className="rounded-lg bg-sky-50 border border-sky-200 p-4">
            <div className="flex items-start gap-2.5">
              <svg className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-sky-800">Explanation</p>
                <p className="mt-1 text-sm text-sky-700 leading-relaxed">
                  {question.explanation}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExamResultPage() {
  const { attemptId: paramAttemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(true);

  const attemptId = paramAttemptId ? Number(paramAttemptId) : undefined;
  const { data, isLoading, isError, error } = useAttemptResult(attemptId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading results...</p>
        </div>
      </div>
    );
  }

  if (isError || !data?.data) {
    return (
      <div className="mx-auto max-w-lg mt-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-red-800">
            Cannot Load Results
          </h2>
          <p className="mt-2 text-sm text-red-600">
            {error instanceof Error ? error.message : 'Please try again later'}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate('/student/exams')}
          >
            Back to Exams
          </Button>
        </div>
      </div>
    );
  }

  const result = data.data;

  if (!result.resultsAvailable) {
    return (
      <div className="mx-auto max-w-lg mt-16">
        <Card padding="lg">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-7 w-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-800">
              Results Not Available Yet
            </h2>
            <p className="text-sm text-slate-500">
              Your teacher has not released the results for this exam yet. Please
              check back later.
            </p>
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => navigate('/student/exams')}
            >
              Back to Exams
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const { attempt, summary, questions } = result;
  const skippedCount =
    summary.totalQuestions - summary.correctCount - summary.incorrectCount;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate('/student/exams')}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors min-h-[44px]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Exams
      </button>

      {/* Score overview card */}
      <Card padding="lg" className="overflow-hidden">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
          {/* Score ring */}
          <div className="flex flex-col items-center gap-3">
            <ScoreRing
              percentage={summary.scorePercentage}
              passed={summary.passed}
            />
            {summary.passed !== null && (
              <Badge
                variant={summary.passed ? 'success' : 'danger'}
                className="text-sm px-4 py-1"
              >
                {summary.passed ? 'PASSED' : 'NOT PASSED'}
              </Badge>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {attempt.examTitle}
              </h1>
              {attempt.subject && (
                <p className="mt-1 text-sm text-slate-500">
                  {attempt.subject.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {Number(attempt.totalScore).toFixed(1)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Score</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-slate-800">
                  {formatDuration(attempt.timeSpentSec)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Time Spent</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">
                  {summary.correctCount}
                </p>
                <p className="text-xs text-emerald-600 mt-0.5">Correct</p>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {summary.incorrectCount}
                </p>
                <p className="text-xs text-red-600 mt-0.5">Incorrect</p>
              </div>
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
              {skippedCount > 0 && (
                <span>{skippedCount} skipped</span>
              )}
              <span>
                Submitted {formatDate(attempt.submittedAt, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {attempt.isAutoSubmitted && (
                <Badge variant="warning">Auto-submitted</Badge>
              )}
              {attempt.passingScore !== null && (
                <span>
                  Passing score: {Number(attempt.passingScore)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Question details toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">
          Question Details
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDetails(!showDetails)}
          className="min-h-[44px]"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
          <svg
            className={`ml-1.5 h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </Button>
      </div>

      {/* Question list */}
      {showDetails && (
        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionReview key={q.questionId} question={q} index={i} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-center pb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/student/exams')}
          className="min-h-[44px]"
        >
          Back to Exam List
        </Button>
      </div>
    </div>
  );
}
