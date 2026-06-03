import * as XLSX from 'xlsx';
import { prismaMock } from '../mocks/prisma';
import { timetableService } from '../../modules/timetable/timetable.service';

/** Build an in-memory .xlsx buffer from row objects, mirroring the import format. */
function buildWorkbook(rows: Record<string, unknown>[]): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Timetable');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

// 2024-01-01 is a Monday, 2024-01-07 is a Sunday. Times below are chosen so the
// VN wall-clock (UTC+7) lands inside the morning school window unless noted.
const MON_1045_UTC = new Date('2024-01-01T03:45:00Z'); // Mon 10:45 VN
const MON_1110_UTC = new Date('2024-01-01T04:10:00Z'); // Mon 11:10 VN
const MON_1130_UTC = new Date('2024-01-01T04:30:00Z'); // Mon 11:30 VN (after 11:15)
const MON_1155_UTC = new Date('2024-01-01T04:55:00Z'); // Mon 11:55 VN
const SUN_1000_UTC = new Date('2024-01-07T03:00:00Z'); // Sun 10:00 VN
const SUN_1030_UTC = new Date('2024-01-07T03:30:00Z'); // Sun 10:30 VN

function mockSlots(rows: unknown[]) {
  prismaMock.classTimetableSlot.findMany.mockResolvedValue(rows);
}
function mockExamSchedules(rows: unknown[]) {
  prismaMock.examSchedule.findMany.mockResolvedValue(rows);
}

describe('timetableService.checkExamScheduleConflicts', () => {
  beforeEach(() => {
    mockSlots([]);
    mockExamSchedules([]);
  });

  it('blocks (hard) when overlapping a managed Math/Physics/Chemistry timetable slot', async () => {
    mockSlots([
      {
        kind: 'MANAGED_SUBJECT',
        class: { id: 1, name: '10A1' },
        subject: { id: 2, name: 'Physics', code: 'PHY' },
        displayName: 'Physics',
        periodIndex: 5,
        startMinute: 630,
        endMinute: 675,
      },
    ]);

    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [1],
      subjectId: 1,
      startTime: MON_1045_UTC,
      endTime: MON_1110_UTC,
    });

    expect(result.hardConflicts).toHaveLength(1);
    expect(result.hardConflicts[0].type).toBe('MANAGED_TIMETABLE_SLOT');
    expect(result.softWarnings).toHaveLength(0);
    expect(result.hasConflict).toBe(true);
  });

  it('only warns (soft) when overlapping a display-only subject like Literature', async () => {
    mockSlots([
      {
        kind: 'DISPLAY_ONLY',
        class: { id: 1, name: '10A1' },
        subject: null,
        displayName: 'Literature',
        periodIndex: 3,
        startMinute: 520,
        endMinute: 565,
      },
    ]);

    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [1],
      subjectId: 1,
      startTime: new Date('2024-01-01T01:55:00Z'), // Mon 08:55 VN
      endTime: new Date('2024-01-01T02:20:00Z'), // Mon 09:20 VN
    });

    expect(result.hardConflicts).toHaveLength(0);
    expect(result.softWarnings.some((w) => w.type === 'DISPLAY_TIMETABLE_SLOT')).toBe(true);
  });

  it('blocks (hard) when overlapping another managed exam of the same class', async () => {
    mockExamSchedules([
      {
        startTime: MON_1045_UTC,
        endTime: MON_1110_UTC,
        exam: {
          id: 9,
          title: 'Chemistry Test 1',
          subject: { id: 3, name: 'Chemistry', code: 'CHEM' },
          examAssignments: [{ class: { id: 2, name: '10A2' } }],
        },
      },
    ]);

    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [2],
      subjectId: 2,
      startTime: MON_1045_UTC,
      endTime: MON_1110_UTC,
      excludeExamId: 12,
    });

    expect(result.hardConflicts).toHaveLength(1);
    expect(result.hardConflicts[0].type).toBe('MANAGED_EXAM');
  });

  it('warns (soft) when scheduling on a Sunday', async () => {
    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [1],
      subjectId: 1,
      startTime: SUN_1000_UTC,
      endTime: SUN_1030_UTC,
    });

    expect(result.hardConflicts).toHaveLength(0);
    expect(result.softWarnings.some((w) => w.type === 'WEEKEND')).toBe(true);
  });

  it('warns (soft) when scheduling outside the morning school window', async () => {
    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [1],
      subjectId: 1,
      startTime: MON_1130_UTC,
      endTime: MON_1155_UTC,
    });

    expect(result.hardConflicts).toHaveLength(0);
    expect(result.softWarnings.some((w) => w.type === 'OUTSIDE_SCHOOL_HOURS')).toBe(true);
  });

  it('reports no conflict for an in-hours weekday slot with a clear timetable', async () => {
    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [1],
      subjectId: 1,
      startTime: MON_1045_UTC,
      endTime: MON_1110_UTC,
    });

    expect(result.hasConflict).toBe(false);
    expect(result.hardConflicts).toHaveLength(0);
    expect(result.softWarnings).toHaveLength(0);
  });

  it('returns no conflict when no classes are provided', async () => {
    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [],
      subjectId: 1,
      startTime: MON_1130_UTC, // outside hours, but skipped because classIds is empty
      endTime: MON_1155_UTC,
    });

    expect(result.hasConflict).toBe(false);
  });

  it('warns (soft) when the class already has the max managed tests that day', async () => {
    // First findMany call = time-overlap query (none); second = same-day count (two exams).
    prismaMock.examSchedule.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ examId: 1 }, { examId: 2 }]);

    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [1],
      subjectId: 1,
      startTime: MON_1045_UTC,
      endTime: MON_1110_UTC,
    });

    expect(result.hardConflicts).toHaveLength(0);
    expect(result.softWarnings.some((w) => w.type === 'MAX_TESTS_PER_DAY')).toBe(true);
  });

  it('warns (soft) when the room is double-booked', async () => {
    prismaMock.examSchedule.findFirst.mockResolvedValueOnce({ id: 99 });

    const result = await timetableService.checkExamScheduleConflicts({
      classIds: [1],
      subjectId: 1,
      startTime: MON_1045_UTC,
      endTime: MON_1110_UTC,
      room: 'A101',
    });

    expect(result.hardConflicts).toHaveLength(0);
    expect(result.softWarnings.some((w) => w.type === 'ROOM_DOUBLE_BOOKED')).toBe(true);
  });
});

describe('timetableService.clearClassTimetable', () => {
  const CLASS = { id: 1, name: '10A1', gradeLevel: 10, teacherId: 5, semesterId: 2 };

  it('hard-deletes every slot for the class (admin)', async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS);
    prismaMock.classTimetableSlot.deleteMany.mockResolvedValue({ count: 7 });

    const result = await timetableService.clearClassTimetable(1, { id: 99, role: 'admin' });

    expect(prismaMock.classTimetableSlot.deleteMany).toHaveBeenCalledWith({ where: { classId: 1 } });
    expect(result.success).toBe(true);
    expect(result.data.deleted).toBe(7);
  });

  it('rejects a teacher — even the owning one — and never deletes (admin-only)', async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS);

    await expect(
      timetableService.clearClassTimetable(1, { id: 5, role: 'teacher' }),
    ).rejects.toThrow('Only administrators can manage the class timetable');
    expect(prismaMock.classTimetableSlot.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a student (403) and never deletes', async () => {
    prismaMock.class.findUnique.mockResolvedValue(CLASS);

    await expect(
      timetableService.clearClassTimetable(1, { id: 42, role: 'student' }),
    ).rejects.toThrow('Only administrators can manage the class timetable');
    expect(prismaMock.classTimetableSlot.deleteMany).not.toHaveBeenCalled();
  });
});

describe('timetableService.importTimetable', () => {
  const ADMIN = { id: 99, role: 'admin' };
  // The default/selected class the file is uploaded against.
  const DEFAULT_CLASS = { id: 1, name: '10A1', gradeLevel: 10, teacherId: 5, semesterId: 2 };

  beforeEach(() => {
    prismaMock.class.findUnique.mockResolvedValue(DEFAULT_CLASS);
    // Every displayName resolves as display-only (no managed-subject match) to keep tests focused.
    prismaMock.subject.findFirst.mockResolvedValue(null);
    prismaMock.classTimetableSlot.findFirst.mockResolvedValue(null);
    prismaMock.classTimetableSlot.create.mockResolvedValue({});
    prismaMock.classTimetableSlot.update.mockResolvedValue({});
  });

  it('creates an unknown className by copying teacher/subject/semester from a same-grade class', async () => {
    // class.findFirst is used for: (1) lookup by name, (2) template by gradeLevel.
    prismaMock.class.findFirst.mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (where.name) return Promise.resolve(null); // 10A3 does not exist yet
      if (where.gradeLevel === 10) {
        return Promise.resolve({ teacherId: 5, subjectId: 7, semesterId: 2 });
      }
      return Promise.resolve(null);
    });
    prismaMock.class.create.mockResolvedValue({ id: 42, semesterId: 2 });

    const buffer = buildWorkbook([
      { className: '10A3', dayOfWeek: 'Mon', periodIndex: 1, startTime: '07:00', endTime: '07:45', displayName: 'Flag Ceremony', room: 'A103' },
    ]);

    const result = await timetableService.importTimetable(1, buffer, ADMIN);

    expect(prismaMock.class.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: '10A3', gradeLevel: 10, semesterId: 2, teacherId: 5, subjectId: 7 },
      }),
    );
    // The new class id (not the default class) receives the slot.
    expect(prismaMock.classTimetableSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ classId: 42 }) }),
    );
    expect(result.data.imported).toBe(1);
    expect(result.data.createdClasses).toBe(1);
    expect(result.data.createdClassNames).toEqual(['10A3']);
  });

  it('routes a row without a className to the selected class and creates no class', async () => {
    const buffer = buildWorkbook([
      { dayOfWeek: 'Mon', periodIndex: 2, startTime: '07:50', endTime: '08:35', displayName: 'Mathematics', room: 'A101' },
    ]);

    const result = await timetableService.importTimetable(1, buffer, ADMIN);

    expect(prismaMock.class.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.class.create).not.toHaveBeenCalled();
    expect(prismaMock.classTimetableSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ classId: 1 }) }),
    );
    expect(result.data.createdClasses).toBe(0);
    expect(result.data.imported).toBe(1);
  });

  it('reuses an existing class matched by name (case-insensitive) without creating', async () => {
    prismaMock.class.findFirst.mockResolvedValue({ id: 2, semesterId: 2 }); // 10a2 → existing 10A2

    const buffer = buildWorkbook([
      { className: '10a2', dayOfWeek: 'Tue', periodIndex: 3, startTime: '08:50', endTime: '09:35', displayName: 'History' },
    ]);

    const result = await timetableService.importTimetable(1, buffer, ADMIN);

    expect(prismaMock.class.create).not.toHaveBeenCalled();
    expect(prismaMock.classTimetableSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ classId: 2 }) }),
    );
    expect(result.data.createdClasses).toBe(0);
  });

  it('skips a row when a new class has no derivable grade level', async () => {
    prismaMock.class.findFirst.mockResolvedValue(null); // name lookup misses; "FooBar" → no grade

    const buffer = buildWorkbook([
      { className: 'FooBar', dayOfWeek: 'Mon', periodIndex: 1, startTime: '07:00', endTime: '07:45', displayName: 'Flag Ceremony' },
    ]);

    const result = await timetableService.importTimetable(1, buffer, ADMIN);

    expect(prismaMock.class.create).not.toHaveBeenCalled();
    expect(result.data.failed).toBe(1);
    expect(result.data.imported).toBe(0);
    expect(result.data.errors?.[0].message).toMatch(/grade level unknown/i);
  });
});
