import { z } from 'zod';

export const listStudentExamsQuerySchema = z.object({
  filter: z.enum(['upcoming', 'in_progress', 'completed', 'all']).default('all'),
  subjectId: z.coerce.number().int().positive().optional(),
  classId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const startExamSchema = z
  .object({ password: z.string().max(100).optional() })
  .optional();

export const studentPrecheckSchema = z
  .object({
    deviceId: z.string().trim().max(191).optional(),
    userAgent: z.string().max(512).optional(),
    supportsFullscreen: z.boolean().optional(),
    cameraPermission: z.enum(['granted', 'denied', 'prompt', 'unknown']).optional(),
    screenSize: z.string().max(40).optional(),
    timezoneOffsetMin: z.coerce.number().int().min(-1440).max(1440).optional(),
  })
  .optional();

const answerValueSchema = z.union([
  z.number().int().positive(),
  z.array(z.number().int().positive()),
  z.string(),
  z.record(z.string(), z.string()),
  z.null(),
]);

export const saveAnswersSchema = z.object({
  answers: z.record(
    z.string().regex(/^\d+$/, 'Question ID must be numeric'),
    answerValueSchema,
  ),
});

export const submitAttemptSchema = z.object({
  answers: z
    .record(
      z.string().regex(/^\d+$/, 'Question ID must be numeric'),
      answerValueSchema,
    )
    .optional(),
});

export const attemptEventSchema = z.object({
  type: z.enum([
    'HEARTBEAT',
    'TAB_HIDDEN',
    'WINDOW_BLUR',
    'FULLSCREEN_EXITED',
    'FULLSCREEN_RESTORED',
    'COPY',
    'PASTE',
    'CUT',
    'CONTEXT_MENU',
    'SHORTCUT_BLOCKED',
    'OFFLINE',
    'ONLINE',
    'CAMERA_PERMISSION_MISSING',
    'DEVICE_CHANGED',
  ]),
  clientElapsedSec: z.coerce.number().int().min(0).optional(),
  questionId: z.coerce.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const attemptEventsBatchSchema = z.object({
  events: z.array(attemptEventSchema).min(1).max(50),
});

export const securitySessionSchema = z.object({
  deviceId: z.string().trim().min(8).max(191),
  userAgent: z.string().max(512).optional(),
  fullscreenState: z.boolean().optional(),
  cameraPermission: z.string().max(30).optional().nullable(),
  screenSize: z.string().max(40).optional().nullable(),
});

export const securityHeartbeatSchema = z.object({
  deviceId: z.string().trim().max(191).optional(),
  fullscreenState: z.boolean().optional(),
  focusState: z.boolean().optional(),
  cameraPermission: z.string().max(30).optional().nullable(),
  screenSize: z.string().max(40).optional().nullable(),
  answeredCount: z.coerce.number().int().min(0).optional(),
  unansweredCount: z.coerce.number().int().min(0).optional(),
  timeRemainingSec: z.coerce.number().int().min(0).optional(),
  currentQuestionId: z.coerce.number().int().positive().optional().nullable(),
});

export const listAttemptsQuerySchema = z.object({
  examId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type ListStudentExamsQuery = z.infer<typeof listStudentExamsQuerySchema>;
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type StudentPrecheckInput = z.infer<typeof studentPrecheckSchema>;
export type AttemptEventInput = z.infer<typeof attemptEventSchema>;
export type AttemptEventsBatchInput = z.infer<typeof attemptEventsBatchSchema>;
export type SecuritySessionInput = z.infer<typeof securitySessionSchema>;
export type SecurityHeartbeatInput = z.infer<typeof securityHeartbeatSchema>;
export type ListAttemptsQuery = z.infer<typeof listAttemptsQuerySchema>;
