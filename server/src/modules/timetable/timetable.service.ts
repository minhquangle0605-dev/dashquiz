import * as XLSX from 'xlsx';
import { Prisma, TimetableSlotKind } from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { CORE_SUBJECT_CODES } from '../../constants/subjects';
import {
  SCHOOL_DAY,
  formatMinute,
  formatMinuteRange,
  rangesOverlap,
  toVnClock,
} from './timetable.time';
import type {
  CreateSlotInput,
  UpdateSlotInput,
  CreateTimetableClassInput,
} from './timetable.validation';

export interface ConflictItem {
  type:
    | 'MANAGED_TIMETABLE_SLOT'
    | 'MANAGED_EXAM'
    | 'DISPLAY_TIMETABLE_SLOT'
    | 'OUTSIDE_SCHOOL_HOURS'
    | 'WEEKEND'
    | 'MAX_TESTS_PER_DAY'
    | 'ROOM_DOUBLE_BOOKED'
    | 'PROCTOR_DOUBLE_BOOKED';
  className: string | null;
  subjectName?: string | null;
  periodIndex?: number | null;
  time: string;
  message: string;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  hardConflicts: ConflictItem[];
  softWarnings: ConflictItem[];
}

export interface ConflictCheckParams {
  classIds: number[];
  subjectId?: number | null;
  startTime: Date;
  endTime: Date;
  excludeExamId?: number | null;
  /** Phase 6: room and proctor are checked for soft double-booking when provided. */
  room?: string | null;
  proctorId?: number | null;
}

/** Soft cap on managed (Math/Physics/Chemistry) tests a class may sit on one day. */
export const MAX_MANAGED_TESTS_PER_DAY = 2;

interface RequestUser {
  id: number;
  role: string;
}

type ManagedSubjectMatch = { subjectId: number; kind: TimetableSlotKind };

export class TimetableService {
  // ═══════════════════════════════════════════════
  // ACCESS GUARDS
  // ═══════════════════════════════════════════════

  private async getClassOrThrow(classId: number) {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, gradeLevel: true, teacherId: true, semesterId: true },
    });
    if (!cls) throw new AppError('Class not found', 404);
    return cls;
  }

  /** Read access: admin, class teacher/staff, enrolled student, or a parent of a child in the class. */
  private async assertCanView(classId: number, user: RequestUser) {
    const cls = await this.getClassOrThrow(classId);
    const { id: userId, role } = user;

    if (role === 'admin') return cls;

    if (role === 'teacher') {
      if (cls.teacherId === userId) return cls;
      const member = await prisma.classMemberRoleAssignment.findUnique({
        where: { classId_userId: { classId, userId } },
        select: { role: true },
      });
      if (member) return cls;
    } else if (role === 'student') {
      const enrolled = await prisma.classStudent.findUnique({
        where: { classId_studentId: { classId, studentId: userId } },
        select: { studentId: true },
      });
      if (enrolled) return cls;
      const profile = await prisma.studentProfile.findUnique({
        where: { userId },
        select: { classId: true },
      });
      if (profile?.classId === classId) return cls;
    } else if (role === 'parent') {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId },
        select: { children: { select: { userId: true, classId: true } } },
      });
      const children = parentProfile?.children ?? [];
      if (children.some((c) => c.classId === classId)) return cls;
      const childUserIds = children.map((c) => c.userId);
      if (childUserIds.length > 0) {
        const enrolled = await prisma.classStudent.findFirst({
          where: { classId, studentId: { in: childUserIds } },
          select: { studentId: true },
        });
        if (enrolled) return cls;
      }
    }

    throw new AppError('You do not have access to this class timetable', 403);
  }

  /** Manage access: admin only. Timetable editing is an administrator-only capability. */
  private async assertCanManage(classId: number, user: RequestUser) {
    const cls = await this.getClassOrThrow(classId);

    if (user.role === 'admin') return cls;

    throw new AppError('Only administrators can manage the class timetable', 403);
  }

  // ═══════════════════════════════════════════════
  // SUBJECT MAPPING (displayName / subjectId → kind)
  // ═══════════════════════════════════════════════

  /**
   * Decide whether a slot maps to a managed Subject. An explicit core subjectId wins;
   * otherwise the displayName is matched (case-insensitive) against managed subject names.
   */
  private async resolveSlotSubject(
    displayName: string,
    subjectId?: number | null,
  ): Promise<ManagedSubjectMatch | { subjectId: null; kind: TimetableSlotKind }> {
    if (subjectId != null) {
      const subject = await prisma.subject.findUnique({
        where: { id: subjectId },
        select: { id: true, code: true },
      });
      if (subject && (CORE_SUBJECT_CODES as readonly string[]).includes(subject.code)) {
        return { subjectId: subject.id, kind: TimetableSlotKind.MANAGED_SUBJECT };
      }
      // A non-core subjectId is ignored — such subjects are display-only.
    }

    const managed = await prisma.subject.findFirst({
      where: {
        code: { in: [...CORE_SUBJECT_CODES] },
        name: { equals: displayName.trim(), mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (managed) {
      return { subjectId: managed.id, kind: TimetableSlotKind.MANAGED_SUBJECT };
    }

    return { subjectId: null, kind: TimetableSlotKind.DISPLAY_ONLY };
  }

  // ═══════════════════════════════════════════════
  // GET CLASS TIMETABLE
  // ═══════════════════════════════════════════════

  async getClassTimetable(classId: number, user: RequestUser) {
    const cls = await this.assertCanView(classId, user);

    const slots = await prisma.classTimetableSlot.findMany({
      where: { classId, status: 'ACTIVE' },
      orderBy: [{ dayOfWeek: 'asc' }, { periodIndex: 'asc' }, { startMinute: 'asc' }],
      select: {
        id: true,
        classId: true,
        subjectId: true,
        displayName: true,
        kind: true,
        status: true,
        dayOfWeek: true,
        periodIndex: true,
        startMinute: true,
        endMinute: true,
        room: true,
        note: true,
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      success: true,
      message: 'Class timetable retrieved successfully',
      data: {
        class: { id: cls.id, name: cls.name, gradeLevel: cls.gradeLevel },
        slots,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // CREATE SLOT
  // ═══════════════════════════════════════════════

  async createSlot(classId: number, data: CreateSlotInput, user: RequestUser) {
    const cls = await this.assertCanManage(classId, user);
    const mapping = await this.resolveSlotSubject(data.displayName, data.subjectId);

    const slot = await prisma.classTimetableSlot.create({
      data: {
        classId,
        semesterId: data.semesterId ?? cls.semesterId,
        subjectId: mapping.subjectId,
        displayName: data.displayName.trim(),
        kind: mapping.kind,
        status: 'ACTIVE',
        dayOfWeek: data.dayOfWeek,
        periodIndex: data.periodIndex,
        startMinute: data.startMinute,
        endMinute: data.endMinute,
        room: data.room ?? null,
        note: data.note ?? null,
        createdBy: user.id,
      },
      include: { subject: { select: { id: true, name: true, code: true } } },
    });

    return { success: true, message: 'Timetable slot created successfully', data: slot };
  }

  // ═══════════════════════════════════════════════
  // UPDATE SLOT
  // ═══════════════════════════════════════════════

  async updateSlot(classId: number, slotId: number, data: UpdateSlotInput, user: RequestUser) {
    await this.assertCanManage(classId, user);

    const existing = await prisma.classTimetableSlot.findUnique({ where: { id: slotId } });
    if (!existing || existing.classId !== classId) {
      throw new AppError('Timetable slot not found in this class', 404);
    }

    const updateData: Prisma.ClassTimetableSlotUpdateInput = {};
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.periodIndex !== undefined) updateData.periodIndex = data.periodIndex;
    if (data.startMinute !== undefined) updateData.startMinute = data.startMinute;
    if (data.endMinute !== undefined) updateData.endMinute = data.endMinute;
    if (data.room !== undefined) updateData.room = data.room;
    if (data.note !== undefined) updateData.note = data.note;
    if (data.status !== undefined) updateData.status = data.status;

    // If the display name (or explicit subject) changes, re-derive kind + subject mapping.
    if (data.displayName !== undefined || data.subjectId !== undefined) {
      const displayName = (data.displayName ?? existing.displayName).trim();
      const mapping = await this.resolveSlotSubject(displayName, data.subjectId ?? undefined);
      updateData.displayName = displayName;
      updateData.kind = mapping.kind;
      updateData.subject = mapping.subjectId
        ? { connect: { id: mapping.subjectId } }
        : { disconnect: true };
    }

    if (data.semesterId !== undefined) {
      updateData.semester = data.semesterId
        ? { connect: { id: data.semesterId } }
        : { disconnect: true };
    }

    const slot = await prisma.classTimetableSlot.update({
      where: { id: slotId },
      data: updateData,
      include: { subject: { select: { id: true, name: true, code: true } } },
    });

    return { success: true, message: 'Timetable slot updated successfully', data: slot };
  }

  // ═══════════════════════════════════════════════
  // CANCEL SLOT (soft delete → status = CANCELLED)
  // ═══════════════════════════════════════════════

  async cancelSlot(classId: number, slotId: number, user: RequestUser) {
    await this.assertCanManage(classId, user);

    const existing = await prisma.classTimetableSlot.findUnique({ where: { id: slotId } });
    if (!existing || existing.classId !== classId) {
      throw new AppError('Timetable slot not found in this class', 404);
    }

    await prisma.classTimetableSlot.update({
      where: { id: slotId },
      data: { status: 'CANCELLED' },
    });

    return { success: true, message: 'Timetable slot cancelled successfully', data: { id: slotId } };
  }

  // ═══════════════════════════════════════════════
  // CLEAR WHOLE CLASS TIMETABLE (hard delete every slot)
  // ═══════════════════════════════════════════════

  async clearClassTimetable(classId: number, user: RequestUser) {
    await this.assertCanManage(classId, user);

    const { count } = await prisma.classTimetableSlot.deleteMany({ where: { classId } });

    return {
      success: true,
      message: `Cleared ${count} timetable slot(s)`,
      data: { deleted: count },
    };
  }

  // ═══════════════════════════════════════════════
  // CHECK EXAM-SCHEDULE CONFLICTS (used by API + exam.service)
  // ═══════════════════════════════════════════════

  async checkExamScheduleConflicts(params: ConflictCheckParams): Promise<ConflictCheckResult> {
    const { classIds, startTime, endTime, excludeExamId } = params;

    const hardConflicts: ConflictItem[] = [];
    const softWarnings: ConflictItem[] = [];

    if (classIds.length === 0) {
      return { hasConflict: false, hardConflicts, softWarnings };
    }

    const startClock = toVnClock(startTime);
    const endClock = toVnClock(endTime);
    const dayOfWeek = startClock.dayOfWeek;
    const startMinute = startClock.minuteOfDay;
    // Same-day window when start/end fall on the same VN day; otherwise clamp to end-of-day.
    const endMinute =
      endClock.dayOfWeek === startClock.dayOfWeek && endClock.minuteOfDay > startClock.minuteOfDay
        ? endClock.minuteOfDay
        : 24 * 60;

    // ── Timetable slots overlapping this weekly window ──
    const slots = await prisma.classTimetableSlot.findMany({
      where: {
        classId: { in: classIds },
        status: 'ACTIVE',
        dayOfWeek,
        startMinute: { lt: endMinute },
        endMinute: { gt: startMinute },
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    for (const slot of slots) {
      const item: ConflictItem = {
        type: slot.kind === 'MANAGED_SUBJECT' ? 'MANAGED_TIMETABLE_SLOT' : 'DISPLAY_TIMETABLE_SLOT',
        className: slot.class.name,
        subjectName: slot.subject?.name ?? slot.displayName,
        periodIndex: slot.periodIndex,
        time: formatMinuteRange(slot.startMinute, slot.endMinute),
        message:
          slot.kind === 'MANAGED_SUBJECT'
            ? `Overlaps the ${slot.subject?.name ?? slot.displayName} period of class ${slot.class.name}`
            : `Overlaps the ${slot.displayName} period of class ${slot.class.name}`,
      };
      if (slot.kind === 'MANAGED_SUBJECT') hardConflicts.push(item);
      else softWarnings.push(item);
    }

    // ── Other managed-subject exam schedules clashing with these classes (PDF §4.2) ──
    // A stored schedule is relevant when its *effective* classes intersect classIds:
    //   • per-class schedule (classId set) → just that class
    //   • global schedule (classId null)   → every class the exam is assigned to
    const examSchedules = await prisma.examSchedule.findMany({
      where: {
        ...(excludeExamId != null ? { examId: { not: excludeExamId } } : {}),
        status: { in: ['PENDING', 'ACTIVE'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        exam: { subject: { code: { in: [...CORE_SUBJECT_CODES] } } },
        OR: [
          { classId: { in: classIds } },
          { classId: null, exam: { examAssignments: { some: { classId: { in: classIds } } } } },
        ],
      },
      include: {
        class: { select: { id: true, name: true } },
        exam: {
          select: {
            id: true,
            title: true,
            subject: { select: { id: true, name: true, code: true } },
            examAssignments: {
              where: { classId: { in: classIds } },
              select: { class: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    for (const schedule of examSchedules) {
      const classNames = schedule.class
        ? schedule.class.name
        : schedule.exam.examAssignments.map((a) => a.class.name).join(', ');
      const sStart = toVnClock(schedule.startTime);
      const sEnd = toVnClock(schedule.endTime);
      hardConflicts.push({
        type: 'MANAGED_EXAM',
        className: classNames || null,
        subjectName: schedule.exam.subject.name,
        time: `${formatMinute(sStart.minuteOfDay)}-${formatMinute(sEnd.minuteOfDay)}`,
        message: `Overlaps exam "${schedule.exam.title}" (${schedule.exam.subject.name}) of class ${classNames}`,
      });
    }

    // ── Soft: outside school hours / weekend ──
    if (startMinute < SCHOOL_DAY.startMinute || endMinute > SCHOOL_DAY.endMinute) {
      softWarnings.push({
        type: 'OUTSIDE_SCHOOL_HOURS',
        className: null,
        time: formatMinuteRange(startMinute, Math.min(endMinute, 24 * 60)),
        message: `Scheduled outside school hours (${formatMinuteRange(SCHOOL_DAY.startMinute, SCHOOL_DAY.endMinute)})`,
      });
    }
    if (dayOfWeek === 7) {
      softWarnings.push({
        type: 'WEEKEND',
        className: null,
        time: formatMinuteRange(startMinute, Math.min(endMinute, 24 * 60)),
        message: 'Scheduled on a Sunday',
      });
    }

    // ── Soft: too many managed tests on the same day (Phase 6) ──
    // The VN calendar day containing startTime, expressed as a UTC window.
    const dayStartUtc = new Date(startTime.getTime() - startMinute * 60_000);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60_000);
    const sameDayManaged = await prisma.examSchedule.findMany({
      where: {
        ...(excludeExamId != null ? { examId: { not: excludeExamId } } : {}),
        status: { in: ['PENDING', 'ACTIVE'] },
        startTime: { gte: dayStartUtc, lt: dayEndUtc },
        exam: { subject: { code: { in: [...CORE_SUBJECT_CODES] } } },
        OR: [
          { classId: { in: classIds } },
          { classId: null, exam: { examAssignments: { some: { classId: { in: classIds } } } } },
        ],
      },
      select: { examId: true },
      distinct: ['examId'],
    });
    if (sameDayManaged.length >= MAX_MANAGED_TESTS_PER_DAY) {
      softWarnings.push({
        type: 'MAX_TESTS_PER_DAY',
        className: null,
        time: formatMinuteRange(startMinute, Math.min(endMinute, 24 * 60)),
        message: `This class already has ${sameDayManaged.length} managed test(s) scheduled on this day (recommended max ${MAX_MANAGED_TESTS_PER_DAY})`,
      });
    }

    // ── Soft: room / proctor double-booked at this time (Phase 6) ──
    if (params.room && params.room.trim()) {
      const roomClash = await prisma.examSchedule.findFirst({
        where: {
          ...(excludeExamId != null ? { examId: { not: excludeExamId } } : {}),
          status: { in: ['PENDING', 'ACTIVE'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          room: { equals: params.room.trim(), mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (roomClash) {
        softWarnings.push({
          type: 'ROOM_DOUBLE_BOOKED',
          className: null,
          time: formatMinuteRange(startMinute, Math.min(endMinute, 24 * 60)),
          message: `Room "${params.room.trim()}" is already booked for another exam at this time`,
        });
      }
    }
    if (params.proctorId != null) {
      const proctorClash = await prisma.examSchedule.findFirst({
        where: {
          ...(excludeExamId != null ? { examId: { not: excludeExamId } } : {}),
          status: { in: ['PENDING', 'ACTIVE'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
          proctorId: params.proctorId,
        },
        select: { id: true },
      });
      if (proctorClash) {
        softWarnings.push({
          type: 'PROCTOR_DOUBLE_BOOKED',
          className: null,
          time: formatMinuteRange(startMinute, Math.min(endMinute, 24 * 60)),
          message: 'The selected proctor is already assigned to another exam at this time',
        });
      }
    }

    return {
      hasConflict: hardConflicts.length > 0 || softWarnings.length > 0,
      hardConflicts,
      softWarnings,
    };
  }

  async checkConflicts(params: ConflictCheckParams, user: RequestUser) {
    // Manage-level guard: only teachers/admins probe conflicts before scheduling.
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw new AppError('Insufficient permissions', 403);
    }
    const result = await this.checkExamScheduleConflicts(params);
    return { success: true, message: 'Conflict check completed', data: result };
  }

  // ═══════════════════════════════════════════════
  // IMPORT TIMETABLE FROM EXCEL (Phase 4)
  // ═══════════════════════════════════════════════

  async importTimetable(classId: number, fileBuffer: Buffer, user: RequestUser) {
    // The passed classId is the *default* target for rows that omit a className.
    // When a row carries a className, the slot is routed to (or creates) that class instead,
    // so a single file can populate the whole school — not just the selected class.
    const defaultClass = await this.assertCanManage(classId, user);

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new AppError('Excel file has no sheets', 400);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
      defval: '',
    });
    if (rows.length === 0) throw new AppError('Excel file is empty', 400);

    const errors: { row: number; message: string }[] = [];
    let imported = 0;
    let updated = 0;

    // Target classes resolved during this import, keyed by lower-cased name. Seeded with the
    // default class so rows without a className (legacy single-class files) still land somewhere.
    const classCache = new Map<string, { id: number; semesterId: number | null }>();
    classCache.set(defaultClass.name.trim().toLowerCase(), {
      id: defaultClass.id,
      semesterId: defaultClass.semesterId,
    });
    const createdClassNames: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // header is row 1
      const raw = rows[i];

      const displayName = String(raw.displayName ?? raw.display_name ?? '').trim();
      const className = String(raw.className ?? raw.class_name ?? raw.class ?? '').trim();
      const dayOfWeek = this.parseDayOfWeek(raw.dayOfWeek ?? raw.day_of_week);
      const periodIndex = Number(raw.periodIndex ?? raw.period_index);
      const startMinute = this.parseTimeToMinutes(raw.startTime ?? raw.start_time);
      const endMinute = this.parseTimeToMinutes(raw.endTime ?? raw.end_time);
      const room = String(raw.room ?? '').trim() || null;

      if (!displayName) {
        errors.push({ row: rowNum, message: 'displayName is required' });
        continue;
      }
      if (!dayOfWeek) {
        errors.push({ row: rowNum, message: 'dayOfWeek must be Mon–Sun or 1–7' });
        continue;
      }
      if (!Number.isInteger(periodIndex) || periodIndex < 1 || periodIndex > 12) {
        errors.push({ row: rowNum, message: 'periodIndex must be 1–12' });
        continue;
      }
      if (startMinute === null || endMinute === null || endMinute <= startMinute) {
        errors.push({ row: rowNum, message: 'startTime/endTime invalid (use HH:MM, end after start)' });
        continue;
      }

      // Route the row to its class. A blank className falls back to the selected class.
      let target: { id: number; semesterId: number | null };
      if (className) {
        try {
          target = await this.resolveOrCreateClass(
            className,
            raw.gradeLevel ?? raw.grade_level ?? raw.grade,
            classCache,
            createdClassNames,
          );
        } catch (err) {
          errors.push({
            row: rowNum,
            message: err instanceof AppError ? err.message : 'Failed to resolve class',
          });
          continue;
        }
      } else {
        target = { id: defaultClass.id, semesterId: defaultClass.semesterId };
      }

      const mapping = await this.resolveSlotSubject(displayName);

      // Idempotent per (class, day, period): update existing else create.
      const existing = await prisma.classTimetableSlot.findFirst({
        where: { classId: target.id, dayOfWeek, periodIndex },
        select: { id: true },
      });

      if (existing) {
        await prisma.classTimetableSlot.update({
          where: { id: existing.id },
          data: {
            displayName,
            kind: mapping.kind,
            subjectId: mapping.subjectId,
            status: 'ACTIVE',
            startMinute,
            endMinute,
            room,
            semesterId: target.semesterId,
          },
        });
        updated++;
      } else {
        await prisma.classTimetableSlot.create({
          data: {
            classId: target.id,
            semesterId: target.semesterId,
            subjectId: mapping.subjectId,
            displayName,
            kind: mapping.kind,
            status: 'ACTIVE',
            dayOfWeek,
            periodIndex,
            startMinute,
            endMinute,
            room,
            createdBy: user.id,
          },
        });
        imported++;
      }
    }

    const createdClasses = createdClassNames.length;
    const createdSuffix = createdClasses ? `, created ${createdClasses} class(es)` : '';
    return {
      success: true,
      message: `Imported ${imported} new slot(s), updated ${updated}${createdSuffix}`,
      data: {
        imported,
        updated,
        createdClasses,
        createdClassNames,
        failed: errors.length,
        total: rows.length,
        errors: errors.length > 0 ? errors : null,
      },
    };
  }

  /**
   * Resolve the timetable target class for a row's className, creating it when absent.
   * A new class copies teacher / subject / semester from an existing class (preferring the
   * same grade level), since the Class model requires all three. The grade level comes from
   * an explicit hint or the leading number of the name (e.g. "10A3" → grade 10).
   */
  private async resolveOrCreateClass(
    rawName: string,
    gradeHint: unknown,
    cache: Map<string, { id: number; semesterId: number | null }>,
    createdNames: string[],
  ): Promise<{ id: number; semesterId: number | null }> {
    const name = rawName.trim();
    const key = name.toLowerCase();
    const cached = cache.get(key);
    if (cached) return cached;

    const existing = await prisma.class.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      orderBy: { id: 'asc' },
      select: { id: true, semesterId: true },
    });
    if (existing) {
      const resolved = { id: existing.id, semesterId: existing.semesterId };
      cache.set(key, resolved);
      return resolved;
    }

    const gradeLevel = this.parseGradeLevel(gradeHint) ?? this.parseGradeFromName(name);
    if (gradeLevel === null) {
      throw new AppError(
        `Cannot create class "${name}": grade level unknown (add a gradeLevel column or start the name with the grade, e.g. 10A3)`,
        400,
      );
    }

    const created = await this.createClassFromTemplate(name, gradeLevel);

    const resolved = { id: created.id, semesterId: created.semesterId };
    cache.set(key, resolved);
    createdNames.push(name);
    return resolved;
  }

  /**
   * Create a bare class with just a name + grade. The Class model requires a
   * teacher / subject / semester, so these are copied from an existing class
   * (preferring the same grade level). Shared by the Excel import and the
   * timetable "New Class" action.
   */
  private async createClassFromTemplate(name: string, gradeLevel: number) {
    const template =
      (await prisma.class.findFirst({
        where: { gradeLevel },
        orderBy: { id: 'asc' },
        select: { teacherId: true, subjectId: true, semesterId: true },
      })) ??
      (await prisma.class.findFirst({
        orderBy: { id: 'asc' },
        select: { teacherId: true, subjectId: true, semesterId: true },
      }));

    if (!template) {
      throw new AppError(
        `Cannot create class "${name}": no existing class to copy teacher/subject/semester from. Create at least one class from the Classes page first.`,
        400,
      );
    }

    return prisma.class.create({
      data: {
        name,
        gradeLevel,
        semesterId: template.semesterId,
        teacherId: template.teacherId,
        subjectId: template.subjectId,
      },
      select: { id: true, name: true, gradeLevel: true, semesterId: true },
    });
  }

  /**
   * Create a class from the timetable screen — name + grade only.
   * Distinct from the Classes-page create (subject + academic year): the
   * timetable just needs the class identity, so subject/semester/teacher are
   * inherited from an existing class via {@link createClassFromTemplate}.
   */
  async createClass(data: CreateTimetableClassInput, user: RequestUser) {
    if (user.role !== 'admin') {
      throw new AppError('Only administrators can create classes', 403);
    }

    const name = data.name.trim();
    if (!name) throw new AppError('Class name is required', 400);

    const existing = await prisma.class.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(`A class named "${name}" already exists`, 409);
    }

    const created = await this.createClassFromTemplate(name, data.gradeLevel);
    return { id: created.id, name: created.name, gradeLevel: created.gradeLevel };
  }

  /** Validate an explicit grade-level cell (number or numeric string), 1–12. */
  private parseGradeLevel(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
  }

  /** Derive a grade level from the leading number of a class name (e.g. "10A3" → 10). */
  private parseGradeFromName(name: string): number | null {
    const m = name.trim().match(/^(\d{1,2})/);
    if (!m) return null;
    const n = Number(m[1]);
    return n >= 1 && n <= 12 ? n : null;
  }

  private parseDayOfWeek(value: unknown): number | null {
    if (typeof value === 'number' && value >= 1 && value <= 7) return Math.trunc(value);
    const s = String(value ?? '').trim().toLowerCase();
    if (!s) return null;
    const numeric = Number(s);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 7) return numeric;
    const map: Record<string, number> = {
      mon: 1, monday: 1,
      tue: 2, tues: 2, tuesday: 2,
      wed: 3, weds: 3, wednesday: 3,
      thu: 4, thur: 4, thurs: 4, thursday: 4,
      fri: 5, friday: 5,
      sat: 6, saturday: 6,
      sun: 7, sunday: 7,
    };
    return map[s] ?? null;
  }

  private parseTimeToMinutes(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      // Excel may serialise a time as a fraction of a day.
      if (value > 0 && value < 1) return Math.round(value * 24 * 60);
      if (value >= 0 && value <= 1439) return Math.trunc(value);
      return null;
    }
    const s = String(value ?? '').trim();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  generateImportTemplate(): Buffer {
    const sample = [
      { className: '10A1', dayOfWeek: 'Mon', periodIndex: 1, startTime: '07:00', endTime: '07:45', displayName: 'Flag Ceremony', room: 'A101' },
      { className: '10A1', dayOfWeek: 'Mon', periodIndex: 2, startTime: '07:50', endTime: '08:35', displayName: 'Mathematics', room: 'A101' },
      { className: '10A3', dayOfWeek: 'Mon', periodIndex: 1, startTime: '07:00', endTime: '07:45', displayName: 'Flag Ceremony', room: 'A103' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sample);
    worksheet['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 10 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timetable');

    const instructions = [
      ['Instructions for importing class timetables'],
      [''],
      ['Column', 'Description', 'Required'],
      ['className', 'Class name, e.g. 10A1. One file may hold many classes. A class that does not exist yet is created automatically. If left blank, the row is added to the class currently selected in the app.', 'Recommended'],
      ['dayOfWeek', 'Mon–Sun or 1–7 (1 = Monday … 7 = Sunday)', 'Yes'],
      ['periodIndex', 'Period number (1–12)', 'Yes'],
      ['startTime', 'Start time HH:MM (24h), e.g. 07:00', 'Yes'],
      ['endTime', 'End time HH:MM (24h), e.g. 07:45', 'Yes'],
      ['displayName', 'Subject/activity name shown in the grid', 'Yes'],
      ['gradeLevel', 'Grade (1–12) for a NEW class. Optional — defaults to the leading number of className (10A1 → 10).', 'No'],
      ['room', 'Room label', 'No'],
      [''],
      ['Note:', 'A newly-created class copies its teacher, subject and semester from an existing class (preferring the same grade), so at least one class must already exist.'],
      ['Note:', 'Mathematics / Physics / Chemistry are auto-linked as managed subjects and used for exam-conflict checking. All other names are display-only.'],
    ];
    const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionSheet['!cols'] = [{ wch: 15 }, { wch: 90 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Instructions');

    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}

export const timetableService = new TimetableService();
