import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/Table';
import {
  listSubjects,
  updateSubject,
  listAcademicYears,
  createAcademicYear,
  updateAcademicYear,
  listSemesters,
  createSemester,
  updateSemester,
} from '@/services/admin.api';
import type {
  Subject,
  AcademicYear,
  Semester,
  UpdateSubjectPayload,
  CreateAcademicYearPayload,
  CreateSemesterPayload,
} from '@/types/admin';

type Tab = 'subjects' | 'years' | 'semesters';

const TABS: { id: Tab; label: string }[] = [
  { id: 'subjects', label: 'Subjects' },
  { id: 'years', label: 'Academic Years' },
  { id: 'semesters', label: 'Semesters' },
];

export default function AcademicPage() {
  const [activeTab, setActiveTab] = useState<Tab>('subjects');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Academic Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage academic years, semesters, and the three core subjects (MATH, PHY, CHEM).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'subjects' && <SubjectsTab />}
      {activeTab === 'years' && <AcademicYearsTab />}
      {activeTab === 'semesters' && <SemestersTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUBJECTS TAB
// ═══════════════════════════════════════════════

const subjectEditSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  description: z.string().max(500).optional().or(z.literal('')),
  status: z.coerce.number(),
});

type SubjectFormData = z.infer<typeof subjectEditSchema>;

function SubjectsTab() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Subject | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSubjects();
      setSubjects(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openEdit(s: Subject) { setEditing(s); }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{subjects.length} subject(s) total</p>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : subjects.length === 0 ? (
          <EmptyState icon="book" message="No core subjects" sub="Run the database seed so MATH, PHY, and CHEM exist." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Code</TableHeaderCell>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Description</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell>
                    <Badge variant="info">{s.code}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{s.name}</TableCell>
                  <TableCell className="max-w-xs truncate">{s.description ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === 1 ? 'success' : 'warning'}>
                      {s.status === 1 ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => openEdit(s)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {editing && (
        <SubjectModal
          subject={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); fetchData(); }}
        />
      )}
    </>
  );
}

function SubjectModal({
  subject,
  onClose,
  onSuccess,
}: {
  subject: Subject;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SubjectFormData>({
    resolver: zodResolver(subjectEditSchema),
  });

  useEffect(() => {
    reset({
      name: subject.name,
      description: subject.description ?? '',
      status: subject.status,
    });
  }, [subject, reset]);

  async function onSubmit(data: SubjectFormData) {
    try {
      const payload: UpdateSubjectPayload = { ...data, description: data.description || undefined };
      await updateSubject(subject.id, payload);
      toast.success('Subject updated');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Operation failed');
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Edit Subject">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Code</p>
          <Badge variant="info">{subject.code}</Badge>
          <p className="mt-1 text-xs text-slate-500">Subject codes are fixed for this deployment.</p>
        </div>
        <Input label="Subject Name" error={errors.name?.message} {...register('name')} />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            rows={3}
            {...register('description')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            {...register('status')}
          >
            <option value={1}>Active</option>
            <option value={0}>Inactive</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════════════
// ACADEMIC YEARS TAB
// ═══════════════════════════════════════════════

const yearSchema = z.object({
  name: z.string().min(1, 'Name is required').max(20),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  isCurrent: z.boolean(),
});

type YearFormData = z.infer<typeof yearSchema>;

function AcademicYearsTab() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAcademicYears();
      setYears(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load academic years');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(y: AcademicYear) { setEditing(y); setShowModal(true); }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{years.length} academic year(s)</p>
        <Button onClick={openCreate}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Academic Year
        </Button>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : years.length === 0 ? (
          <EmptyState icon="calendar" message="No academic years" sub="Create your first academic year." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Start Date</TableHeaderCell>
                <TableHeaderCell>End Date</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Semesters</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {years.map((y) => (
                <TableRow key={y.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-medium text-slate-900">{y.name}</TableCell>
                  <TableCell>{new Date(y.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(y.endDate).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {y.isCurrent ? (
                      <Badge variant="success">Current</Badge>
                    ) : (
                      <Badge variant="neutral">Archived</Badge>
                    )}
                  </TableCell>
                  <TableCell>{y._count?.semesters ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => openEdit(y)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <YearModal
        isOpen={showModal}
        year={editing}
        onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); fetchData(); }}
      />
    </>
  );
}

function YearModal({
  isOpen,
  year,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  year: AcademicYear | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!year;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<YearFormData>({
    resolver: zodResolver(yearSchema),
  });

  useEffect(() => {
    if (isOpen) {
      reset(year
        ? { name: year.name, startDate: year.startDate.split('T')[0], endDate: year.endDate.split('T')[0], isCurrent: year.isCurrent }
        : { name: '', startDate: '', endDate: '', isCurrent: false }
      );
    }
  }, [isOpen, year, reset]);

  async function onSubmit(data: YearFormData) {
    try {
      const payload: CreateAcademicYearPayload = data;
      if (isEdit) await updateAcademicYear(year!.id, payload);
      else await createAcademicYear(payload);
      toast.success(isEdit ? 'Academic year updated' : 'Academic year created');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Operation failed');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Academic Year' : 'Add Academic Year'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name" placeholder="e.g. 2025-2026" error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Start Date" type="date" error={errors.startDate?.message} {...register('startDate')} />
          <Input label="End Date" type="date" error={errors.endDate?.message} {...register('endDate')} />
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" {...register('isCurrent')} />
          <span className="text-sm font-medium text-slate-700">Set as current academic year</span>
        </label>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>{isEdit ? 'Save Changes' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════════════
// SEMESTERS TAB
// ═══════════════════════════════════════════════

const semesterSchema = z.object({
  academicYearId: z.coerce.number().min(1, 'Select an academic year'),
  name: z.string().min(1, 'Name is required').max(20),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
});

type SemesterFormData = z.infer<typeof semesterSchema>;

function SemestersTab() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [semData, yearData] = await Promise.all([
        listSemesters(filterYear ? Number(filterYear) : undefined),
        listAcademicYears(),
      ]);
      setSemesters(Array.isArray(semData) ? semData : []);
      setYears(Array.isArray(yearData) ? yearData : []);
    } catch {
      toast.error('Failed to load semesters');
    } finally {
      setLoading(false);
    }
  }, [filterYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(s: Semester) { setEditing(s); setShowModal(true); }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">{semesters.length} semester(s)</p>
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
          >
            <option value="">All Academic Years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
        <Button onClick={openCreate}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Semester
        </Button>
      </div>

      <Card padding="none">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : semesters.length === 0 ? (
          <EmptyState icon="calendar" message="No semesters" sub="Create your first semester." />
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Academic Year</TableHeaderCell>
                <TableHeaderCell>Start Date</TableHeaderCell>
                <TableHeaderCell>End Date</TableHeaderCell>
                <TableHeaderCell>Classes</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {semesters.map((s) => (
                <TableRow key={s.id} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="font-medium text-slate-900">{s.name}</TableCell>
                  <TableCell>{s.academicYear?.name ?? `Year #${s.academicYearId}`}</TableCell>
                  <TableCell>{new Date(s.startDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(s.endDate).toLocaleDateString()}</TableCell>
                  <TableCell>{s._count?.classes ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => openEdit(s)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <SemesterModal
        isOpen={showModal}
        semester={editing}
        years={years}
        onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); fetchData(); }}
      />
    </>
  );
}

function SemesterModal({
  isOpen,
  semester,
  years,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  semester: Semester | null;
  years: AcademicYear[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!semester;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SemesterFormData>({
    resolver: zodResolver(semesterSchema),
  });

  useEffect(() => {
    if (isOpen) {
      reset(semester
        ? { academicYearId: semester.academicYearId, name: semester.name, startDate: semester.startDate.split('T')[0], endDate: semester.endDate.split('T')[0] }
        : { academicYearId: years[0]?.id ?? 0, name: '', startDate: '', endDate: '' }
      );
    }
  }, [isOpen, semester, years, reset]);

  async function onSubmit(data: SemesterFormData) {
    try {
      const payload: CreateSemesterPayload = data;
      if (isEdit) await updateSemester(semester!.id, payload);
      else await createSemester(payload);
      toast.success(isEdit ? 'Semester updated' : 'Semester created');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Operation failed');
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Semester' : 'Add Semester'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Academic Year</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            {...register('academicYearId')}
          >
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
          {errors.academicYearId && <p className="mt-1.5 text-sm text-red-600">{errors.academicYearId.message}</p>}
        </div>
        <Input label="Semester Name" placeholder="e.g. Semester 1" error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Start Date" type="date" error={errors.startDate?.message} {...register('startDate')} />
          <Input label="End Date" type="date" error={errors.endDate?.message} {...register('endDate')} />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" isLoading={isSubmitting}>{isEdit ? 'Save Changes' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Shared Small Components ────────────────────────

function EditIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function EmptyState({ icon, message, sub }: { icon: string; message: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {icon === 'book' ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        )}
      </svg>
      <p className="mt-3 text-sm font-medium text-slate-500">{message}</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  );
}
