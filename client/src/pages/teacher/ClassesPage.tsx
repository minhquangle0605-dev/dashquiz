import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import {
  addStudents,
  createActivity,
  createClass,
  createResource,
  createSection,
  getClassCourse,
  importStudents,
  listAvailableStudents,
  listClassNames,
  listClasses,
  listStudents,
  removeStudent,
  updateClass,
  uploadResourceFile,
  type AvailableStudent,
  type ClassNameOption,
} from '@/services/class.api';
import { listSubjects } from '@/services/question.api';
import type {
  ClassCourseOverview,
  ClassItem,
  ClassStudent,
} from '@/types/exam';
import type { CurriculumSubject } from '@/types/question';

import { ActivityModal, type ActivityFormValues } from './classes/ActivityModal';
import { AddStudentsModal } from './classes/AddStudentsModal';
import { ClassExamsTab } from './classes/ClassExamsTab';
import { ClassFormModal, type ClassFormValues } from './classes/ClassFormModal';
import { ClassGrid } from './classes/ClassGrid';
import { CourseSectionInline } from './classes/CourseSectionInline';
import { ImportStudentsModal } from './classes/ImportStudentsModal';
import { ResourceModal, type ResourceFormValues } from './classes/ResourceModal';
import { SectionModal, type SectionFormValues } from './classes/SectionModal';
import { StudentsScrollList } from './classes/StudentsScrollList';

type ClassDetailTab = 'course' | 'exams';

interface SemesterOption {
  id: number;
  name: string;
  academicYear?: { name: string };
}

const initialClassForm: ClassFormValues = {
  name: '',
  gradeLevel: 10,
  subjectId: 0,
  academicYearString: '',
};
const initialSectionForm: SectionFormValues = {
  title: '',
  description: '',
  isPublished: true,
};
const initialResourceForm: ResourceFormValues = {
  title: '',
  description: '',
  type: 'LESSON',
  sectionId: '',
  url: '',
  content: '',
  file: null,
  isPublished: true,
};
const initialActivityForm: ActivityFormValues = {
  title: '',
  type: 'ASSIGNMENT',
  sectionId: '',
  instructions: '',
  dueAt: '',
  maxScore: '',
  status: 'PUBLISHED',
};

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

  const [createForm, setCreateForm] = useState<ClassFormValues>(initialClassForm);
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

  const [sectionForm, setSectionForm] = useState<SectionFormValues>(initialSectionForm);
  const [resourceForm, setResourceForm] = useState<ResourceFormValues>(initialResourceForm);
  const [activityForm, setActivityForm] = useState<ActivityFormValues>(initialActivityForm);
  const [courseSaving, setCourseSaving] = useState(false);

  const [removingId, setRemovingId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ClassDetailTab>('course');

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
          mod
            .listSemesters()
            .then((data: SemesterOption[]) => setSemesters(data))
            .catch(() => {});
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
    setActiveTab('course');
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
      toast.error('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    setCreateSaving(true);
    try {
      await createClass(createForm);
      toast.success('Tạo lớp thành công!');
      setShowCreateModal(false);
      setCreateForm(initialClassForm);
      fetchClasses();
    } catch {
      toast.error('Không tạo được lớp.');
    } finally {
      setCreateSaving(false);
    }
  };

  const handleEditClass = async () => {
    if (!editingClass) return;
    setCreateSaving(true);
    try {
      await updateClass(editingClass.id, createForm);
      toast.success('Đã cập nhật lớp!');
      setEditingClass(null);
      fetchClasses();
    } catch {
      toast.error('Không cập nhật được.');
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

  // Load class-name filter options
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

  // Reset class-name filter if no longer valid
  useEffect(() => {
    if (!addClassNameFilter) return;
    if (classNameOptions.length === 0) return;
    const stillExists = classNameOptions.some(
      (opt) => opt.name.toLowerCase() === addClassNameFilter.toLowerCase(),
    );
    if (!stillExists) setAddClassNameFilter('');
  }, [classNameOptions, addClassNameFilter]);

  // Search available students (debounced)
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
      toast.error('Hãy chọn ít nhất một học sinh.');
      return;
    }
    const ids = Array.from(selectedStudentIds);
    setAddingSaving(true);
    try {
      await addStudents(selectedClass.id, ids);
      toast.success(`Đã thêm ${ids.length} học sinh!`);
      setShowAddStudentModal(false);
      setSelectedStudentIds(new Set());
      setAddStudentSearch('');
      const data = await listStudents(selectedClass.id);
      setStudents(Array.isArray(data) ? data : []);
      fetchClasses();
    } catch {
      toast.error('Không thêm được học sinh.');
    } finally {
      setAddingSaving(false);
    }
  };

  const handleRemoveStudent = async (studentId: number) => {
    if (!selectedClass) return;
    if (!window.confirm('Xóa học sinh này khỏi lớp?')) return;
    setRemovingId(studentId);
    try {
      await removeStudent(selectedClass.id, studentId);
      toast.success('Đã xóa học sinh.');
      setStudents((prev) => prev.filter((s) => s.studentId !== studentId));
      fetchClasses();
    } catch {
      toast.error('Không xóa được học sinh.');
    } finally {
      setRemovingId(null);
    }
  };

  const handleImport = async () => {
    if (!selectedClass || !importFile) return;
    setImporting(true);
    try {
      const result = await importStudents(selectedClass.id, importFile);
      toast.success(
        `Đã import ${result.imported} học sinh.${
          result.failed > 0 ? ` ${result.failed} thất bại.` : ''
        }`,
      );
      setShowImportModal(false);
      setImportFile(null);
      const data = await listStudents(selectedClass.id);
      setStudents(Array.isArray(data) ? data : []);
      fetchClasses();
    } catch {
      toast.error('Import thất bại. Kiểm tra format file.');
    } finally {
      setImporting(false);
    }
  };

  const handleCreateSection = async () => {
    if (!selectedClass || !sectionForm.title.trim()) return;
    setCourseSaving(true);
    try {
      await createSection(selectedClass.id, sectionForm);
      toast.success('Đã tạo section.');
      setShowSectionModal(false);
      setSectionForm(initialSectionForm);
      fetchCourse(selectedClass.id);
    } catch {
      toast.error('Không tạo được section.');
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
          toast.error('Hãy chọn file.');
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
      toast.success('Đã thêm resource.');
      setShowResourceModal(false);
      setResourceForm(initialResourceForm);
      fetchCourse(selectedClass.id);
    } catch {
      toast.error('Không thêm được resource.');
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
      toast.success('Đã tạo activity.');
      setShowActivityModal(false);
      setActivityForm(initialActivityForm);
      fetchCourse(selectedClass.id);
    } catch {
      toast.error('Không tạo được activity.');
    } finally {
      setCourseSaving(false);
    }
  };

  const handleCloseClassForm = () => {
    setShowCreateModal(false);
    setEditingClass(null);
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
            Lớp học
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Quản lý lớp, học sinh, nội dung khóa học và bài thi
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setEditingClass(null);
            setCreateForm(initialClassForm);
            setShowCreateModal(true);
          }}
          leftIcon={
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          }
        >
          Lớp mới
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Loading classes" />
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-bg-card)] py-20">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand-soft text-[var(--color-primary)]">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <p className="text-base font-bold text-[var(--color-text-primary)]">
            Chưa có lớp nào
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Tạo lớp đầu tiên để bắt đầu.
          </p>
          <Button
            variant="primary"
            size="md"
            className="mt-5"
            onClick={() => setShowCreateModal(true)}
          >
            Tạo lớp
          </Button>
        </div>
      ) : (
        <ClassGrid
          classes={classes}
          selectedClassId={selectedClass?.id}
          onSelect={handleSelectClass}
          onEdit={openEditModal}
        />
      )}

      {selectedClass && (
        <div className="mt-6 grid grid-cols-1 gap-5 animate-fade-in-up lg:grid-cols-12">
          <div className="lg:col-span-5 lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-7rem)] lg:min-h-[520px]">
            <StudentsScrollList
              selectedClass={selectedClass}
              students={students}
              loading={studentsLoading}
              removingId={removingId}
              onOpenImport={() => setShowImportModal(true)}
              onOpenAdd={openAddStudentModal}
              onRemove={handleRemoveStudent}
            />
          </div>

          <div className="lg:col-span-7">
            <Card padding="lg">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div role="tablist" className="inline-flex rounded-2xl bg-[var(--color-bg-muted)] p-1">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'course'}
                    onClick={() => setActiveTab('course')}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all duration-150 ${
                      activeTab === 'course'
                        ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Nội dung khóa học
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'exams'}
                    onClick={() => setActiveTab('exams')}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all duration-150 ${
                      activeTab === 'exams'
                        ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-[var(--shadow-sm)]'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    Bài thi
                  </button>
                </div>
              </div>

              {activeTab === 'course' ? (
                <CourseSectionInline
                  course={course}
                  loading={courseLoading}
                  onAddSection={() => setShowSectionModal(true)}
                  onAddResource={() => setShowResourceModal(true)}
                  onAddActivity={() => setShowActivityModal(true)}
                />
              ) : (
                <ClassExamsTab selectedClass={selectedClass} />
              )}
            </Card>
          </div>
        </div>
      )}

      <ClassFormModal
        isOpen={showCreateModal || editingClass !== null}
        isEditing={editingClass !== null}
        saving={createSaving}
        form={createForm}
        subjects={subjects}
        onChange={setCreateForm}
        onClose={handleCloseClassForm}
        onSubmit={editingClass ? handleEditClass : handleCreateClass}
      />

      <AddStudentsModal
        isOpen={showAddStudentModal}
        saving={addingSaving}
        loading={availableLoading}
        selectedClass={selectedClass}
        searchValue={addStudentSearch}
        gradeFilter={addGradeFilter}
        classNameFilter={addClassNameFilter}
        classNameOptions={classNameOptions}
        availableStudents={availableStudents}
        selectedIds={selectedStudentIds}
        allVisibleSelected={allVisibleSelected}
        onSearchChange={setAddStudentSearch}
        onGradeFilterChange={setAddGradeFilter}
        onClassNameFilterChange={setAddClassNameFilter}
        onToggleStudent={toggleStudentSelection}
        onToggleSelectAll={toggleSelectAllVisible}
        onClose={() => setShowAddStudentModal(false)}
        onSubmit={handleAddStudents}
      />

      <ImportStudentsModal
        isOpen={showImportModal}
        importing={importing}
        file={importFile}
        onFileChange={setImportFile}
        onClose={() => {
          setShowImportModal(false);
          setImportFile(null);
        }}
        onSubmit={handleImport}
      />

      <SectionModal
        isOpen={showSectionModal}
        saving={courseSaving}
        form={sectionForm}
        onChange={setSectionForm}
        onClose={() => setShowSectionModal(false)}
        onSubmit={handleCreateSection}
      />

      <ResourceModal
        isOpen={showResourceModal}
        saving={courseSaving}
        form={resourceForm}
        course={course}
        onChange={setResourceForm}
        onClose={() => setShowResourceModal(false)}
        onSubmit={handleCreateResource}
      />

      <ActivityModal
        isOpen={showActivityModal}
        saving={courseSaving}
        form={activityForm}
        course={course}
        onChange={setActivityForm}
        onClose={() => setShowActivityModal(false)}
        onSubmit={handleCreateActivity}
      />
    </div>
  );
}
