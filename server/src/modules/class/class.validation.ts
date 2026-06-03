import { z } from 'zod';

// ═══════════════════════════════════════════════
// CREATE CLASS
// ═══════════════════════════════════════════════

export const createClassSchema = z.object({
  name: z.string().min(1, 'Class name is required').max(20),
  gradeLevel: z.coerce.number().int().min(10, 'Grade level 10-12').max(12, 'Grade level 10-12'),
  semesterId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive('Subject is required'),
  academicYearString: z.string().optional(),
});

// ═══════════════════════════════════════════════
// UPDATE CLASS
// ═══════════════════════════════════════════════

export const updateClassSchema = z.object({
  name: z.string().min(1).max(20).optional(),
  gradeLevel: z.coerce.number().int().min(10).max(12).optional(),
  semesterId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  academicYearString: z.string().optional(),
});

// ═══════════════════════════════════════════════
// ADD STUDENTS
// ═══════════════════════════════════════════════

export const addStudentsSchema = z
  .object({
    userIds: z.array(z.coerce.number().int().positive()).optional(),
    studentIds: z.array(z.coerce.number().int().positive()).optional(),
  })
  .refine(
    (val) => (val.userIds && val.userIds.length > 0) || (val.studentIds && val.studentIds.length > 0),
    { message: 'At least one student ID is required', path: ['userIds'] },
  );

// ═══════════════════════════════════════════════
// AVAILABLE STUDENTS QUERY
// ═══════════════════════════════════════════════

export const availableStudentsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  gradeLevel: z.coerce.number().int().min(10).max(12).optional(),
  homeroomClassName: z.string().max(50).optional(),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

// ═══════════════════════════════════════════════
// LIST DISTINCT CLASS NAMES QUERY
// ═══════════════════════════════════════════════

export const listClassNamesQuerySchema = z.object({
  gradeLevel: z.coerce.number().int().min(10).max(12).optional(),
});

// ═══════════════════════════════════════════════
// LIST CLASSES QUERY
// ═══════════════════════════════════════════════

export const listClassesQuerySchema = z.object({
  semesterId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  gradeLevel: z.coerce.number().int().min(10).max(12).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// ═══════════════════════════════════════════════
// LIST STUDENTS QUERY
// ═══════════════════════════════════════════════

export const listStudentsQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const resourceTypeSchema = z.enum(['FILE', 'IMAGE', 'VIDEO', 'LINK', 'LESSON']);
const activityTypeSchema = z.enum([
  'QUIZ',
  'ASSIGNMENT',
  'FORUM',
  'WORKSHOP',
  'ATTENDANCE',
  'SURVEY',
]);
const publishStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']);
const classMemberRoleSchema = z.enum(['STUDENT', 'TA', 'NON_EDITING_TEACHER', 'TEACHER']);
const attendanceStatusSchema = z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']);

export const createSectionSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(5000).optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
  isPublished: z.coerce.boolean().optional(),
});

export const updateSectionSchema = createSectionSchema.partial();

const resourceSchemaBase = z.object({
  sectionId: z.coerce.number().int().positive().nullable().optional(),
  type: resourceTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  content: z.string().max(50000).optional(),
  url: z.string().url().max(2000).optional(),
  fileName: z.string().max(255).optional(),
  mimeType: z.string().max(120).optional(),
  fileSizeBytes: z.coerce.number().int().positive().optional(),
  isPublished: z.coerce.boolean().optional(),
  orderIndex: z.coerce.number().int().min(0).optional(),
});

export const createResourceSchema = resourceSchemaBase.superRefine((value, ctx) => {
  if ((value.type === 'LINK' || value.type === 'VIDEO') && !value.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['url'],
      message: 'URL is required for link and video resources',
    });
  }
});

export const updateResourceSchema = resourceSchemaBase.partial().superRefine((value, ctx) => {
  if ((value.type === 'LINK' || value.type === 'VIDEO') && !value.url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['url'],
      message: 'URL is required when changing to link or video resources',
    });
  }
});

export const createActivitySchema = z.object({
  sectionId: z.coerce.number().int().positive().nullable().optional(),
  gradeComponentType: z.enum(['REGULAR', 'MIDTERM', 'FINAL']).nullable().optional(),
  type: activityTypeSchema,
  title: z.string().min(1).max(200),
  instructions: z.string().max(50000).optional(),
  content: z.string().max(50000).optional(),
  status: publishStatusSchema.optional(),
  dueAt: z.coerce.date().optional(),
  maxScore: z.coerce.number().min(0).optional(),
  allowLate: z.coerce.boolean().optional(),
  showGrades: z.coerce.boolean().optional(),
  allowStudentPosts: z.coerce.boolean().optional(),
});

export const updateActivitySchema = createActivitySchema.partial();

export const submitActivitySchema = z.object({
  content: z.string().max(50000).optional(),
  fileUrl: z.string().max(2000).optional(),
  fileName: z.string().max(255).optional(),
});

export const gradeSubmissionSchema = z.object({
  score: z.coerce.number().min(0).optional(),
  feedback: z.string().max(20000).optional(),
});

export const createForumPostSchema = z.object({
  content: z.string().min(1).max(20000),
  parentId: z.coerce.number().int().positive().optional(),
});

export const recordAttendanceSchema = z.object({
  records: z.array(
    z.object({
      studentId: z.coerce.number().int().positive(),
      status: attendanceStatusSchema,
      note: z.string().max(255).optional(),
    }),
  ).min(1),
});

export const markCompletionSchema = z
  .object({
    resourceId: z.coerce.number().int().positive().optional(),
    activityId: z.coerce.number().int().positive().optional(),
  })
  .refine((val) => Boolean(val.resourceId) !== Boolean(val.activityId), {
    message: 'Provide exactly one of resourceId or activityId',
  });

export const assignClassRoleSchema = z.object({
  userId: z.coerce.number().int().positive(),
  role: classMemberRoleSchema,
});

// ═══════════════════════════════════════════════
// MOET-STYLE GRADEBOOK (Circular 22)
// ═══════════════════════════════════════════════

export const gradeComponentTypeSchema = z.enum(['REGULAR', 'MIDTERM', 'FINAL']);

export const createManualGradeSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  componentType: gradeComponentTypeSchema,
  score: z.coerce.number().min(0).max(10),
  label: z.string().max(200).optional(),
  reason: z.string().max(500).optional(),
});

export const updateGradeScoreSchema = z
  .object({
    score: z.coerce.number().min(0).max(10).optional(),
    componentType: gradeComponentTypeSchema.optional(),
    label: z.string().max(200).nullable().optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (val) =>
      val.score !== undefined ||
      val.componentType !== undefined ||
      val.label !== undefined,
    { message: 'Provide at least one field to update' },
  );

export const deleteGradeSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const linkClassSchema = z.object({
  linkedClassId: z.coerce.number().int().positive().nullable(),
});

// ═══════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type AddStudentsInput = z.infer<typeof addStudentsSchema>;
export type ListClassesQuery = z.infer<typeof listClassesQuerySchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
export type AvailableStudentsQuery = z.infer<typeof availableStudentsQuerySchema>;
export type ListClassNamesQuery = z.infer<typeof listClassNamesQuerySchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type SubmitActivityInput = z.infer<typeof submitActivitySchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
export type CreateForumPostInput = z.infer<typeof createForumPostSchema>;
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type MarkCompletionInput = z.infer<typeof markCompletionSchema>;
export type AssignClassRoleInput = z.infer<typeof assignClassRoleSchema>;
export type CreateManualGradeInput = z.infer<typeof createManualGradeSchema>;
export type UpdateGradeScoreInput = z.infer<typeof updateGradeScoreSchema>;
export type DeleteGradeInput = z.infer<typeof deleteGradeSchema>;
export type LinkClassInput = z.infer<typeof linkClassSchema>;
export type GradeComponentTypeInput = z.infer<typeof gradeComponentTypeSchema>;
