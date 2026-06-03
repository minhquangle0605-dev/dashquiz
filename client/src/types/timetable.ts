export type TimetableSlotKind = 'MANAGED_SUBJECT' | 'DISPLAY_ONLY';
export type TimetableSlotStatus = 'ACTIVE' | 'CANCELLED';

export interface TimetableSlot {
  id: number;
  classId: number;
  subjectId: number | null;
  displayName: string;
  kind: TimetableSlotKind;
  status: TimetableSlotStatus;
  dayOfWeek: number; // 1 = Mon … 7 = Sun
  periodIndex: number;
  startMinute: number; // minute-of-day, VN local
  endMinute: number;
  room: string | null;
  note: string | null;
  subject?: { id: number; name: string; code: string } | null;
}

export interface ClassTimetable {
  class: { id: number; name: string; gradeLevel: number };
  slots: TimetableSlot[];
}

/**
 * Payload for creating a class from the timetable screen — name + grade only.
 * Subject/semester/teacher are inherited from an existing class server-side.
 * This is intentionally lighter than the Classes-page CreateClassPayload.
 */
export interface CreateTimetableClassPayload {
  name: string;
  gradeLevel: number;
}

export interface CreateSlotPayload {
  displayName: string;
  subjectId?: number | null;
  dayOfWeek: number;
  periodIndex: number;
  startMinute: number;
  endMinute: number;
  room?: string | null;
  note?: string | null;
}

export type UpdateSlotPayload = Partial<CreateSlotPayload> & {
  status?: TimetableSlotStatus;
};

export type ConflictType =
  | 'MANAGED_TIMETABLE_SLOT'
  | 'MANAGED_EXAM'
  | 'DISPLAY_TIMETABLE_SLOT'
  | 'OUTSIDE_SCHOOL_HOURS'
  | 'WEEKEND';

export interface ConflictItem {
  type: ConflictType;
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

export interface CheckConflictsPayload {
  classIds: number[];
  subjectId?: number | null;
  startTime: string;
  endTime: string;
  excludeExamId?: number | null;
  room?: string | null;
  proctorId?: number | null;
}

export interface ImportTimetableResult {
  imported: number;
  updated: number;
  /** Number of classes auto-created from the file's className column. */
  createdClasses: number;
  /** Names of the classes created during the import. */
  createdClassNames: string[];
  failed: number;
  total: number;
  errors: { row: number; message: string }[] | null;
}
