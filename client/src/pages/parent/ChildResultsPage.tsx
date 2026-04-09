import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/Table';
import { getChildren, getChildResults } from '@/services/parent.api';
import type { ChildResultItem, ChildResultsResponse } from '@/types/parent';

export default function ChildResultsPage() {
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: getChildren,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].student.id);
    }
  }, [children, selectedChildId]);

  const [results, setResults] = useState<ChildResultsResponse | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchResults = useCallback(async () => {
    if (!selectedChildId) return;
    setLoadingResults(true);
    try {
      const data = await getChildResults(selectedChildId, { page, limit, sort: 'date', order: 'desc' });
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoadingResults(false);
    }
  }, [selectedChildId, page]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    setPage(1);
  }, [selectedChildId]);

  if (loadingChildren) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <Card padding="lg">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">No students linked</h2>
            <p className="mt-2 text-sm text-slate-500">
              Link a student account first to view their results.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const items = results?.data ?? [];
  const pagination = results?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Child's Results</h1>
          <p className="mt-1 text-sm text-slate-500">
            View all exam results and track progress over time.
          </p>
        </div>

        {children.length > 1 && (
          <select
            value={selectedChildId ?? ''}
            onChange={(e) => setSelectedChildId(Number(e.target.value))}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {children.map((child) => (
              <option key={child.student.id} value={child.student.id}>
                {child.student.fullName}
              </option>
            ))}
          </select>
        )}
      </div>

      <Card padding="none">
        {loadingResults ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-500">No exam results found.</p>
            <p className="mt-1 text-xs text-slate-400">Results will appear here after your child takes an exam.</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Exam</TableHeaderCell>
                  <TableHeaderCell>Subject</TableHeaderCell>
                  <TableHeaderCell>Score</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Time</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((r: ChildResultItem) => (
                  <TableRow key={r.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell>
                      <span className="font-medium text-slate-900">{r.examTitle}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral">{r.subjectName}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-semibold ${r.score >= 5 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {r.score.toFixed(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.passed === true ? (
                        <Badge variant="success">Passed</Badge>
                      ) : r.passed === false ? (
                        <Badge variant="danger">Failed</Badge>
                      ) : (
                        <Badge variant="neutral">--</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-500">
                        {r.timeSpentSec ? `${Math.floor(r.timeSpentSec / 60)}m ${r.timeSpentSec % 60}s` : '--'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-500">
                        {new Date(r.submittedAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                <p className="text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages} ({pagination.total} results)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!pagination.hasPrev}
                    className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!pagination.hasNext}
                    className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
