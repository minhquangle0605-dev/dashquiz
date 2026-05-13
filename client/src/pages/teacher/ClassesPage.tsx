import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '@/components/ui/Table';
import {
  listClasses,
  createClass,
  updateClass,
  listStudents,
  addStudents,
  removeStudent,
  importStudents,
  getImportTemplateUrl,
} from '@/services/class.api';
import { listSubjects } from '@/services/question.api';
import type { ClassItem, ClassStudent, CreateClassPayload } from '@/types/exam';
import type { CurriculumSubject } from '@/types/question';

interface SemesterOption {
  id: number;
  name: string;
  academicYear?: { name: string };
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [, setSemesters] = useState<SemesterOption[]>([]);

  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  const [createForm, setCreateForm] = useState<CreateClassPayload & { academicYearString?: string }>({
    name: '',
    gradeLevel: 10,
    subjectId: 0,
    academicYearString: '',
  });
  const [createSaving, setCreateSaving] = useState(false);

  const [addStudentIds, setAddStudentIds] = useState('');
  const [addingSaving, setAddingSaving] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listClasses({ pageSize: 100 });
      setClasses(res.items ?? (res as unknown as ClassItem[]));
    } catch {
      toast.error('Failed to load classes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
    listSubjects().then(setSubjects).catch(() => {});
    import('@/services/admin.api')
      .then((mod) => {
        if (mod.listSemesters) {
          mod.listSemesters().then((data: SemesterOption[]) => setSemesters(data)).catch(() => {});
        }
      })
      .catch(() => {});
  }, [fetchClasses]);

  const handleSelectClass = async (cls: ClassItem) => {
    if (selectedClass?.id === cls.id) {
      setSelectedClass(null);
      setStudents([]);
      return;
    }
    setSelectedClass(cls);
    setStudentsLoading(true);
    try {
      const data = await listStudents(cls.id);
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load students.');
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleCreateClass = async () => {
    if (!createForm.name.trim() || !createForm.subjectId || !createForm.academicYearString) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setCreateSaving(true);
    try {
      await createClass(createForm);
      toast.success('Class created successfully!');
      setShowCreateModal(false);
      setCreateForm({ name: '', gradeLevel: 10, subjectId: 0, academicYearString: '' });
      fetchClasses();
    } catch {
      toast.error('Failed to create class.');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleEditClass = async () => {
    if (!editingClass) return;
    setCreateSaving(true);
    try {
      await updateClass(editingClass.id, createForm);
      toast.success('Class updated!');
      setEditingClass(null);
      fetchClasses();
    } catch {
      toast.error('Failed to update class.');
    } finally {
      setCreateSaving(false);
    }
  };

  const openEditModal = (cls: ClassItem) => {
    setCreateForm({
      name: cls.name,
      gradeLevel: cls.gradeLevel,
      subjectId: cls.subjectId,
      academicYearString: cls.semester?.academicYear?.name || '',
    });
    setEditingClass(cls);
  };

  const handleAddStudents = async () => {
    if (!selectedClass || !addStudentIds.trim()) return;
    const ids = addStudentIds
      .split(/[\s,]+/)
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    if (ids.length === 0) {
      toast.error('Please enter valid student IDs.');
      return;
    }
    setAddingSaving(true);
    try {
      await addStudents(selectedClass.id, ids);
      toast.success(`${ids.length} student(s) added!`);
      setShowAddStudentModal(false);
      setAddStudentIds('');
      const data = await listStudents(selectedClass.id);
      setStudents(Array.isArray(data) ? data : []);
      fetchClasses();
    } catch {
      toast.error('Failed to add students.');
    } finally {
      setAddingSaving(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!selectedClass) return;
    if (!window.confirm('Remove this student from the class?')) return;
    setRemovingId(studentId);
    try {
      await removeStudent(selectedClass.id, studentId);
      toast.success('Student removed.');
      setStudents((prev) => prev.filter((s) => s.studentId !== studentId));
      fetchClasses();
    } catch {
      toast.error('Failed to remove student.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleImport = async () => {
    if (!selectedClass || !importFile) return;
    setImporting(true);
    try {
      const result = await importStudents(selectedClass.id, importFile);
      toast.success(`Imported ${result.imported} student(s). ${result.failed > 0 ? `${result.failed} failed.` : ''}`);
      setShowImportModal(false);
      setImportFile(null);
      const data = await listStudents(selectedClass.id);
      setStudents(Array.isArray(data) ? data : []);
      fetchClasses();
    } catch {
      toast.error('Import failed. Please check the file format.');
    } finally {
      setImporting(false);
    }
  };

  const selectBase =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Classes</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage your classes and students</p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setEditingClass(null); setCreateForm({ name: '', gradeLevel: 10, subjectId: 0, academicYearString: '' }); setShowCreateModal(true); }}>
          <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Class
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading classes" />
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20">
          <svg className="mb-4 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-base font-semibold text-slate-700">No classes yet</p>
          <p className="mt-1 text-sm text-slate-500">Create your first class to get started.</p>
          <Button variant="primary" size="md" className="mt-5" onClick={() => setShowCreateModal(true)}>
            Create Class
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => {
            const isSelected = selectedClass?.id === cls.id;
            return (
              <button
                key={cls.id}
                type="button"
                onClick={() => handleSelectClass(cls)}
                className={`group rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:shadow-md ${
                  isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">{cls.name}</h3>
                  <Badge variant="info">Grade {cls.gradeLevel}</Badge>
                </div>
                <div className="space-y-1 text-sm text-slate-500">
                  {cls.subject && <p>Subject: <strong className="text-slate-700">{cls.subject.name}</strong></p>}
                  {cls.semester && (
                    <p>
                      Semester: <strong className="text-slate-700">{cls.semester.name}</strong>
                      {cls.semester.academicYear && (
                        <span className="text-slate-400"> ({cls.semester.academicYear.name})</span>
                      )}
                    </p>
                  )}
                  <p>
                    Students: <strong className="text-slate-700">{cls._count?.classStudents ?? 0}</strong>
                  </p>
                </div>
                <div className="mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); openEditModal(cls); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); openEditModal(cls); } }}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                  >
                    Edit
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Class Detail Panel */}
      {selectedClass && (
        <div className="mt-6">
          <Card padding="lg">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{selectedClass.name} — Students</h2>
                <p className="text-sm text-slate-500">{students.length} enrolled</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
                  <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Import Excel
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowAddStudentModal(true)}>
                  <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Students
                </Button>
              </div>
            </div>

            {studentsLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="md" label="Loading students" />
              </div>
            ) : students.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No students enrolled yet.</p>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>#</TableHeaderCell>
                    <TableHeaderCell>Full Name</TableHeaderCell>
                    <TableHeaderCell>Username</TableHeaderCell>
                    <TableHeaderCell>Enrolled</TableHeaderCell>
                    <TableHeaderCell className="text-right">Action</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.map((s, idx) => (
                    <TableRow key={s.studentId}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {s.student.fullName || '—'}
                      </TableCell>
                      <TableCell>{s.student.username}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(s.enrolledAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={removingId === s.studentId}
                          onClick={() => handleRemoveStudent(s.studentId)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Create / Edit Class Modal */}
      <Modal
        isOpen={showCreateModal || editingClass !== null}
        onClose={() => { setShowCreateModal(false); setEditingClass(null); }}
        title={editingClass ? 'Edit Class' : 'Create New Class'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Class Name"
            placeholder="e.g. 10A1"
            value={createForm.name}
            onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Grade Level</label>
            <select
              className={selectBase}
              value={createForm.gradeLevel}
              onChange={(e) => setCreateForm((p) => ({ ...p, gradeLevel: Number(e.target.value) }))}
            >
              {[10, 11, 12].map((g) => (
                <option key={g} value={g}>Grade {g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Subject</label>
            <select
              className={selectBase}
              value={createForm.subjectId || ''}
              onChange={(e) => setCreateForm((p) => ({ ...p, subjectId: Number(e.target.value) }))}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Semester</label>
            <input
              type="text"
              placeholder="20xx - 20yy"
              className={selectBase}
              value={createForm.academicYearString || ''}
              onChange={(e) => {
                let val = e.target.value;
                // If user types exactly 4 digits, auto format to 20xx - 20yy
                if (/^\d{4}$/.test(val)) {
                  const startYear = parseInt(val, 10);
                  val = `${startYear} - ${startYear + 1}`;
                }
                setCreateForm((p) => ({ ...p, academicYearString: val }));
              }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setShowCreateModal(false); setEditingClass(null); }}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={createSaving}
              onClick={editingClass ? handleEditClass : handleCreateClass}
            >
              {editingClass ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Students Modal */}
      <Modal
        isOpen={showAddStudentModal}
        onClose={() => setShowAddStudentModal(false)}
        title="Add Students"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Enter student IDs separated by commas or spaces.
          </p>
          <textarea
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            rows={4}
            placeholder="e.g. 1, 2, 3, 4, 5"
            value={addStudentIds}
            onChange={(e) => setAddStudentIds(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddStudentModal(false)}>Cancel</Button>
            <Button variant="primary" isLoading={addingSaving} onClick={handleAddStudents}>
              Add
            </Button>
          </div>
        </div>
      </Modal>

      {/* Import Students Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportFile(null); }}
        title="Import Students from Excel"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Upload an Excel file with student information.{' '}
            <a
              href={getImportTemplateUrl()}
              className="font-medium text-indigo-600 hover:text-indigo-500"
              download
            >
              Download template
            </a>
          </p>
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="mx-auto block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            />
            {importFile && (
              <p className="mt-2 text-sm text-slate-600">Selected: <strong>{importFile.name}</strong></p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={importing} disabled={!importFile} onClick={handleImport}>
              Import
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
