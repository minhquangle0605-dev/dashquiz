import { prismaMock } from '../mocks/prisma';
import { timetableService } from '../../modules/timetable/timetable.service';

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
