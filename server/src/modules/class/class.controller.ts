import type { Request, Response, NextFunction } from 'express';
import { classService } from './class.service';
import { classCourseService } from './class.course.service';
import { AppError } from '../../middlewares/errorHandler';
import type {
  ListClassesQuery,
  ListStudentsQuery,
  AvailableStudentsQuery,
  ListClassNamesQuery,
} from './class.validation';

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
// LIST MY ENROLLED CLASSES (GET /api/classes/my)
// ═══════════════════════════════════════════════

export async function listMyClasses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const result = await classService.listMyEnrolledClasses(req.user.id);
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
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid class ID', 400);
    const query = req.query as unknown as ListStudentsQuery;
    const result = await classService.listStudents(id, query, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getCourse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid class ID', 400);
    const result = await classCourseService.getCourse(id, req.user.id, req.user.role);
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
// LIST AVAILABLE STUDENTS (GET /api/classes/:id/available-students)
// ═══════════════════════════════════════════════

export async function listAvailableStudents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) throw new AppError('Invalid class ID', 400);
    const query = req.query as unknown as AvailableStudentsQuery;
    const result = await classService.listAvailableStudents(id, query, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

// ═══════════════════════════════════════════════
// LIST DISTINCT CLASS NAMES (GET /api/classes/class-names)
// ═══════════════════════════════════════════════

export async function listClassNames(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const query = req.query as unknown as ListClassNamesQuery;
    const result = await classService.listDistinctClassNames(query.gradeLevel);
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

export async function createSection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const result = await classCourseService.createSection(classId, req.body, req.user.id, req.user.role);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateSection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    const sectionId = parseInt(req.params.sectionId, 10);
    if (isNaN(classId) || isNaN(sectionId)) throw new AppError('Invalid ID parameter', 400);
    const result = await classCourseService.updateSection(classId, sectionId, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteSection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    const sectionId = parseInt(req.params.sectionId, 10);
    if (isNaN(classId) || isNaN(sectionId)) throw new AppError('Invalid ID parameter', 400);
    const result = await classCourseService.deleteSection(classId, sectionId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createResource(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const result = await classCourseService.createResource(classId, req.body, req.user.id, req.user.role);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function uploadResource(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (!req.file) throw new AppError('Resource file is required', 400);
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const result = await classCourseService.uploadResourceFile(
      classId,
      {
        ...req.body,
        sectionId: req.body.sectionId ? Number(req.body.sectionId) : undefined,
        orderIndex: req.body.orderIndex ? Number(req.body.orderIndex) : undefined,
        isPublished: req.body.isPublished === undefined ? undefined : req.body.isPublished === 'true',
      },
      req.file,
      req.user.id,
      req.user.role,
    );
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateResource(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    const resourceId = parseInt(req.params.resourceId, 10);
    if (isNaN(classId) || isNaN(resourceId)) throw new AppError('Invalid ID parameter', 400);
    const result = await classCourseService.updateResource(classId, resourceId, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteResource(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    const resourceId = parseInt(req.params.resourceId, 10);
    if (isNaN(classId) || isNaN(resourceId)) throw new AppError('Invalid ID parameter', 400);
    const result = await classCourseService.deleteResource(classId, resourceId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function getResourceDownloadUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const resourceId = parseInt(req.params.resourceId, 10);
    if (isNaN(resourceId)) throw new AppError('Invalid resource ID', 400);
    const result = await classCourseService.getResourceDownloadUrl(resourceId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const result = await classCourseService.createActivity(classId, req.body, req.user.id, req.user.role);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function updateActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    const activityId = parseInt(req.params.activityId, 10);
    if (isNaN(classId) || isNaN(activityId)) throw new AppError('Invalid ID parameter', 400);
    const result = await classCourseService.updateActivity(classId, activityId, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function deleteActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    const activityId = parseInt(req.params.activityId, 10);
    if (isNaN(classId) || isNaN(activityId)) throw new AppError('Invalid ID parameter', 400);
    const result = await classCourseService.deleteActivity(classId, activityId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function submitActivity(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const activityId = parseInt(req.params.activityId, 10);
    if (isNaN(activityId)) throw new AppError('Invalid activity ID', 400);
    const result = await classCourseService.submitActivity(activityId, req.body, req.user.id, req.user.role);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const activityId = parseInt(req.params.activityId, 10);
    if (isNaN(activityId)) throw new AppError('Invalid activity ID', 400);
    const result = await classCourseService.listSubmissions(activityId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function gradeSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const submissionId = parseInt(req.params.submissionId, 10);
    if (isNaN(submissionId)) throw new AppError('Invalid submission ID', 400);
    const result = await classCourseService.gradeSubmission(submissionId, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listForumPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const activityId = parseInt(req.params.activityId, 10);
    if (isNaN(activityId)) throw new AppError('Invalid activity ID', 400);
    const result = await classCourseService.listForumPosts(activityId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function createForumPost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const activityId = parseInt(req.params.activityId, 10);
    if (isNaN(activityId)) throw new AppError('Invalid activity ID', 400);
    const result = await classCourseService.createForumPost(activityId, req.body, req.user.id, req.user.role);
    res.status(201).json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function recordAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const activityId = parseInt(req.params.activityId, 10);
    if (isNaN(activityId)) throw new AppError('Invalid activity ID', 400);
    const result = await classCourseService.recordAttendance(activityId, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function markCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const result = await classCourseService.markCompletion(classId, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function assignClassRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const result = await classCourseService.assignRole(classId, req.body, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

export async function listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const classId = parseInt(req.params.id, 10);
    if (isNaN(classId)) throw new AppError('Invalid class ID', 400);
    const result = await classCourseService.listLogs(classId, req.user.id, req.user.role);
    res.json(result);
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unexpected error'));
  }
}

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
