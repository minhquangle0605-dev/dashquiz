import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  getAdminOverview,
  getAdminClasses,
  getAdminSubjects,
} from '@/services/adminAnalytics.api';

type Tab = 'classes' | 'subjects';

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('classes');

  const { data: overview } = useQuery({ queryKey: ['admin-analytics-overview'], queryFn: getAdminOverview });
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['admin-analytics-classes'],
    queryFn: getAdminClasses,
    enabled: tab === 'classes',
  });
  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['admin-analytics-subjects'],
    queryFn: getAdminSubjects,
    enabled: tab === 'subjects',
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">School Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cross-class and cross-subject performance overview for administrators.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <KpiCard label="Exams" value={overview?.examCount ?? '—'} />
        <KpiCard label="Classes" value={overview?.classCount ?? '—'} />
        <KpiCard label="Students" value={overview?.studentCount ?? '—'} />
        <KpiCard label="Attempts" value={overview?.totalAttempts ?? '—'} />
        <KpiCard label="Avg score" value={overview?.avgScore ?? '—'} />
        <KpiCard label="Pass rate" value={overview ? `${overview.passRate}%` : '—'} />
        <KpiCard label="Flagged Qs" value={overview?.flaggedQuestions ?? '—'} />
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(['classes', 'subjects'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'classes' ? 'Class comparison' : 'Subject trends'}
          </button>
        ))}
      </div>

      {tab === 'classes' &&
        (classesLoading ? (
          <Loading />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Class</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3 text-right">Students</th>
                    <th className="px-4 py-3 text-right">Attempts</th>
                    <th className="px-4 py-3 text-right">Avg score</th>
                    <th className="px-4 py-3 text-right">Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(!classes || classes.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No class data
                      </td>
                    </tr>
                  )}
                  {classes?.map((c) => (
                    <tr key={c.classId} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {c.className}
                        <span className="ml-1 text-xs text-slate-400">G{c.gradeLevel}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.subjectName}</td>
                      <td className="px-4 py-3 text-slate-500">{c.teacherName ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.studentCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.attemptCount}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{c.avgScore}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{c.passRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

      {tab === 'subjects' &&
        (subjectsLoading ? (
          <Loading />
        ) : (
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3 text-right">Exams</th>
                    <th className="px-4 py-3 text-right">Attempts</th>
                    <th className="px-4 py-3 text-right">Avg score</th>
                    <th className="px-4 py-3 text-right">Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(!subjects || subjects.length === 0) && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No subject data
                      </td>
                    </tr>
                  )}
                  {subjects?.map((s) => (
                    <tr key={s.subjectId} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {s.subjectName}
                        <span className="ml-1 text-xs text-slate-400">{s.subjectCode}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{s.examCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{s.attemptCount}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{s.avgScore}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{s.passRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner size="lg" />
    </div>
  );
}
