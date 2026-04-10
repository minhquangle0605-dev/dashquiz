import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { CORE_SUBJECT_CODES, isCoreSubjectCode } from '../../constants/subjects';
import type { CreateChapterInput, CreateTopicInput } from './curriculum.validation';

export class CurriculumService {
  // ═══════════════════════════════════════════════
  // SUBJECTS — public list (UC40 read-only view for teacher/student)
  // ═══════════════════════════════════════════════

  async listSubjects() {
    const subjects = await prisma.subject.findMany({
      where: { status: 1, code: { in: [...CORE_SUBJECT_CODES] } },
      include: {
        _count: { select: { chapters: true, questions: true } },
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      message: 'Subjects retrieved successfully',
      data: subjects,
    };
  }

  // ═══════════════════════════════════════════════
  // CHAPTERS BY SUBJECT
  // ═══════════════════════════════════════════════

  async getChaptersBySubject(subjectId: number) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject || !isCoreSubjectCode(subject.code)) {
      throw new AppError('Subject not found', 404);
    }

    const chapters = await prisma.chapter.findMany({
      where: { subjectId },
      include: {
        _count: { select: { topics: true, questions: true } },
      },
      orderBy: { orderIndex: 'asc' },
    });

    return {
      success: true,
      message: 'Chapters retrieved successfully',
      data: {
        subject: { id: subject.id, name: subject.name, code: subject.code },
        chapters,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // TOPICS BY CHAPTER
  // ═══════════════════════════════════════════════

  async getTopicsByChapter(chapterId: number) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    });
    if (!chapter) {
      throw new AppError('Chapter not found', 404);
    }

    const topics = await prisma.topic.findMany({
      where: { chapterId },
      include: {
        _count: { select: { questions: true, fromRelations: true, toRelations: true } },
      },
      orderBy: { id: 'asc' },
    });

    return {
      success: true,
      message: 'Topics retrieved successfully',
      data: {
        chapter: {
          id: chapter.id,
          name: chapter.name,
          subject: chapter.subject,
        },
        topics,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // CREATE CHAPTER (teacher)
  // ═══════════════════════════════════════════════

  async createChapter(data: CreateChapterInput) {
    const subject = await prisma.subject.findUnique({ where: { id: data.subjectId } });
    if (!subject || !isCoreSubjectCode(subject.code)) {
      throw new AppError('Subject not found', 404);
    }

    const existing = await prisma.chapter.findFirst({
      where: { subjectId: data.subjectId, name: data.name },
    });
    if (existing) {
      throw new AppError(`Chapter "${data.name}" already exists in this subject`, 409);
    }

    const chapter = await prisma.chapter.create({
      data: {
        subjectId: data.subjectId,
        name: data.name,
        orderIndex: data.orderIndex,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { topics: true, questions: true } },
      },
    });

    return {
      success: true,
      message: 'Chapter created successfully',
      data: chapter,
    };
  }

  // ═══════════════════════════════════════════════
  // CREATE TOPIC (teacher)
  // ═══════════════════════════════════════════════

  async createTopic(data: CreateTopicInput) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: data.chapterId },
      include: { subject: { select: { id: true, name: true } } },
    });
    if (!chapter) {
      throw new AppError('Chapter not found', 404);
    }

    const existing = await prisma.topic.findFirst({
      where: { chapterId: data.chapterId, name: data.name },
    });
    if (existing) {
      throw new AppError(`Topic "${data.name}" already exists in this chapter`, 409);
    }

    const topic = await prisma.topic.create({
      data: {
        chapterId: data.chapterId,
        name: data.name,
        description: data.description ?? null,
      },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return {
      success: true,
      message: 'Topic created successfully',
      data: topic,
    };
  }

  // ═══════════════════════════════════════════════
  // TOPIC RELATIONS — Knowledge Graph edges (UC14)
  // ═══════════════════════════════════════════════

  async getTopicRelations(topicId: number) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        chapter: {
          select: {
            id: true,
            name: true,
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!topic) {
      throw new AppError('Topic not found', 404);
    }

    const [outgoing, incoming] = await Promise.all([
      prisma.topicRelation.findMany({
        where: { fromTopicId: topicId },
        include: {
          toTopic: {
            select: {
              id: true,
              name: true,
              chapter: {
                select: {
                  id: true,
                  name: true,
                  subject: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.topicRelation.findMany({
        where: { toTopicId: topicId },
        include: {
          fromTopic: {
            select: {
              id: true,
              name: true,
              chapter: {
                select: {
                  id: true,
                  name: true,
                  subject: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const relations = [
      ...outgoing.map((r) => ({
        id: r.id,
        direction: 'outgoing' as const,
        relationType: r.relationType,
        relatedTopic: r.toTopic,
      })),
      ...incoming.map((r) => ({
        id: r.id,
        direction: 'incoming' as const,
        relationType: r.relationType,
        relatedTopic: r.fromTopic,
      })),
    ];

    return {
      success: true,
      message: 'Topic relations retrieved successfully',
      data: {
        topic: {
          id: topic.id,
          name: topic.name,
          chapter: topic.chapter,
        },
        relations,
        totalRelations: relations.length,
      },
    };
  }
}

export const curriculumService = new CurriculumService();
