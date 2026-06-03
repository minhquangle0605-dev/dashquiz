import type { Request, Response, NextFunction } from 'express';
import { timetableService } from './timetable.service';
import { AppError } from '../../middlewares/errorHandler';
import type { CheckConflictsInput } from './timetable.validation';

function requireUser(req: Request) {
  if (!req.user) throw new AppError('Authentication required', 401);
  return { id: req.user.id, role: req.user.role };
}

function parseId(value: string, label: string): number {
  const id = parseInt(value, 10);
  if (isNaN(id)) throw new AppError(`Invalid ${label}`, 400);
  return id;
}

// ═══════════════════════════════════════════════
// GET /api/timetable/classes/:classId
// ═══════════════════════════════════════════════

export async function getClassTimetable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const classId = parseId(req.params.classId, 'class ID');
    const result = await timetableService.getClassTimetable(classId, user);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// POST /api/timetable/classes  (create class: name + grade only)
// ═══════════════════════════════════════════════

export async function createClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const result = await timetableService.createClass(req.body, user);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// POST /api/timetable/classes/:classId/slots
// ═══════════════════════════════════════════════

export async function createSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const classId = parseId(req.params.classId, 'class ID');
    const result = await timetableService.createSlot(classId, req.body, user);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// PUT /api/timetable/classes/:classId/slots/:slotId
// ═══════════════════════════════════════════════

export async function updateSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const classId = parseId(req.params.classId, 'class ID');
    const slotId = parseId(req.params.slotId, 'slot ID');
    const result = await timetableService.updateSlot(classId, slotId, req.body, user);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// DELETE /api/timetable/classes/:classId/slots/:slotId (status → CANCELLED)
// ═══════════════════════════════════════════════

export async function cancelSlot(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const classId = parseId(req.params.classId, 'class ID');
    const slotId = parseId(req.params.slotId, 'slot ID');
    const result = await timetableService.cancelSlot(classId, slotId, user);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// DELETE /api/timetable/classes/:classId (clear all slots)
// ═══════════════════════════════════════════════

export async function clearTimetable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const classId = parseId(req.params.classId, 'class ID');
    const result = await timetableService.clearClassTimetable(classId, user);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// POST /api/timetable/check-conflicts
// ═══════════════════════════════════════════════

export async function checkConflicts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const body = req.body as CheckConflictsInput;
    const result = await timetableService.checkConflicts(
      {
        classIds: body.classIds,
        subjectId: body.subjectId ?? null,
        startTime: body.startTime,
        endTime: body.endTime,
        excludeExamId: body.excludeExamId ?? null,
        room: body.room ?? null,
        proctorId: body.proctorId ?? null,
      },
      user,
    );
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// POST /api/timetable/classes/:classId/import
// ═══════════════════════════════════════════════

export async function importTimetable(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req);
    const classId = parseId(req.params.classId, 'class ID');
    if (!req.file) throw new AppError('Excel file is required', 400);
    const result = await timetableService.importTimetable(classId, req.file.buffer, user);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// GET /api/timetable/import-template
// ═══════════════════════════════════════════════

export async function downloadImportTemplate(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const buffer = timetableService.generateImportTemplate();
    res.setHeader('Content-Disposition', 'attachment; filename=timetable_import_template.xlsx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
