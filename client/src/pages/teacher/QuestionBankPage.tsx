import { useState, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { DifficultyBadge, DIFFICULTY_OPTIONS } from '@/components/shared/DifficultyBadge';
import {
  SubjectChapterTopicSelect,
  emptyCurriculumSelection,
  type CurriculumSelection,
} from '@/components/shared/SubjectChapterTopicSelect';
import { MathText } from '@/components/shared/MathText';
import { QuestionFormModal } from '@/components/shared/QuestionFormModal';
import { ImportExcelModal } from '@/components/shared/ImportExcelModal';
import { ImportDocumentModal } from '@/components/shared/ImportDocumentModal';
import { ImportZipModal } from '@/components/shared/ImportZipModal';
import { useDebounce } from '@/hooks/useDebounce';
import {
  listQuestions,
  deleteQuestion,
  bulkDeleteQuestions,
  exportQuestionsGift,
} from '@/services/question.api';
import type { Question, QuestionFilter, QuestionKind } from '@/types/question';
import type { PaginatedResponse } from '@/types/api';

const PAGE_SIZE = 12;
const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionKind; label: string }> = [
  { value: 'SINGLE_CHOICE', label: 'Single Choice' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'TRUE_FALSE', label: 'True / False' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'MATCHING', label: 'Matching' },
];

export default function QuestionBankPage() {
  // ── Filter state ──────────────────────────────────
  const [curriculum, setCurriculum] = useState<CurriculumSelection>(
    emptyCurriculumSelection(),
  );
  const [questionTypeFilter, setQuestionTypeFilter] = useState<QuestionKind | ''>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 400);
  const [page, setPage] = useState(1);

  // ── Data state ────────────────────────────────────
  const [data, setData] = useState<PaginatedResponse<Question> | null>(null);
  const [loading, setLoading] = useState(false);

  // ── UI state ──────────────────────────────────────
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportDocModal, setShowImportDocModal] = useState(false);
  const [showImportZipModal, setShowImportZipModal] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [exportingGift, setExportingGift] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Fetch questions ───────────────────────────────
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params: QuestionFilter = {
        page,
        pageSize: PAGE_SIZE,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      if (curriculum.subjectId) params.subjectId = Number(curriculum.subjectId);
      if (curriculum.gradeLevel) params.gradeLevel = Number(curriculum.gradeLevel);
      if (curriculum.chapterId) params.chapterId = Number(curriculum.chapterId);
      if (questionTypeFilter) params.questionType = questionTypeFilter;
      if (difficultyFilter) params.difficulty = Number(difficultyFilter);
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const res = await listQuestions(params);
      setData(res);
    } catch {
      toast.error('Failed to load questions.');
    } finally {
      setLoading(false);
    }
  }, [page, curriculum, questionTypeFilter, difficultyFilter, debouncedSearch]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [curriculum, questionTypeFilter, difficultyFilter, debouncedSearch]);

  // ── Handlers ──────────────────────────────────────
  const handleDelete = async (q: Question) => {
    if (!window.confirm(`Delete this question? This action cannot be undone.`))
      return;
    setDeleting(q.id);
    try {
      await deleteQuestion(q.id);
      toast.success('Question deleted.');
      fetchQuestions();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          'Failed to delete question.',
      );
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected question(s)? This action cannot be undone.`))
      return;
    setBulkDeleting(true);
    try {
      await bulkDeleteQuestions(selectedIds);
      toast.success(`Deleted ${selectedIds.length} question(s).`);
      setSelectedIds([]);
      fetchQuestions();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          'Failed to delete questions.',
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportGift = async () => {
    const ids = selectedIds.length > 0 ? selectedIds : questions.map((q) => q.id);
    if (ids.length === 0) return;
    setExportingGift(true);
    try {
      const blob = await exportQuestionsGift(ids);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `questions_${new Date().toISOString().slice(0, 10)}.gift`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${ids.length} question(s) to GIFT.`);
    } catch {
      toast.error('Failed to export GIFT file.');
    } finally {
      setExportingGift(false);
    }
  };

  const handleClearFilters = () => {
    setCurriculum(emptyCurriculumSelection());
    setQuestionTypeFilter('');
    setDifficultyFilter('');
    setSearchText('');
    setPage(1);
  };

  const questions = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;
  const total = data?.total ?? 0;

  const hasFilters =
    curriculum.subjectId !== '' ||
    curriculum.gradeLevel !== '' ||
    curriculum.chapterId !== '' ||
    questionTypeFilter !== '' ||
    difficultyFilter !== '' ||
    searchText.trim() !== '';

  return (
    <div className="flex h-full gap-0">
      {/* ═══ Filter Sidebar ═══ */}
      {sidebarOpen && (
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-0 flex h-full flex-col overflow-y-auto p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Filters</h2>
              {hasFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Keyword search */}
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Search
              </label>
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Search questions..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>

            {/* Subject / Chapter / Topic */}
            <SubjectChapterTopicSelect
              value={curriculum}
              onChange={setCurriculum}
              layout="column"
              allowEmpty
              showTopic={false}
            />

            {/* Question type filter */}
            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Question type
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                value={questionTypeFilter}
                onChange={(e) => setQuestionTypeFilter(e.target.value as QuestionKind | '')}
              >
                <option value="">All question types</option>
                {QUESTION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty filter */}
            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Difficulty
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDifficultyFilter('')}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    difficultyFilter === ''
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All
                </button>
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDifficultyFilter(
                        difficultyFilter === String(opt.value) ? '' : String(opt.value),
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      difficultyFilter === String(opt.value)
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats */}
            {data && (
              <div className="mt-auto border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  <strong className="text-slate-700">{total}</strong> question
                  {total !== 1 ? 's' : ''} found
                </p>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* ═══ Main Content ═══ */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="hidden rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 lg:block"
                title="Toggle filters"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
                  />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
                  Question Bank
                </h1>
                <p className="mt-0.5 text-sm text-slate-500">
                  Manage, search and organize your questions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <Button
                  variant="danger"
                  size="md"
                  isLoading={bulkDeleting}
                  onClick={handleBulkDelete}
                >
                  <svg
                    className="mr-1.5 h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Selected ({selectedIds.length})
                </Button>
              )}
              <Button
                variant="outline"
                size="md"
                isLoading={exportingGift}
                disabled={questions.length === 0}
                onClick={handleExportGift}
                title={selectedIds.length > 0 ? 'Export selected questions to GIFT' : 'Export current page to GIFT'}
              >
                <svg
                  className="mr-1.5 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14"
                  />
                </svg>
                Export GIFT
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowImportDocModal(true)}
                title="Extract questions from Word or PDF using AI"
              >
                <svg
                  className="mr-1.5 h-4 w-4"
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
                AI Import (Word/PDF)
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowImportZipModal(true)}
                title="Import questions with images from a ZIP bundle"
              >
                <svg
                  className="mr-1.5 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                Import ZIP (Images)
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowImportModal(true)}
              >
                <svg
                  className="mr-1.5 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                Import Excel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => setShowCreateModal(true)}
              >
                <svg
                  className="mr-1.5 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Question
              </Button>
            </div>
          </div>

          {/* Mobile filters */}
          <div className="mb-4 lg:hidden">
            <Card padding="sm">
              <div className="space-y-3">
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Search questions..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
                <SubjectChapterTopicSelect
                  value={curriculum}
                  onChange={setCurriculum}
                  layout="row"
                  allowEmpty
                  showTopic={false}
                />
                <select
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  value={questionTypeFilter}
                  onChange={(e) => setQuestionTypeFilter(e.target.value as QuestionKind | '')}
                >
                  <option value="">All question types</option>
                  {QUESTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </Card>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" label="Loading questions" />
            </div>
          )}

          {/* Empty state */}
          {!loading && questions.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20">
              <svg
                className="mb-4 h-12 w-12 text-slate-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="text-base font-semibold text-slate-700">
                No questions found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {hasFilters
                  ? 'Try adjusting your filters or search terms.'
                  : 'Get started by creating your first question.'}
              </p>
              {!hasFilters && (
                <Button
                  variant="primary"
                  size="md"
                  className="mt-5"
                  onClick={() => setShowCreateModal(true)}
                >
                  Create Question
                </Button>
              )}
            </div>
          )}

          {/* Question list */}
          {!loading && questions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center px-1 mb-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                    checked={questions.length > 0 && selectedIds.length === questions.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(questions.map((q) => q.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
                  <span className="text-sm font-medium text-slate-600">Select All on Page</span>
                </label>
              </div>
              {questions.map((q) => {
                const isExpanded = expandedId === q.id;
                return (
                  <Card
                    key={q.id}
                    padding="none"
                    className="overflow-hidden transition-shadow hover:shadow-md"
                  >
                    {/* Collapsed card */}
                    <div className="flex w-full items-start p-5">
                      <div className="mr-4 mt-1">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                          checked={selectedIds.includes(q.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds((prev) => [...prev, q.id]);
                            } else {
                              setSelectedIds((prev) => prev.filter((id) => id !== q.id));
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="flex-1 flex items-start text-left min-w-0"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : q.id)
                        }
                      >
                        <div className="flex-1 min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <DifficultyBadge level={q.difficulty} />
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {q.questionType.replace('_', ' ')}
                          </span>
                          {q.subject && (
                            <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                              {q.subject.name}
                            </span>
                          )}
                          {q.chapter?.gradeLevel && (
                            <span className="rounded bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                              Grade {q.chapter.gradeLevel}
                            </span>
                          )}
                          {q.chapter && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              {q.chapter.name}
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-medium text-slate-800 line-clamp-2">
                          <MathText>{q.content}</MathText>
                        </div>
                        {q.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {q.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                              >
                                {tag.tagName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <svg
                        className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-5 pt-4">
                        <div className="mb-4 whitespace-pre-wrap text-sm text-slate-800">
                          <MathText>{q.content}</MathText>
                        </div>

                        {/* Options */}
                        <div className="mb-4 space-y-2">
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${
                                opt.isCorrect
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            >
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                                  opt.isCorrect
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                {opt.label}
                              </span>
                              <div className="flex-1 overflow-hidden"><MathText>{opt.content}</MathText></div>
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

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-800">
                              Explanation
                            </p>
                            <div className="mt-1 text-sm text-amber-700">
                              <MathText>{q.explanation}</MathText>
                            </div>
                          </div>
                        )}

                        {/* Meta info */}
                        <div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500">
                          {q.chapter?.gradeLevel && (
                            <span>
                              Grade:{' '}
                              <strong className="text-slate-700">{q.chapter.gradeLevel}</strong>
                            </span>
                          )}
                          {q.topic && (
                            <span>
                              Topic:{' '}
                              <strong className="text-slate-700">{q.topic.name}</strong>
                            </span>
                          )}
                          <span>
                            Created:{' '}
                            <strong className="text-slate-700">
                              {new Date(q.createdAt).toLocaleDateString()}
                            </strong>
                          </span>
                          {q.creator && (
                            <span>
                              By:{' '}
                              <strong className="text-slate-700">
                                {q.creator.fullName}
                              </strong>
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditQuestion(q)}
                          >
                            <svg
                              className="mr-1 h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            isLoading={deleting === q.id}
                            onClick={() => handleDelete(q)}
                          >
                            <svg
                              className="mr-1 h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
                {' '}({total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ═══ Modals ═══ */}
      <QuestionFormModal
        isOpen={showCreateModal || editQuestion !== null}
        onClose={() => {
          setShowCreateModal(false);
          setEditQuestion(null);
        }}
        onSaved={fetchQuestions}
        editQuestion={editQuestion}
      />

      <ImportExcelModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImported={fetchQuestions}
      />

      <ImportDocumentModal
        isOpen={showImportDocModal}
        onClose={() => setShowImportDocModal(false)}
        onImported={fetchQuestions}
      />

      <ImportZipModal
        isOpen={showImportZipModal}
        onClose={() => setShowImportZipModal(false)}
        onImported={fetchQuestions}
      />
    </div>
  );
}
