import type { Request, Response, NextFunction } from 'express';
import { classService } from './class.service';
import { AppError } from '../../middlewares/errorHandler';
import type { ListClassesQuery, ListStudentsQuery } from './class.validation';

// ═══════════════════════════════════════════════
// LIST CLASSES (GET /api/classes)
// ═══════════════════════════════════════════════

export async function listClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const query = req.query as unknown as ListClassesQuery;
    const result = await classService.listClasses(query, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// CREATE CLASS (POST /api/classes)
// ═══════════════════════════════════════════════

export async function createClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const result = await classService.createClass(req.body, req.user.id);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// UPDATE CLASS (PUT /api/classes/:id)
// ═══════════════════════════════════════════════

export async function updateClass(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid class ID', 400);
    const result = await classService.updateClass(id, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// LIST STUDENTS (GET /api/classes/:id/students)
// ═══════════════════════════════════════════════

export async function listStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid class ID', 400);
    const query = req.query as unknown as ListStudentsQuery;
    const result = await classService.listStudents(id, query);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// ADD STUDENTS (POST /api/classes/:id/students)
// ═══════════════════════════════════════════════

export async function addStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid class ID', 400);
    const result = await classService.addStudents(id, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// REMOVE STUDENT (DELETE /api/classes/:id/students/:studentId)
// ═══════════════════════════════════════════════

export async function removeStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(id) || isNaN(studentId)) throw new AppError('Invalid ID parameter', 400);
    const result = await classService.removeStudent(id, studentId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// IMPORT STUDENTS FROM EXCEL (POST /api/classes/:id/students/import)
// ═══════════════════════════════════════════════

export async function importStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (!req.file) throw new AppError('Excel file is required', 400);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid class ID', 400);

    const result = await classService.importStudentsFromExcel(
      id,
      req.file.buffer,
      req.user.id,
      req.user.role,
    );
    res.status(result.success ? 201 : 200).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// DOWNLOAD IMPORT TEMPLATE (GET /api/classes/import-template)
// ═══════════════════════════════════════════════

export async function downloadImportTemplate(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const buffer = classService.generateImportTemplate();
    res.setHeader('Content-Disposition', 'attachment; filename=student_import_template.xlsx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}
