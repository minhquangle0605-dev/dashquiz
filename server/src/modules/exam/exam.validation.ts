import { z } from 'zod';

// ═══════════════════════════════════════════════
// REVIEW OPTIONS (§8) — per-window visibility matrix
// ═══════════════════════════════════════════════

const reviewWindowSchema = z
  .object({
    responses: z.boolean(),
    marks: z.boolean(),
    correctness: z.boolean(),
    correctAnswer: z.boolean(),
    generalFeedback: z.boolean(),
  })
  .partial();

const reviewOptionsSchema = z
  .object({
    duringAttempt: reviewWindowSchema,
    afterSubmit: reviewWindowSchema,
    laterOpen: reviewWindowSchema,
    afterClosed: reviewWindowSchema,
  })
  .partial();

// ═══════════════════════════════════════════════
// CREATE EXAM
// ═══════════════════════════════════════════════

const maxAttemptsSchema = z.coerce.number().int().min(1).max(99);

export const createExamSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  subjectId: z.coerce.number().int().positive('Subject is required'),
  durationMin: z.coerce.number().int().positive('Duration must be greater than 0'),
  totalQuestions: z.coerce.number().int().positive('Total questions must be greater than 0'),
  passingScore: z.coerce.number().min(0).max(10).optional().nullable(),
  shuffle: z.boolean().default(false),
  showResult: z.boolean().default(true),
  maxAttempts: maxAttemptsSchema.default(1),
  gradingMethod: z.enum(['HIGHEST', 'AVERAGE', 'FIRST', 'LAST']).default('HIGHEST'),
  shuffleAnswers: z.boolean().default(false),
  navigationMode: z.enum(['FREE', 'SEQUENTIAL']).default('FREE'),
  questionsPerPage: z.coerce.number().int().positive().max(100).optional().nullable(),
  accessPassword: z.string().max(100).optional().nullable(),
  reviewOptions: reviewOptionsSchema.optional().nullable(),
});

// ═══════════════════════════════════════════════
// UPDATE EXAM (only when status = DRAFT)
// ═══════════════════════════════════════════════

export const updateExamSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  durationMin: z.coerce.number().int().positive('Duration must be > 0').optional(),
  totalQuestions: z.coerce.number().int().positive().optional(),
  passingScore: z.coerce.number().min(0).max(10).optional().nullable(),
  shuffle: z.boolean().optional(),
  showResult: z.boolean().optional(),
  maxAttempts: maxAttemptsSchema.optional(),
  gradingMethod: z.enum(['HIGHEST', 'AVERAGE', 'FIRST', 'LAST']).optional(),
  shuffleAnswers: z.boolean().optional(),
  navigationMode: z.enum(['FREE', 'SEQUENTIAL']).optional(),
  questionsPerPage: z.coerce.number().int().positive().max(100).optional().nullable(),
  accessPassword: z.string().max(100).optional().nullable(),
  reviewOptions: reviewOptionsSchema.optional().nullable(),
});

// ═══════════════════════════════════════════════
// ADD QUESTIONS TO EXAM
// ═══════════════════════════════════════════════

export const addQuestionsSchema = z.object({
  mode: z.enum(['manual', 'random']),
  questionIds: z.array(z.coerce.number().int().positive()).optional(),
  randomConfig: z
    .object({
      subjectId: z.coerce.number().int().positive(),
      chapterIds: z.array(z.coerce.number().int().positive()).optional(),
      difficulty: z.coerce.number().int().min(1).max(5).optional(),
      count: z.coerce.number().int().positive('Count must be > 0'),
    })
    .optional(),
}).refine(
  (data) => {
    if (data.mode === 'manual') return data.questionIds && data.questionIds.length > 0;
    if (data.mode === 'random') return data.randomConfig != null;
    return false;
  },
  { message: 'manual mode requires questionIds; random mode requires randomConfig' },
);

// ═══════════════════════════════════════════════
// SCHEDULE EXAM
// ═══════════════════════════════════════════════

export const scheduleExamSchema = z
  .object({
    startTime: z.coerce.date({ message: 'Start time is required' }),
    endTime: z.coerce.date({ message: 'End time is required' }),
    // Phase 5: limit this window to a single assigned class (null = all classes).
    classId: z.coerce.number().int().positive().optional().nullable(),
    // Phase 6: room and supervising teacher.
    room: z.string().max(50).optional().nullable(),
    proctorId: z.coerce.number().int().positive().optional().nullable(),
    // Admin-only override: bypass hard timetable/exam conflicts when scheduling.
    force: z.boolean().optional(),
  })
  .refine((d) => d.endTime > d.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  });

// ═══════════════════════════════════════════════
// ASSIGN EXAM TO CLASSES
// ═══════════════════════════════════════════════

export const assignExamSchema = z.object({
  classIds: z
    .array(z.coerce.number().int().positive())
    .min(1, 'At least one class is required'),
});

// ═══════════════════════════════════════════════
// LIST EXAMS QUERY
// ═══════════════════════════════════════════════

export const listExamsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'SCHEDULED', 'CLOSED']).optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  classId: z.coerce.number().int().positive().optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const examMonitoringQuerySchema = z.object({
  classId: z.coerce.number().int().positive().optional(),
});

// ═══════════════════════════════════════════════
// MANUAL GRADING (§12)
// ═══════════════════════════════════════════════

export const gradeAnswerSchema = z.object({
  score: z.coerce.number().min(0),
  feedback: z.string().max(2000).optional().nullable(),
});

export type GradeAnswerInput = z.infer<typeof gradeAnswerSchema>;

// ═══════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
export type AddQuestionsInput = z.infer<typeof addQuestionsSchema>;
export type ScheduleExamInput = z.infer<typeof scheduleExamSchema>;
export type AssignExamInput = z.infer<typeof assignExamSchema>;
export type ListExamsQuery = z.infer<typeof listExamsQuerySchema>;
export type ExamMonitoringQuery = z.infer<typeof examMonitoringQuerySchema>;
