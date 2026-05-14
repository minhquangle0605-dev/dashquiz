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
  listAvailableStudents,
  listClassNames,
  getClassCourse,
  createSection,
  createResource,
  uploadResourceFile,
  createActivity,
  type AvailableStudent,
  type ClassNameOption,
} from '@/services/class.api';
import { listSubjects } from '@/services/question.api';
import type {
  ClassActivity,
  ClassCourseOverview,
  ClassItem,
  ClassResource,
  ClassStudent,
  CreateClassPayload,
} from '@/types/exam';
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
  const [course, setCourse] = useState<ClassCourseOverview | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  const [createForm, setCreateForm] = useState<CreateClassPayload & { academicYearString?: string }>({
    name: '',
    gradeLevel: 10,
    subjectId: 0,
    academicYearString: '',
  });
  const [createSaving, setCreateSaving] = useState(false);

  const [addStudentSearch, setAddStudentSearch] = useState('');
  const [addGradeFilter, setAddGradeFilter] = useState<number | ''>('');
  const [addClassNameFilter, setAddClassNameFilter] = useState<string>('');
  const [classNameOptions, setClassNameOptions] = useState<ClassNameOption[]>([]);
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(new Set());
  const [addingSaving, setAddingSaving] = useState(false);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [sectionForm, setSectionForm] = useState({ title: '', description: '', isPublished: true });
  const [resourceForm, setResourceForm] = useState<{
    title: string;
    description: string;
    type: ClassResource['type'];
    sectionId: number | '';
    url: string;
    content: string;
    file: File | null;
    isPublished: boolean;
  }>({
    title: '',
    description: '',
    type: 'LESSON',
    sectionId: '',
    url: '',
    content: '',
    file: null,
    isPublished: true,
  });
  const [activityForm, setActivityForm] = useState<{
    title: string;
    type: ClassActivity['type'];
    sectionId: number | '';
    instructions: string;
    dueAt: string;
    maxScore: string;
    status: ClassActivity['status'];
  }>({
    title: '',
    type: 'ASSIGNMENT',
    sectionId: '',
    instructions: '',
    dueAt: '',
    maxScore: '',
    status: 'PUBLISHED',
  });
  const [courseSaving, setCourseSaving] = useState(false);

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

  const fetchCourse = useCallback(async (classId: number) => {
    setCourseLoading(true);
    try {
      const data = await getClassCourse(classId);
      setCourse(data);
    } catch {
      toast.error('Failed to load class content.');
      setCourse(null);
    } finally {
      setCourseLoading(false);
    }
  }, []);

  const handleSelectClass = async (cls: ClassItem) => {
    if (selectedClass?.id === cls.id) {
      setSelectedClass(null);
      setStudents([]);
      setCourse(null);
      return;
    }
    setSelectedClass(cls);
    setStudentsLoading(true);
    fetchCourse(cls.id);
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

  const openAddStudentModal = () => {
    setAddStudentSearch('');
    setAddGradeFilter(selectedClass?.gradeLevel ?? '');
    setAddClassNameFilter('');
    setSelectedStudentIds(new Set());
    setAvailableStudents([]);
    setShowAddStudentModal(true);
  };

  // Load distinct class names whenever the grade filter changes (or modal opens)
  useEffect(() => {
    if (!showAddStudentModal) return;
    let cancelled = false;
    const grade = typeof addGradeFilter === 'number' ? addGradeFilter : undefined;
    listClassNames(grade)
      .then((data) => {
        if (!cancelled) setClassNameOptions(data);
      })
      .catch(() => {
        if (!cancelled) setClassNameOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [showAddStudentModal, addGradeFilter]);

  // Reset class-name filter if it no longer exists for the selected grade
  useEffect(() => {
    if (!addClassNameFilter) return;
    if (classNameOptions.length === 0) return;
    const stillExists = classNameOptions.some(
      (opt) => opt.name.toLowerCase() === addClassNameFilter.toLowerCase(),
    );
    if (!stillExists) setAddClassNameFilter('');
  }, [classNameOptions, addClassNameFilter]);

  useEffect(() => {
    if (!showAddStudentModal || !selectedClass) return;
    let cancelled = false;
    setAvailableLoading(true);
    const handle = setTimeout(() => {
      listAvailableStudents(selectedClass.id, {
        search: addStudentSearch.trim() || undefined,
        gradeLevel: typeof addGradeFilter === 'number' ? addGradeFilter : undefined,
        homeroomClassName: addClassNameFilter || undefined,
        limit: 500,
      })
        .then((data) => {
          if (!cancelled) setAvailableStudents(data);
        })
        .catch(() => {
          if (!cancelled) {
            setAvailableStudents([]);
            toast.error('Failed to load students.');
          }
        })
        .finally(() => {
          if (!cancelled) setAvailableLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [showAddStudentModal, selectedClass, addStudentSearch, addGradeFilter, addClassNameFilter]);

  const toggleStudentSelection = (id: number) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected =
    availableStudents.length > 0 &&
    availableStudents.every((s) => selectedStudentIds.has(s.id));

  const toggleSelectAllVisible = () => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        availableStudents.forEach((s) => next.delete(s.id));
      } else {
        availableStudents.forEach((s) => next.add(s.id));
      }
      return next;
    });
  };

  const handleAddStudents = async () => {
    if (!selectedClass || selectedStudentIds.size === 0) {
      toast.error('Please select at least one student.');
      return;
    }
    const ids = Array.from(selectedStudentIds);
    setAddingSaving(true);
    try {
      await addStudents(selectedClass.id, ids);
      toast.success(`${ids.length} student(s) added!`);
      setShowAddStudentModal(false);
      setSelectedStudentIds(new Set());
      setAddStudentSearch('');
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

  const handleCreateSection = async () => {
    if (!selectedClass || !sectionForm.title.trim()) return;
    setCourseSaving(true);
    try {
      await createSection(selectedClass.id, sectionForm);
      toast.success('Section created.');
      setShowSectionModal(false);
      setSectionForm({ title: '', description: '', isPublished: true });
      fetchCourse(selectedClass.id);
    } catch {
      toast.error('Failed to create section.');
    } finally {
      setCourseSaving(false);
    }
  };

  const handleCreateResource = async () => {
    if (!selectedClass || !resourceForm.title.trim()) return;
    setCourseSaving(true);
    try {
      const sectionId = resourceForm.sectionId === '' ? null : resourceForm.sectionId;
      if (resourceForm.type === 'FILE') {
        if (!resourceForm.file) {
          toast.error('Please choose a file.');
          return;
        }
        await uploadResourceFile(selectedClass.id, {
          file: resourceForm.file,
          title: resourceForm.title,
          description: resourceForm.description || undefined,
          sectionId,
          isPublished: resourceForm.isPublished,
        });
      } else {
        await createResource(selectedClass.id, {
          title: resourceForm.title,
          description: resourceForm.description || undefined,
          type: resourceForm.type,
          sectionId,
          url: resourceForm.url || undefined,
          content: resourceForm.content || undefined,
          isPublished: resourceForm.isPublished,
        });
      }
      toast.success('Resource added.');
      setShowResourceModal(false);
      setResourceForm({
        title: '',
        description: '',
        type: 'LESSON',
        sectionId: '',
        url: '',
        content: '',
        file: null,
        isPublished: true,
      });
      fetchCourse(selectedClass.id);
    } catch {
      toast.error('Failed to add resource.');
    } finally {
      setCourseSaving(false);
    }
  };

  const handleCreateActivity = async () => {
    if (!selectedClass || !activityForm.title.trim()) return;
    setCourseSaving(true);
    try {
      await createActivity(selectedClass.id, {
        title: activityForm.title,
        type: activityForm.type,
        sectionId: activityForm.sectionId === '' ? null : activityForm.sectionId,
        instructions: activityForm.instructions || undefined,
        dueAt: activityForm.dueAt || undefined,
        maxScore: activityForm.maxScore ? Number(activityForm.maxScore) : undefined,
        status: activityForm.status,
      });
      toast.success('Activity created.');
      setShowActivityModal(false);
      setActivityForm({
        title: '',
        type: 'ASSIGNMENT',
        sectionId: '',
        instructions: '',
        dueAt: '',
        maxScore: '',
        status: 'PUBLISHED',
      });
      fetchCourse(selectedClass.id);
    } catch {
      toast.error('Failed to create activity.');
    } finally {
      setCourseSaving(false);
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
                <Button variant="primary" size="sm" onClick={openAddStudentModal}>
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

          <div className="mt-4">
            <Card padding="lg">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Course Content</h2>
                  <p className="text-sm text-slate-500">Sections, materials, activities, tracking, and submissions</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowSectionModal(true)}>
                    Add Section
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowResourceModal(true)}>
                    Add Resource
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setShowActivityModal(true)}>
                    Add Activity
                  </Button>
                </div>
              </div>

              {courseLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner size="md" label="Loading course" />
                </div>
              ) : !course ? (
                <p className="py-8 text-center text-sm text-slate-500">No course content loaded.</p>
              ) : (
                <div className="space-y-4">
                  {course.standaloneResources.length > 0 || course.standaloneActivities.length > 0 ? (
                    <CourseBlock
                      title="General"
                      resources={course.standaloneResources}
                      activities={course.standaloneActivities}
                    />
                  ) : null}
                  {course.sections.length === 0 &&
                  course.standaloneResources.length === 0 &&
                  course.standaloneActivities.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                      No sections or activities yet.
                    </p>
                  ) : (
                    course.sections.map((section) => (
                      <CourseBlock
                        key={section.id}
                        title={section.title}
                        subtitle={section.description}
                        resources={section.resources}
                        activities={section.activities}
                        hidden={!section.isPublished}
                      />
                    ))
                  )}
                </div>
              )}
            </Card>
          </div>
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
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Lọc theo khối &amp; lớp chủ nhiệm rồi chọn hàng loạt học sinh để thêm vào{' '}
            <strong>{selectedClass?.name}</strong>.
          </p>

          {/* Filter row */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              className={selectBase}
              value={addGradeFilter === '' ? '' : String(addGradeFilter)}
              onChange={(e) => {
                const val = e.target.value;
                setAddGradeFilter(val === '' ? '' : Number(val));
                setAddClassNameFilter('');
              }}
            >
              <option value="">Tất cả khối</option>
              {[10, 11, 12].map((g) => (
                <option key={g} value={g}>Khối {g}</option>
              ))}
            </select>

            <select
              className={selectBase}
              value={addClassNameFilter}
              onChange={(e) => setAddClassNameFilter(e.target.value)}
            >
              <option value="">Tất cả lớp chủ nhiệm</option>
              {classNameOptions.map((opt) => (
                <option key={`${opt.gradeLevel}-${opt.name}`} value={opt.name}>
                  {opt.name} (K{opt.gradeLevel})
                </option>
              ))}
            </select>

            <Input
              placeholder="Tìm theo tên / username…"
              value={addStudentSearch}
              onChange={(e) => setAddStudentSearch(e.target.value)}
            />
          </div>

          {/* Toolbar: select all */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={allVisibleSelected}
                disabled={availableStudents.length === 0 || availableLoading}
                onChange={toggleSelectAllVisible}
              />
              <span className="font-medium">
                Chọn tất cả ({availableStudents.length})
              </span>
            </label>
            <p className="text-xs text-slate-500">
              {selectedStudentIds.size} đã chọn
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white">
            {availableLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" label="Loading students" />
              </div>
            ) : availableStudents.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {addStudentSearch.trim() || addGradeFilter !== '' || addClassNameFilter
                  ? 'Không tìm thấy học sinh phù hợp.'
                  : 'Không còn học sinh nào để thêm.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {availableStudents.map((s) => {
                  const checked = selectedStudentIds.has(s.id);
                  return (
                    <li key={s.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-slate-50 ${
                          checked ? 'bg-indigo-50/60' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={checked}
                          onChange={() => toggleStudentSelection(s.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-800">
                            {s.fullName || s.username}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            @{s.username}
                            {s.homeroomClassName && (
                              <span className="ml-2 text-slate-400">
                                · Lớp {s.homeroomClassName}
                                {s.gradeLevel ? ` (K${s.gradeLevel})` : ''}
                              </span>
                            )}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddStudentModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              isLoading={addingSaving}
              disabled={selectedStudentIds.size === 0}
              onClick={handleAddStudents}
            >
              Add{selectedStudentIds.size > 0 ? ` (${selectedStudentIds.size})` : ''}
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

      {/* Course Section Modal */}
      <Modal
        isOpen={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        title="Add Section"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={sectionForm.title}
            onChange={(e) => setSectionForm((p) => ({ ...p, title: e.target.value }))}
          />
          <Input
            label="Description"
            value={sectionForm.description}
            onChange={(e) => setSectionForm((p) => ({ ...p, description: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={sectionForm.isPublished}
              onChange={(e) => setSectionForm((p) => ({ ...p, isPublished: e.target.checked }))}
            />
            Published to students
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSectionModal(false)}>Cancel</Button>
            <Button variant="primary" isLoading={courseSaving} onClick={handleCreateSection}>Create</Button>
          </div>
        </div>
      </Modal>

      {/* Course Resource Modal */}
      <Modal
        isOpen={showResourceModal}
        onClose={() => setShowResourceModal(false)}
        title="Add Resource"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Title"
              value={resourceForm.title}
              onChange={(e) => setResourceForm((p) => ({ ...p, title: e.target.value }))}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
              <select
                className={selectBase}
                value={resourceForm.type}
                onChange={(e) => setResourceForm((p) => ({ ...p, type: e.target.value as ClassResource['type'] }))}
              >
                <option value="LESSON">Lesson</option>
                <option value="LINK">External link</option>
                <option value="VIDEO">Video</option>
                <option value="FILE">File</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Section</label>
            <select
              className={selectBase}
              value={resourceForm.sectionId}
              onChange={(e) => setResourceForm((p) => ({ ...p, sectionId: e.target.value ? Number(e.target.value) : '' }))}
            >
              <option value="">General</option>
              {course?.sections.map((section) => (
                <option key={section.id} value={section.id}>{section.title}</option>
              ))}
            </select>
          </div>
          <Input
            label="Description"
            value={resourceForm.description}
            onChange={(e) => setResourceForm((p) => ({ ...p, description: e.target.value }))}
          />
          {resourceForm.type === 'FILE' ? (
            <input
              type="file"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={(e) => setResourceForm((p) => ({ ...p, file: e.target.files?.[0] ?? null }))}
            />
          ) : resourceForm.type === 'LESSON' ? (
            <textarea
              className={`${selectBase} min-h-28`}
              placeholder="Lesson content"
              value={resourceForm.content}
              onChange={(e) => setResourceForm((p) => ({ ...p, content: e.target.value }))}
            />
          ) : (
            <Input
              label={resourceForm.type === 'VIDEO' ? 'Video URL' : 'URL'}
              value={resourceForm.url}
              onChange={(e) => setResourceForm((p) => ({ ...p, url: e.target.value }))}
            />
          )}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={resourceForm.isPublished}
              onChange={(e) => setResourceForm((p) => ({ ...p, isPublished: e.target.checked }))}
            />
            Published to students
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowResourceModal(false)}>Cancel</Button>
            <Button variant="primary" isLoading={courseSaving} onClick={handleCreateResource}>Add</Button>
          </div>
        </div>
      </Modal>

      {/* Course Activity Modal */}
      <Modal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        title="Add Activity"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Title"
              value={activityForm.title}
              onChange={(e) => setActivityForm((p) => ({ ...p, title: e.target.value }))}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
              <select
                className={selectBase}
                value={activityForm.type}
                onChange={(e) => setActivityForm((p) => ({ ...p, type: e.target.value as ClassActivity['type'] }))}
              >
                <option value="ASSIGNMENT">Assignment</option>
                <option value="QUIZ">Quiz</option>
                <option value="FORUM">Forum</option>
                <option value="WORKSHOP">Workshop</option>
                <option value="ATTENDANCE">Attendance</option>
                <option value="SURVEY">Survey</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              className={selectBase}
              value={activityForm.sectionId}
              onChange={(e) => setActivityForm((p) => ({ ...p, sectionId: e.target.value ? Number(e.target.value) : '' }))}
            >
              <option value="">General</option>
              {course?.sections.map((section) => (
                <option key={section.id} value={section.id}>{section.title}</option>
              ))}
            </select>
            <Input
              type="datetime-local"
              value={activityForm.dueAt}
              onChange={(e) => setActivityForm((p) => ({ ...p, dueAt: e.target.value }))}
            />
            <Input
              placeholder="Max score"
              value={activityForm.maxScore}
              onChange={(e) => setActivityForm((p) => ({ ...p, maxScore: e.target.value }))}
            />
          </div>
          <textarea
            className={`${selectBase} min-h-28`}
            placeholder="Instructions"
            value={activityForm.instructions}
            onChange={(e) => setActivityForm((p) => ({ ...p, instructions: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowActivityModal(false)}>Cancel</Button>
            <Button variant="primary" isLoading={courseSaving} onClick={handleCreateActivity}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CourseBlock({
  title,
  subtitle,
  resources,
  activities,
  hidden,
}: {
  title: string;
  subtitle?: string | null;
  resources: ClassResource[];
  activities: ClassActivity[];
  hidden?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {hidden && <Badge variant="warning">Hidden</Badge>}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Resources</p>
          {resources.length === 0 ? (
            <p className="text-sm text-slate-500">No resources.</p>
          ) : (
            <ul className="space-y-2">
              {resources.map((resource) => (
                <li key={resource.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{resource.title}</span>
                    <Badge variant={resource.isPublished ? 'success' : 'warning'}>{resource.type}</Badge>
                  </div>
                  {resource.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{resource.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Activities</p>
          {activities.length === 0 ? (
            <p className="text-sm text-slate-500">No activities.</p>
          ) : (
            <ul className="space-y-2">
              {activities.map((activity) => (
                <li key={activity.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-slate-800">{activity.title}</span>
                    <Badge variant={activity.status === 'PUBLISHED' ? 'success' : 'warning'}>
                      {activity.type}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {activity.dueAt ? `Due ${new Date(activity.dueAt).toLocaleString()}` : 'No deadline'}
                    {activity.maxScore !== null && activity.maxScore !== undefined ? ` - ${activity.maxScore} pts` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
