import {
  AttemptStatus,
  ClassMemberRole,
  GradeComponentType,
  GradeEntrySource,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { computeFinalScore } from '../exam/grading';
import type {
  CreateManualGradeInput,
  UpdateGradeScoreInput,
  LinkClassInput,
} from './class.validation';

// ───────────────────────────────────────────────────────────────────
// MOET grading (Circular 22)
//
// semesterAverage = (Σregular + 2·Σmidterm + 3·Σfinal) / (Nregular + 2·Nmidterm + 3·Nfinal)
//   – the classroom standard uses (Nregular + 5) on the denominator assuming
//     exactly 1 midterm + 1 final, but real classes can have multiple
//     mid/final entries (re-tests, make-ups). We use the generalised
//     weighted-average form which collapses to (Nregular + 5) in the
//     single-midterm + single-final case, matching the spec.
//
// yearAverage = (semesterAverageI + 2·semesterAverageII) / 3
//
// Classification (per-semester AND per-year, same rules):
//   TOT      – all subjects ≥ 6.5, at least 6 subjects ≥ 8.0
//   KHA      – all subjects ≥ 5.0, at least 6 subjects ≥ 6.5
//   DAT      – at least 6 subjects ≥ 5.0, and no subject < 3.5
//   CHUA_DAT – otherwise
// (For a single class we expose `subjectAverage` only — the multi-subject
//  classification is computed at the student-summary endpoint.)
// ───────────────────────────────────────────────────────────────────

const COEFFICIENT: Record<GradeComponentType, number> = {
  REGULAR: 1,
  MIDTERM: 2,
  FINAL: 3,
};

const COMPLETED_ATTEMPT_STATUSES = [
  AttemptStatus.SUBMITTED,
  AttemptStatus.GRADED,
];

const STAFF_CHANGE_ROLES = new Set(['admin', 'teacher']);

export type SubjectGradeStatus = 'TOT' | 'KHA' | 'DAT' | 'CHUA_DAT';

interface GradeItemPayload {
  id: number;
  componentType: GradeComponentType;
  source: GradeEntrySource;
  label: string | null;
  score: number;
  examAssignmentId: number | null;
  classActivityId: number | null;
  examTitle: string | null;
  activityTitle: string | null;
  recordedBy: { id: number; fullName: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface StudentGradeRow {
  student: {
    id: number;
    username: string;
    fullName: string | null;
    avatar: string | null;
  };
  entries: GradeItemPayload[];
  averages: {
    regular: number | null;
    midterm: number | null;
    final: number | null;
    semester: number | null;
  };
}

interface BuiltGradebook {
  class: {
    id: number;
    name: string;
    gradeLevel: number;
    linkedClassId: number | null;
    subject: { id: number; name: string; code: string } | null;
    semester: {
      id: number;
      name: string;
      academicYear: { id: number; name: string };
    } | null;
  };
  linkedClassSummary: {
    id: number;
    name: string;
    semester: { id: number; name: string } | null;
  } | null;
  students: StudentGradeRow[];
  yearAverageByStudent: Map<number, number | null>;
}

export class GradebookService {
  // ── helpers ───────────────────────────────────────────────────

  private round(value: number, precision = 2) {
    const factor = 10 ** precision;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  private normalizeToTen(
    rawScore: number | null | undefined,
    maxScore: number | null | undefined,
  ) {
    if (rawScore === null || rawScore === undefined || !Number.isFinite(rawScore)) {
      return null;
    }
    if (maxScore && maxScore > 0) {
      return this.round((rawScore / maxScore) * 10);
    }
    return rawScore <= 10 ? this.round(rawScore) : null;
  }

  private weightedAverage(scores: { score: number; coefficient: number }[]) {
    if (scores.length === 0) return null;
    let sum = 0;
    let weight = 0;
    for (const item of scores) {
      sum += item.score * item.coefficient;
      weight += item.coefficient;
    }
    if (weight === 0) return null;
    return this.round(sum / weight);
  }

  private simpleAverage(scores: number[]) {
    if (scores.length === 0) return null;
    return this.round(scores.reduce((s, n) => s + n, 0) / scores.length);
  }

  classifySubjectAverage(average: number | null): SubjectGradeStatus | null {
    if (average === null) return null;
    if (average >= 8.0) return 'TOT';
    if (average >= 6.5) return 'KHA';
    if (average >= 5.0) return 'DAT';
    return 'CHUA_DAT';
  }

  // ── access control ────────────────────────────────────────────

  private async getClassAccess(classId: number, userId: number, role: string) {
    const classEntity = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        memberRoles: { where: { userId }, select: { role: true } },
        classStudents: {
          where: { studentId: userId },
          select: { studentId: true },
        },
      },
    });

    if (!classEntity) throw new AppError('Class not found', 404);

    const normalizedRole = role.toLowerCase();
    const isAdmin = normalizedRole === 'admin';
    const isOwner =
      normalizedRole === 'teacher' && classEntity.teacherId === userId;
    const assignedRole = classEntity.memberRoles[0]?.role ?? null;
    const isEnrolledStudent =
      normalizedRole === 'student' && classEntity.classStudents.length > 0;
    const isStaffRole =
      assignedRole === 'TEACHER' ||
      assignedRole === 'TA' ||
      assignedRole === 'NON_EDITING_TEACHER';

    if (!isAdmin && !isOwner && !isStaffRole && !isEnrolledStudent) {
      throw new AppError('You do not have access to this class', 403);
    }

    // Per requirement: only TEACHER (class teacher / staff teacher) and ADMIN
    // are allowed to modify scores. TAs may view, not edit.
    const canEditGrades =
      isAdmin || isOwner || assignedRole === 'TEACHER';
    const canViewGrades =
      canEditGrades ||
      assignedRole === 'TA' ||
      assignedRole === 'NON_EDITING_TEACHER';

    return {
      classEntity,
      isStudent: isEnrolledStudent,
      capabilities: { canEditGrades, canViewGrades },
    };
  }

  private async assertCanEdit(classId: number, userId: number, role: string) {
    if (!STAFF_CHANGE_ROLES.has(role.toLowerCase())) {
      throw new AppError(
        'Only teachers and admins can modify grades',
        403,
      );
    }
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canEditGrades) {
      throw new AppError('You cannot modify grades in this class', 403);
    }
    return access;
  }

  private async assertCanView(classId: number, userId: number, role: string) {
    const access = await this.getClassAccess(classId, userId, role);
    if (!access.capabilities.canViewGrades) {
      throw new AppError('You cannot view the class gradebook', 403);
    }
    return access;
  }

  // ── auto-import: pull EXAM/ACTIVITY scores into student_grades ────

  /**
   * Sync auto-generated grade entries for one class:
   *   – ExamAssignment.gradeComponentType set ⇒ upsert StudentGrade per best attempt
   *   – ClassActivity.gradeComponentType set ⇒ upsert StudentGrade per graded submission
   *
   * Manually entered grades (source = MANUAL) are never touched here.
   * Existing auto entries are updated only when the underlying score changes;
   * each change is recorded in student_grade_changes.
   */
  private async syncAutoEntries(classId: number, actorId: number) {
    const [students, examAssignments, activities] = await Promise.all([
      prisma.classStudent.findMany({
        where: { classId },
        select: { studentId: true },
      }),
      prisma.examAssignment.findMany({
        where: { classId, gradeComponentType: { not: null } },
        include: {
          exam: {
            select: {
              id: true,
              gradingMethod: true,
              examQuestions: { select: { points: true } },
            },
          },
        },
      }),
      prisma.classActivity.findMany({
        where: { classId, gradeComponentType: { not: null } },
        include: {
          submissions: {
            where: { score: { not: null } },
            select: { studentId: true, score: true },
          },
        },
      }),
    ]);

    if (students.length === 0) return;
    const studentIds = students.map((s) => s.studentId);

    // For each exam assignment, derive each student's grade from their
    // completed attempts following the exam's grading method (§5).
    for (const assignment of examAssignments) {
      if (!assignment.gradeComponentType) continue;
      const maxScore = assignment.exam.examQuestions.reduce(
        (s, q) => s + Number(q.points),
        0,
      );
      const attempts = await prisma.examAttempt.findMany({
        where: {
          examId: assignment.examId,
          studentId: { in: studentIds },
          status: { in: COMPLETED_ATTEMPT_STATUSES },
          totalScore: { not: null },
        },
        select: {
          studentId: true,
          totalScore: true,
          startedAt: true,
        },
      });

      // Group attempts per student, then apply the configured grading method.
      const attemptsByStudent = new Map<number, typeof attempts>();
      for (const attempt of attempts) {
        const list = attemptsByStudent.get(attempt.studentId);
        if (list) list.push(attempt);
        else attemptsByStudent.set(attempt.studentId, [attempt]);
      }

      const finalByStudent = new Map<number, number>();
      for (const [studentId, studentAttempts] of attemptsByStudent) {
        const rawFinal = computeFinalScore(studentAttempts, assignment.exam.gradingMethod);
        if (rawFinal === null) continue;
        const normalized = this.normalizeToTen(rawFinal, maxScore);
        if (normalized === null) continue;
        finalByStudent.set(studentId, normalized);
      }

      for (const [studentId, score] of finalByStudent) {
        await this.upsertAutoEntry({
          classId,
          studentId,
          componentType: assignment.gradeComponentType,
          source: GradeEntrySource.EXAM,
          examAssignmentId: assignment.id,
          classActivityId: null,
          score,
          actorId,
        });
      }
    }

    // For each gradable activity, take latest graded submission per student
    for (const activity of activities) {
      if (!activity.gradeComponentType) continue;
      const grouped = new Map<number, number>();
      for (const submission of activity.submissions) {
        if (submission.score == null) continue;
        const score = this.normalizeToTen(submission.score, activity.maxScore);
        if (score === null) continue;
        grouped.set(submission.studentId, score);
      }

      for (const [studentId, score] of grouped) {
        await this.upsertAutoEntry({
          classId,
          studentId,
          componentType: activity.gradeComponentType,
          source: GradeEntrySource.ACTIVITY,
          examAssignmentId: null,
          classActivityId: activity.id,
          score,
          actorId,
        });
      }
    }
  }

  private async upsertAutoEntry(params: {
    classId: number;
    studentId: number;
    componentType: GradeComponentType;
    source: GradeEntrySource;
    examAssignmentId: number | null;
    classActivityId: number | null;
    score: number;
    actorId: number;
  }) {
    const existing = await prisma.studentGrade.findFirst({
      where: {
        studentId: params.studentId,
        ...(params.examAssignmentId
          ? { examAssignmentId: params.examAssignmentId }
          : { classActivityId: params.classActivityId }),
      },
    });

    if (!existing) {
      const created = await prisma.studentGrade.create({
        data: {
          classId: params.classId,
          studentId: params.studentId,
          componentType: params.componentType,
          source: params.source,
          score: new Prisma.Decimal(params.score),
          examAssignmentId: params.examAssignmentId,
          classActivityId: params.classActivityId,
          recordedById: params.actorId,
        },
      });
      await prisma.gradeChangeLog.create({
        data: {
          studentGradeId: created.id,
          changedById: params.actorId,
          oldScore: null,
          newScore: new Prisma.Decimal(params.score),
          oldComponentType: null,
          newComponentType: params.componentType,
          action: 'AUTO_CREATE',
          reason: 'Auto-imported from ' + params.source.toLowerCase(),
        },
      });
      return;
    }

    // Don't overwrite manual edits (source MANUAL) — teacher has taken
    // ownership of this entry. For auto entries, update only when score
    // or component type drifted.
    if (existing.source === GradeEntrySource.MANUAL) return;

    const previousScore = Number(existing.score);
    const sameScore = Math.abs(previousScore - params.score) < 0.005;
    const sameComponent = existing.componentType === params.componentType;
    if (sameScore && sameComponent) return;

    await prisma.studentGrade.update({
      where: { id: existing.id },
      data: {
        score: new Prisma.Decimal(params.score),
        componentType: params.componentType,
      },
    });
    await prisma.gradeChangeLog.create({
      data: {
        studentGradeId: existing.id,
        changedById: params.actorId,
        oldScore: new Prisma.Decimal(previousScore),
        newScore: new Prisma.Decimal(params.score),
        oldComponentType: existing.componentType,
        newComponentType: params.componentType,
        action: 'AUTO_UPDATE',
        reason: 'Re-synced from ' + params.source.toLowerCase(),
      },
    });
  }

  // ── public: list / view ───────────────────────────────────────

  async getClassGradebook(classId: number, userId: number, role: string) {
    await this.assertCanView(classId, userId, role);
    // Best-effort auto sync at read time so the teacher always sees fresh
    // numbers without waiting for a background job.
    try {
      await this.syncAutoEntries(classId, userId);
    } catch {
      // Ignore — gradebook still serves the existing entries.
    }
    const data = await this.buildGradebook(classId);
    return {
      success: true,
      message: 'Gradebook retrieved successfully',
      data: this.serializeGradebookData(data),
    };
  }

  async getAccessibleGradebooks(userId: number, role: string) {
    const normalizedRole = role.toLowerCase();
    if (normalizedRole !== 'admin' && normalizedRole !== 'teacher') {
      throw new AppError('Only teachers and admins can view gradebooks', 403);
    }

    const where: Prisma.ClassWhereInput =
      normalizedRole === 'admin'
        ? {}
        : {
            OR: [
              { teacherId: userId },
              {
                memberRoles: {
                  some: {
                    userId,
                    role: {
                      in: [
                        ClassMemberRole.TEACHER,
                        ClassMemberRole.TA,
                        ClassMemberRole.NON_EDITING_TEACHER,
                      ],
                    },
                  },
                },
              },
            ],
          };

    const classes = await prisma.class.findMany({
      where,
      select: { id: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    const gradebooks = [];
    for (const classEntity of classes) {
      try {
        await this.syncAutoEntries(classEntity.id, userId);
      } catch {
        // Keep serving existing grade entries if auto-sync fails for a class.
      }
      const gradebook = await this.buildGradebook(classEntity.id);
      gradebooks.push(this.serializeGradebookData(gradebook));
    }

    return {
      success: true,
      message: 'Gradebooks retrieved successfully',
      data: {
        scope: normalizedRole === 'admin' ? 'all' : 'teacher',
        gradebooks,
      },
    };
  }

  async getMyGradebook(
    classId: number,
    requesterId: number,
    role: string,
    studentId: number = requesterId,
  ) {
    const normalizedRole = role.toLowerCase();

    if (normalizedRole === 'student' && studentId !== requesterId) {
      throw new AppError('You can only view your own gradebook', 403);
    }

    if (normalizedRole === 'student' || normalizedRole === 'parent') {
      const enrollment = await prisma.classStudent.findUnique({
        where: { classId_studentId: { classId, studentId } },
      });
      if (!enrollment) {
        throw new AppError(
          normalizedRole === 'parent'
            ? 'Student is not enrolled in this class'
            : 'You do not have access to this class',
          403,
        );
      }
    } else {
      await this.assertCanView(classId, requesterId, role);
    }

    try {
      await this.syncAutoEntries(classId, requesterId);
    } catch {
      // ignore
    }

    const data = await this.buildGradebook(classId, studentId);

    return {
      success: true,
      message: 'Gradebook retrieved successfully',
      data: {
        class: data.class,
        student: data.students[0] ?? null,
        yearAverage: data.yearAverageByStudent.get(studentId) ?? null,
        linkedClass: data.linkedClassSummary,
      },
    };
  }

  // ── building blocks ───────────────────────────────────────────

  private buildAverages(entries: GradeItemPayload[]) {
    const byType: Record<GradeComponentType, number[]> = {
      REGULAR: [],
      MIDTERM: [],
      FINAL: [],
    };
    for (const entry of entries) {
      byType[entry.componentType].push(entry.score);
    }
    const regular = this.simpleAverage(byType.REGULAR);
    const midterm = this.simpleAverage(byType.MIDTERM);
    const final = this.simpleAverage(byType.FINAL);

    // semesterAverage = Σ(score × coeff) / Σ(coeff over each entry counted)
    const all: { score: number; coefficient: number }[] = [];
    for (const type of ['REGULAR', 'MIDTERM', 'FINAL'] as GradeComponentType[]) {
      for (const score of byType[type]) {
        all.push({ score, coefficient: COEFFICIENT[type] });
      }
    }
    return {
      regular,
      midterm,
      final,
      semester: this.weightedAverage(all),
    };
  }

  private async buildGradebook(
    classId: number,
    onlyStudentId?: number,
  ): Promise<BuiltGradebook> {
    const [classEntity, students, grades] = await Promise.all([
      prisma.class.findUnique({
        where: { id: classId },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          linkedClassId: true,
          subject: { select: { id: true, name: true, code: true } },
          semester: {
            select: {
              id: true,
              name: true,
              academicYear: { select: { id: true, name: true } },
            },
          },
          linkedClass: {
            select: {
              id: true,
              name: true,
              semester: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.classStudent.findMany({
        where: {
          classId,
          ...(onlyStudentId ? { studentId: onlyStudentId } : {}),
        },
        include: {
          student: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatar: true,
            },
          },
        },
        orderBy: { enrolledAt: 'asc' },
      }),
      prisma.studentGrade.findMany({
        where: {
          classId,
          ...(onlyStudentId ? { studentId: onlyStudentId } : {}),
        },
        include: {
          examAssignment: { select: { exam: { select: { title: true } } } },
          classActivity: { select: { title: true } },
          recordedBy: { select: { id: true, fullName: true } },
        },
        orderBy: [
          { componentType: 'asc' },
          { createdAt: 'asc' },
          { id: 'asc' },
        ],
      }),
    ]);

    if (!classEntity) throw new AppError('Class not found', 404);

    const byStudent = new Map<number, GradeItemPayload[]>();
    for (const grade of grades) {
      const payload: GradeItemPayload = {
        id: grade.id,
        componentType: grade.componentType,
        source: grade.source,
        label: grade.label,
        score: Number(grade.score),
        examAssignmentId: grade.examAssignmentId,
        classActivityId: grade.classActivityId,
        examTitle: grade.examAssignment?.exam.title ?? null,
        activityTitle: grade.classActivity?.title ?? null,
        recordedBy: grade.recordedBy
          ? { id: grade.recordedBy.id, fullName: grade.recordedBy.fullName }
          : null,
        createdAt: grade.createdAt,
        updatedAt: grade.updatedAt,
      };
      const bucket = byStudent.get(grade.studentId) ?? [];
      bucket.push(payload);
      byStudent.set(grade.studentId, bucket);
    }

    // Fetch year-average partner data if linked class exists. We only need
    // each student's semester average for the linked class to compute the year average.
    const yearAverageByStudent = new Map<number, number | null>();
    if (classEntity.linkedClassId) {
      const linkedGrades = await prisma.studentGrade.findMany({
        where: {
          classId: classEntity.linkedClassId,
          studentId: { in: students.map((s) => s.studentId) },
        },
        select: {
          studentId: true,
          componentType: true,
          score: true,
        },
      });
      const linkedByStudent = new Map<number, GradeItemPayload[]>();
      for (const grade of linkedGrades) {
        const bucket = linkedByStudent.get(grade.studentId) ?? [];
        bucket.push({
          id: 0,
          componentType: grade.componentType,
          source: GradeEntrySource.MANUAL,
          label: null,
          score: Number(grade.score),
          examAssignmentId: null,
          classActivityId: null,
          examTitle: null,
          activityTitle: null,
          recordedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        linkedByStudent.set(grade.studentId, bucket);
      }

      // The class on which we're called could be HK1 or HK2 — we always
      // treat the higher-numbered semester as HK2 (×2). Fall back to
      // current-class as HK1 if numbering can't be parsed.
      const currentSem = classEntity.semester?.name ?? '';
      const linkedSem = classEntity.linkedClass?.semester?.name ?? '';
      const currentIsHk2 = /2|II/i.test(currentSem) && !/1|I(?!I)/.test(currentSem);
      const linkedIsHk2 = /2|II/i.test(linkedSem) && !/1|I(?!I)/.test(linkedSem);

      for (const enrollment of students) {
        const currentAverages = this.buildAverages(
          byStudent.get(enrollment.studentId) ?? [],
        );
        const linkedAverages = this.buildAverages(
          linkedByStudent.get(enrollment.studentId) ?? [],
        );
        const hk1 = currentIsHk2
          ? linkedAverages.semester
          : currentAverages.semester;
        const hk2 = linkedIsHk2 || (!currentIsHk2 && !linkedIsHk2)
          ? linkedAverages.semester
          : currentAverages.semester;
        if (hk1 != null && hk2 != null) {
          yearAverageByStudent.set(
            enrollment.studentId,
            this.round((hk1 + 2 * hk2) / 3),
          );
        } else {
          yearAverageByStudent.set(enrollment.studentId, null);
        }
      }
    }

    const studentRows: StudentGradeRow[] = students.map((enrollment) => {
      const entries = byStudent.get(enrollment.studentId) ?? [];
      const averages = this.buildAverages(entries);
      return {
        student: enrollment.student,
        entries,
        averages,
      };
    });

    return {
      class: {
        id: classEntity.id,
        name: classEntity.name,
        gradeLevel: classEntity.gradeLevel,
        subject: classEntity.subject,
        semester: classEntity.semester,
        linkedClassId: classEntity.linkedClassId,
      },
      linkedClassSummary: classEntity.linkedClass ?? null,
      students: studentRows,
      yearAverageByStudent,
    };
  }

  // ── manual entry CRUD ─────────────────────────────────────────

  private serializeGradebookData(data: BuiltGradebook) {
    return {
      class: data.class,
      linkedClassSummary: data.linkedClassSummary,
      students: data.students.map((row) => ({
        ...row,
        yearAverage: data.yearAverageByStudent.get(row.student.id) ?? null,
        subjectStatus: this.classifySubjectAverage(row.averages.semester),
      })),
    };
  }

  async createManualGrade(
    classId: number,
    input: CreateManualGradeInput,
    userId: number,
    role: string,
  ) {
    await this.assertCanEdit(classId, userId, role);

    const enrollment = await prisma.classStudent.findUnique({
      where: {
        classId_studentId: { classId, studentId: input.studentId },
      },
    });
    if (!enrollment) {
      throw new AppError('Student is not enrolled in this class', 404);
    }

    const created = await prisma.studentGrade.create({
      data: {
        classId,
        studentId: input.studentId,
        componentType: input.componentType,
        source: GradeEntrySource.MANUAL,
        label: input.label?.trim() ?? null,
        score: new Prisma.Decimal(input.score),
        recordedById: userId,
      },
    });

    await prisma.gradeChangeLog.create({
      data: {
        studentGradeId: created.id,
        changedById: userId,
        oldScore: null,
        newScore: new Prisma.Decimal(input.score),
        oldComponentType: null,
        newComponentType: input.componentType,
        action: 'CREATE',
        reason: input.reason ?? null,
      },
    });

    return {
      success: true,
      message: 'Grade entry created',
      data: this.serializeGrade(created),
    };
  }

  async updateGradeScore(
    classId: number,
    gradeId: number,
    input: UpdateGradeScoreInput,
    userId: number,
    role: string,
  ) {
    await this.assertCanEdit(classId, userId, role);

    const existing = await prisma.studentGrade.findUnique({
      where: { id: gradeId },
    });
    if (!existing || existing.classId !== classId) {
      throw new AppError('Grade entry not found', 404);
    }

    const previousScore = Number(existing.score);
    const previousComponent = existing.componentType;
    const newScore = input.score ?? previousScore;
    const newComponent = input.componentType ?? previousComponent;
    const newLabel =
      input.label !== undefined ? input.label?.trim() ?? null : existing.label;

    const updated = await prisma.studentGrade.update({
      where: { id: gradeId },
      data: {
        score: new Prisma.Decimal(newScore),
        componentType: newComponent,
        label: newLabel,
        // Promote auto entries to MANUAL when the teacher overrides them
        // so the next sync doesn't clobber the override.
        source:
          existing.source === GradeEntrySource.MANUAL
            ? existing.source
            : GradeEntrySource.MANUAL,
        recordedById: userId,
      },
    });

    const scoreChanged = Math.abs(previousScore - newScore) > 0.005;
    const componentChanged = previousComponent !== newComponent;
    if (scoreChanged || componentChanged) {
      await prisma.gradeChangeLog.create({
        data: {
          studentGradeId: gradeId,
          changedById: userId,
          oldScore: new Prisma.Decimal(previousScore),
          newScore: new Prisma.Decimal(newScore),
          oldComponentType: previousComponent,
          newComponentType: newComponent,
          action: 'UPDATE',
          reason: input.reason ?? null,
        },
      });
    }

    return {
      success: true,
      message: 'Grade entry updated',
      data: this.serializeGrade(updated),
    };
  }

  async deleteGrade(
    classId: number,
    gradeId: number,
    userId: number,
    role: string,
    reason?: string,
  ) {
    await this.assertCanEdit(classId, userId, role);

    const existing = await prisma.studentGrade.findUnique({
      where: { id: gradeId },
    });
    if (!existing || existing.classId !== classId) {
      throw new AppError('Grade entry not found', 404);
    }

    // We keep the change log even after the entry is gone. To do that
    // we soft-delete by zeroing out the entry instead, OR we write the
    // delete log first then cascade-delete. We prefer the latter
    // because student_grade_changes cascades on FK delete; so we write
    // the change log first, then delete (the FK is ON DELETE CASCADE
    // so the prior logs go too — which is acceptable; the activity_log
    // table still has the high-level deletion record via the route
    // middleware).
    const previousScore = Number(existing.score);
    await prisma.gradeChangeLog.create({
      data: {
        studentGradeId: existing.id,
        changedById: userId,
        oldScore: new Prisma.Decimal(previousScore),
        newScore: null,
        oldComponentType: existing.componentType,
        newComponentType: null,
        action: 'DELETE',
        reason: reason ?? null,
      },
    });
    await prisma.studentGrade.delete({ where: { id: gradeId } });

    return {
      success: true,
      message: 'Grade entry deleted',
      data: { id: gradeId },
    };
  }

  async listGradeHistory(
    classId: number,
    gradeId: number,
    userId: number,
    role: string,
  ) {
    await this.assertCanView(classId, userId, role);
    const grade = await prisma.studentGrade.findUnique({
      where: { id: gradeId },
    });
    if (!grade || grade.classId !== classId) {
      throw new AppError('Grade entry not found', 404);
    }

    const history = await prisma.gradeChangeLog.findMany({
      where: { studentGradeId: gradeId },
      include: {
        changedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { changedAt: 'desc' },
    });

    return {
      success: true,
      message: 'Grade history retrieved',
      data: history.map((row) => ({
        id: row.id,
        action: row.action,
        oldScore: row.oldScore !== null ? Number(row.oldScore) : null,
        newScore: row.newScore !== null ? Number(row.newScore) : null,
        oldComponentType: row.oldComponentType,
        newComponentType: row.newComponentType,
        reason: row.reason,
        changedAt: row.changedAt,
        changedBy: row.changedBy,
      })),
    };
  }

  async listClassHistory(classId: number, userId: number, role: string) {
    await this.assertCanView(classId, userId, role);

    const history = await prisma.gradeChangeLog.findMany({
      where: { studentGrade: { classId } },
      include: {
        changedBy: { select: { id: true, fullName: true, role: true } },
        studentGrade: {
          select: {
            id: true,
            studentId: true,
            componentType: true,
            student: { select: { id: true, fullName: true, username: true } },
          },
        },
      },
      orderBy: { changedAt: 'desc' },
      take: 200,
    });

    return {
      success: true,
      message: 'Class grade history retrieved',
      data: history.map((row) => ({
        id: row.id,
        action: row.action,
        oldScore: row.oldScore !== null ? Number(row.oldScore) : null,
        newScore: row.newScore !== null ? Number(row.newScore) : null,
        oldComponentType: row.oldComponentType,
        newComponentType: row.newComponentType,
        reason: row.reason,
        changedAt: row.changedAt,
        changedBy: row.changedBy,
        gradeId: row.studentGradeId,
        student: row.studentGrade?.student ?? null,
        componentType: row.studentGrade?.componentType ?? null,
      })),
    };
  }

  // ── link / pair HK1 ↔ HK2 ─────────────────────────────────────

  async linkClass(
    classId: number,
    input: LinkClassInput,
    userId: number,
    role: string,
  ) {
    await this.assertCanEdit(classId, userId, role);

    const target = input.linkedClassId
      ? await prisma.class.findUnique({ where: { id: input.linkedClassId } })
      : null;

    if (input.linkedClassId && !target) {
      throw new AppError('Linked class not found', 404);
    }
    if (target && target.id === classId) {
      throw new AppError('A class cannot be linked to itself', 400);
    }

    const current = await prisma.class.findUnique({ where: { id: classId } });
    if (target && current && target.subjectId !== current.subjectId) {
      throw new AppError(
        'Linked class must teach the same subject',
        400,
      );
    }

    // Make the link bidirectional: set on both sides.
    await prisma.$transaction([
      prisma.class.update({
        where: { id: classId },
        data: { linkedClassId: input.linkedClassId ?? null },
      }),
      ...(target
        ? [
            prisma.class.update({
              where: { id: target.id },
              data: { linkedClassId: classId },
            }),
          ]
        : []),
    ]);

    return {
      success: true,
      message: input.linkedClassId
        ? 'Classes linked successfully'
        : 'Class link removed',
      data: { classId, linkedClassId: input.linkedClassId ?? null },
    };
  }

  // ── helpers ───────────────────────────────────────────────────

  private serializeGrade(grade: {
    id: number;
    classId: number;
    studentId: number;
    componentType: GradeComponentType;
    source: GradeEntrySource;
    label: string | null;
    score: Prisma.Decimal;
    examAssignmentId: number | null;
    classActivityId: number | null;
    recordedById: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: grade.id,
      classId: grade.classId,
      studentId: grade.studentId,
      componentType: grade.componentType,
      source: grade.source,
      label: grade.label,
      score: Number(grade.score),
      examAssignmentId: grade.examAssignmentId,
      classActivityId: grade.classActivityId,
      recordedById: grade.recordedById,
      createdAt: grade.createdAt,
      updatedAt: grade.updatedAt,
    };
  }
}

export const gradebookService = new GradebookService();
