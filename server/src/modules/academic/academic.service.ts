import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import type {
  CreateSubjectInput,
  UpdateSubjectInput,
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
  ListSemestersQuery,
} from './academic.validation';

export class AcademicService {
  // ═══════════════════════════════════════════════
  // SUBJECTS (UC40)
  // ═══════════════════════════════════════════════

  async listSubjects() {
    const subjects = await prisma.subject.findMany({
      include: {
        _count: { select: { chapters: true, questions: true, exams: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      message: 'Subjects retrieved successfully',
      data: subjects,
    };
  }

  async createSubject(data: CreateSubjectInput) {
    const existing = await prisma.subject.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new AppError(`Subject code "${data.code}" already exists`, 409);
    }

    const subject = await prisma.subject.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        description: data.description ?? null,
      },
    });

    return {
      success: true,
      message: 'Subject created successfully',
      data: subject,
    };
  }

  async updateSubject(id: number, data: UpdateSubjectInput) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new AppError('Subject not found', 404);
    }

    if (data.code && data.code !== subject.code) {
      const existing = await prisma.subject.findUnique({ where: { code: data.code } });
      if (existing) {
        throw new AppError(`Subject code "${data.code}" already exists`, 409);
      }
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.code !== undefined && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });

    return {
      success: true,
      message: 'Subject updated successfully',
      data: updated,
    };
  }

  // ═══════════════════════════════════════════════
  // ACADEMIC YEARS & SEMESTERS (UC41)
  // ═══════════════════════════════════════════════

  async listAcademicYears() {
    const years = await prisma.academicYear.findMany({
      include: {
        semesters: { orderBy: { startDate: 'asc' } },
      },
      orderBy: { startDate: 'desc' },
    });

    return {
      success: true,
      message: 'Academic years retrieved successfully',
      data: years,
    };
  }

  async createAcademicYear(data: CreateAcademicYearInput) {
    if (data.isCurrent) {
      await prisma.academicYear.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const midDate = new Date(
      (data.startDate.getTime() + data.endDate.getTime()) / 2,
    );

    const year = await prisma.academicYear.create({
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        isCurrent: data.isCurrent ?? false,
        semesters: {
          create: [
            {
              name: 'Học kỳ 1',
              startDate: data.startDate,
              endDate: midDate,
            },
            {
              name: 'Học kỳ 2',
              startDate: midDate,
              endDate: data.endDate,
            },
          ],
        },
      },
      include: { semesters: true },
    });

    return {
      success: true,
      message: 'Academic year created with 2 semesters',
      data: year,
    };
  }

  async updateAcademicYear(id: number, data: UpdateAcademicYearInput) {
    const year = await prisma.academicYear.findUnique({ where: { id } });
    if (!year) {
      throw new AppError('Academic year not found', 404);
    }

    if (data.isCurrent === true) {
      await prisma.academicYear.updateMany({
        where: { isCurrent: true, id: { not: id } },
        data: { isCurrent: false },
      });
    }

    const updated = await prisma.academicYear.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.isCurrent !== undefined && { isCurrent: data.isCurrent }),
      },
      include: { semesters: true },
    });

    return {
      success: true,
      message: 'Academic year updated successfully',
      data: updated,
    };
  }

  async listSemesters(query: ListSemestersQuery) {
    const where = query.academicYearId
      ? { academicYearId: query.academicYearId }
      : {};

    const semesters = await prisma.semester.findMany({
      where,
      include: {
        academicYear: { select: { id: true, name: true, isCurrent: true } },
        _count: { select: { classes: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return {
      success: true,
      message: 'Semesters retrieved successfully',
      data: semesters,
    };
  }
}

export const academicService = new AcademicService();
