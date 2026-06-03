import type { ExamStatus } from '@/utils/constants';

export type GradingMethod = 'HIGHEST' | 'AVERAGE' | 'FIRST' | 'LAST';

export const GRADING_METHOD_LABELS: Record<GradingMethod, string> = {
  HIGHEST: 'Highest score',
  AVERAGE: 'Average score',
  FIRST: 'First attempt',
  LAST: 'Latest attempt',
};

export type NavigationMode = 'FREE' | 'SEQUENTIAL';

/* ── Review options (§8) ────────────────────────────── */

export type ReviewWindowName = 'duringAttempt' | 'afterSubmit' | 'laterOpen' | 'afterClosed';

export interface ReviewWindowFlags {
  responses: boolean;
  marks: boolean;
  correctness: boolean;
  correctAnswer: boolean;
  generalFeedback: boolean;
}

export type ReviewOptions = Record<ReviewWindowName, ReviewWindowFlags>;

export const REVIEW_ROW_LABELS: { key: keyof ReviewWindowFlags; label: string }[] = [
  { key: 'responses', label: 'Student responses' },
  { key: 'marks', label: 'Marks' },
  { key: 'correctness', label: 'Correct / incorrect per question' },
  { key: 'correctAnswer', label: 'Correct answer' },
  { key: 'generalFeedback', label: 'Question explanation' },
];

export const REVIEW_WINDOW_LABELS: { key: ReviewWindowName; label: string }[] = [
  { key: 'afterSubmit', label: 'Right after submission' },
  { key: 'laterOpen', label: 'While the exam is open' },
  { key: 'afterClosed', label: 'After the exam closes' },
];

/* ── Student-side types ─────────────────────────────── */

export interface StudentExamItem {
  id: number;
  title: string;
  durationMin: number;
  totalQuestions: number;
  passingScore: number | null;
  shuffle: boolean;
  showResult: boolean;
  maxAttempts: number;
  gradingMethod: GradingMethod;
  hasPassword: boolean;
  status: string;
  createdAt: string;
  subject: { id: number; name: string; code: string } | null;
  creator: { id: number; fullName: string } | null;
  examSchedules: Array<{
    id: number;
    startTime: string;
    endTime: string;
    status: string;
  }>;
  _count: { examQuestions: number };
  phase: 'upcoming' | 'in_progress' | 'completed';
  attemptCount: number;
  completedCount: number;
  bestScore: number | null;
  finalScore: number | null;
  attemptsRemaining: number;
  hasInProgress: boolean;
  canStart: boolean;
}

export interface StartExamData {
  attempt: {
    id: number;
    examId: number;
    startedAt: string;
    timeElapsedSec: number;
    timeRemainingsSec: number;
  };
  exam: {
    id: number;
    title: string;
    durationMin: number;
    totalQuestions: number;
    shuffle: boolean;
    shuffleAnswers: boolean;
    navigationMode: NavigationMode;
    questionsPerPage: number | null;
  };
  questions: ExamQuestion[];
  savedAnswers: Record<string, StudentAnswerValue>;
}

export type StudentAnswerValue =
  | number
  | number[]
  | string
  | Record<string, string>
  | null;

export interface ExamQuestion {
  questionId: number;
  orderIndex: number;
  points: number;
  content: string;
  questionType: string;
  options: Array<{ id: number; label: string; content: string }>;
}

export interface SaveAnswersResponse {
  savedCount: number;
  timeElapsedSec: number;
  timeRemainingsSec: number;
}

export interface SubmitExamResponse {
  attemptId: number;
  totalScore: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  timeSpentSec: number;
  isAutoSubmitted: boolean;
  submittedAt: string;
}

export interface AttemptResultData {
  attempt: {
    id: number;
    examId: number;
    examTitle: string;
    subject: { id: number; name: string; code: string } | null;
    status: string;
    startedAt: string;
    submittedAt: string;
    isAutoSubmitted: boolean;
    totalScore: number | null;
    timeSpentSec: number;
    passingScore: number | null;
    durationMin: number;
  };
  summary: {
    totalQuestions: number;
    correctCount: number;
    incorrectCount: number;
    scorePercentage: number;
    passed: boolean | null;
  };
  questions: ResultQuestion[];
  resultsAvailable: boolean;
  reviewWindow?: ReviewWindowName;
  reviewFlags?: ReviewWindowFlags;
}

export interface ResultQuestion {
  questionId: number;
  content: string;
  questionType: string;
  chapter: { id: number; name: string } | null;
  topic: { id: number; name: string } | null;
  explanation: string | null;
  selectedOption: { id: number; label: string; content: string } | null;
  selectedOptions?: Array<{ id: number; label: string; content: string }>;
  answerText?: string | null;
  correctOptions: Array<{ id: number; label: string; content: string }>;
  allOptions: Array<{
    id: number;
    label: string;
    content: string;
    isCorrect: boolean;
  }>;
  isCorrect: boolean;
  timeSpentSec: number | null;
  answerChanges: number;
}

/* ── Legacy student types (kept for compatibility) ──── */

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  examId: string;
  order: number;
  type: 'multiple_choice' | 'true_false' | 'short_answer';
  prompt: string;
  points: number;
  options?: QuestionOption[];
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  subject: string;
  gradeLevel: string;
  status: ExamStatus;
  durationMinutes: number;
  totalPoints: number;
  questionCount: number;
  availableFrom: string;
  availableUntil: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  submittedAt: string | null;
  timeRemainingSeconds: number | null;
  status: 'in_progress' | 'submitted' | 'graded' | 'expired';
}

export interface ExamResult {
  attemptId: string;
  examId: string;
  userId: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  gradedAt: string;
  breakdown?: Array<{
    questionId: string;
    awardedPoints: number;
    maxPoints: number;
    feedback?: string;
  }>;
}

/* ── Teacher-side types (exam management) ───────────── */

export type TeacherExamStatus = 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'CLOSED';

export interface TeacherExam {
  id: number;
  title: string;
  subjectId: number;
  createdBy: number;
  durationMin: number;
  totalQuestions: number;
  passingScore: number | null;
  shuffle: boolean;
  showResult: boolean;
  maxAttempts: number;
  gradingMethod: GradingMethod;
  shuffleAnswers: boolean;
  navigationMode: NavigationMode;
  questionsPerPage: number | null;
  accessPassword: string | null;
  reviewOptions: ReviewOptions | null;
  status: TeacherExamStatus;
  createdAt: string;
  subject?: { id: number; name: string; code: string };
  creator?: { id: number; fullName: string };
  examSchedules?: ExamScheduleItem[];
  examAssignments?: ExamAssignmentItem[];
  _count?: { examAttempts?: number };
}

export interface ExamScheduleItem {
  id: number;
  examId: number;
  classId?: number | null;
  startTime: string;
  endTime: string;
  room?: string | null;
  proctorId?: number | null;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  class?: { id: number; name: string } | null;
  proctor?: { id: number; fullName: string | null } | null;
}

export interface ExamAssignmentItem {
  id: number;
  examId: number;
  classId: number;
  gradeComponentType?: GradeComponentType | null;
  assignedBy: number;
  assignedAt: string;
  class?: { id: number; name: string; gradeLevel: number };
}

export interface CreateExamPayload {
  title: string;
  subjectId: number;
  durationMin: number;
  totalQuestions: number;
  passingScore?: number;
  shuffle?: boolean;
  showResult?: boolean;
  maxAttempts?: number;
  gradingMethod?: GradingMethod;
  shuffleAnswers?: boolean;
  navigationMode?: NavigationMode;
  questionsPerPage?: number | null;
  accessPassword?: string | null;
  reviewOptions?: ReviewOptions | null;
}

export interface UpdateExamPayload extends Partial<CreateExamPayload> {}

export interface AddExamQuestionsPayload {
  mode: 'manual' | 'random';
  questionIds?: number[];
  randomConfig?: {
    subjectId: number;
    chapterIds?: number[];
    difficulty?: number;
    count: number;
  };
}

export interface ScheduleExamPayload {
  startTime: string;
  endTime: string;
  /** Phase 5: limit this window to one assigned class (null/omitted = all classes). */
  classId?: number | null;
  /** Phase 6: room + supervising teacher. */
  room?: string | null;
  proctorId?: number | null;
  /** Admin-only: bypass hard timetable/exam conflicts. */
  force?: boolean;
}

export interface AssignExamPayload {
  classIds: number[];
  gradeComponentType?: GradeComponentType | null;
}

export type AttemptMonitoringEventType =
  | 'STARTED'
  | 'RESUMED'
  | 'HEARTBEAT'
  | 'ANSWER_SAVED'
  | 'TAB_HIDDEN'
  | 'WINDOW_BLUR'
  | 'COPY'
  | 'PASTE'
  | 'CONTEXT_MENU'
  | 'SHORTCUT_BLOCKED'
  | 'OFFLINE'
  | 'ONLINE'
  | 'SUBMITTED'
  | 'AUTO_SUBMITTED';

export interface AttemptMonitoringEvent {
  id: number;
  type: AttemptMonitoringEventType;
  occurredAt: string;
  clientElapsedSec: number | null;
  questionId: number | null;
  metadata: Record<string, unknown> | null;
}

export type ExamMonitoringStudentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'GRADED';

export interface ExamMonitoringStudent {
  student: {
    studentId: number;
    studentName: string | null;
    studentUsername: string;
    avatar: string | null;
    studentCode: string | null;
    homeroomClassName: string | null;
    classes: Array<{ id: number; name: string; gradeLevel: number }>;
  };
  attemptId: number | null;
  status: ExamMonitoringStudentStatus;
  startedAt: string | null;
  submittedAt: string | null;
  score: number | null;
  passed: boolean | null;
  correctCount: number;
  answeredQuestions: number;
  totalQuestions: number;
  timeSpentSec: number | null;
  timeElapsedSec: number | null;
  timeRemainingSec: number | null;
  isAutoSubmitted: boolean;
  lastActivityAt: string | null;
  lastHeartbeatAt: string | null;
  violationCount: number;
  tabSwitchCount: number;
  copyPasteCount: number;
  offlineCount: number;
  blockedShortcutCount: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  flags: string[];
  recentEvents: AttemptMonitoringEvent[];
}

export interface ExamMonitoringData {
  exam: {
    id: number;
    title: string;
    status: TeacherExamStatus;
    durationMin: number;
    totalQuestions: number;
    passingScore: number | null;
    classes: Array<{ id: number; name: string; gradeLevel: number }>;
  };
  summary: {
    totalStudents: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    autoSubmitted: number;
    avgScore: number | null;
    passRate: number | null;
    suspiciousCount: number;
    highRiskCount: number;
  };
  students: ExamMonitoringStudent[];
  updatedAt: string;
}

/* ── Exam reports (§12) ─────────────────────────────── */

export interface ReportQuestion {
  questionId: number;
  orderIndex: number;
  content: string;
  questionType: string;
  points: number;
  correctText: string;
}

export interface ReportAnswer {
  questionId: number;
  answerId: number | null;
  score: number;
  max: number;
  isCorrect: boolean;
  manualScore: number | null;
  manualFeedback: string | null;
  graded: boolean;
  needsManual: boolean;
  response: string;
}

export interface ReportAttempt {
  attemptId: number;
  student: {
    id: number;
    name: string | null;
    username: string;
    studentCode: string | null;
  };
  status: string;
  startedAt: string;
  submittedAt: string | null;
  timeSpentSec: number | null;
  isAutoSubmitted: boolean;
  totalScore: number;
  answers: ReportAnswer[];
}

export interface ReportStatistic {
  questionId: number;
  orderIndex: number;
  attempts: number;
  correctCount: number;
  facility: number | null;
  discrimination: number | null;
  flags: string[];
}

export interface ExamReportData {
  exam: {
    id: number;
    title: string;
    durationMin: number;
    passingScore: number | null;
    maxScore: number;
    totalQuestions: number;
  };
  questions: ReportQuestion[];
  attempts: ReportAttempt[];
  statistics: ReportStatistic[];
  distribution: Array<{ bucket: string; count: number }>;
  summary: {
    totalAttempts: number;
    avgScore: number | null;
    minScore: number | null;
    maxScoreAchieved: number | null;
    medianScore: number | null;
    passRate: number | null;
  };
}

export interface RecordAttemptEventPayload {
  type:
    | 'HEARTBEAT'
    | 'TAB_HIDDEN'
    | 'WINDOW_BLUR'
    | 'COPY'
    | 'PASTE'
    | 'CONTEXT_MENU'
    | 'SHORTCUT_BLOCKED'
    | 'OFFLINE'
    | 'ONLINE';
  clientElapsedSec?: number;
  questionId?: number;
  metadata?: Record<string, unknown>;
}

/* ── Class management types ─────────────────────────── */

export interface ClassItem {
  id: number;
  name: string;
  gradeLevel: number;
  semesterId: number;
  teacherId: number;
  subjectId: number;
  createdAt: string;
  subject?: { id: number; name: string; code: string };
  semester?: { id: number; name: string; academicYear?: { id: number; name: string } };
  teacher?: { id: number; fullName: string };
  _count?: { classStudents?: number };
}

export interface ClassStudent {
  classId: number;
  studentId: number;
  enrolledAt: string;
  student: {
    id: number;
    username: string;
    fullName: string | null;
    phone: string | null;
    avatar: string | null;
  };
}

export interface CreateClassPayload {
  name: string;
  gradeLevel: number;
  semesterId?: number;
  subjectId: number;
  academicYearString?: string;
}

export interface UpdateClassPayload extends Partial<CreateClassPayload> {}

export interface ImportStudentsResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

export type ClassResourceType = 'FILE' | 'IMAGE' | 'VIDEO' | 'LINK' | 'LESSON';
export type ClassActivityType =
  | 'QUIZ'
  | 'ASSIGNMENT'
  | 'FORUM'
  | 'WORKSHOP'
  | 'ATTENDANCE'
  | 'SURVEY';
export type ClassPublishStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export interface ClassSection {
  id: number;
  classId: number;
  title: string;
  description: string | null;
  orderIndex: number;
  isPublished: boolean;
  resources: ClassResource[];
  activities: ClassActivity[];
}

export interface ClassResource {
  id: number;
  classId: number;
  sectionId: number | null;
  type: ClassResourceType;
  title: string;
  description: string | null;
  content: string | null;
  url: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  isPublished: boolean;
  orderIndex: number;
}

export type GradeComponentType = 'REGULAR' | 'MIDTERM' | 'FINAL';
export type GradeEntrySource = 'EXAM' | 'ACTIVITY' | 'MANUAL';

export const GRADE_COMPONENT_INFO: Record<
  GradeComponentType,
  { abbr: string; label: string; coefficient: 1 | 2 | 3; color: string }
> = {
  REGULAR: {
    abbr: 'REG',
    label: 'Regular assessment',
    coefficient: 1,
    color: 'sky',
  },
  MIDTERM: {
    abbr: 'MID',
    label: 'Midterm assessment',
    coefficient: 2,
    color: 'amber',
  },
  FINAL: {
    abbr: 'FIN',
    label: 'Final assessment',
    coefficient: 3,
    color: 'rose',
  },
};

export interface ClassActivity {
  id: number;
  classId: number;
  sectionId: number | null;
  gradeComponentType?: GradeComponentType | null;
  type: ClassActivityType;
  title: string;
  instructions: string | null;
  content: string | null;
  status: ClassPublishStatus;
  dueAt: string | null;
  maxScore: number | null;
  allowLate: boolean;
  showGrades: boolean;
  allowStudentPosts: boolean;
}

export interface GradebookEntry {
  id: number;
  componentType: GradeComponentType;
  source: GradeEntrySource;
  label: string | null;
  score: number;
  examAssignmentId: number | null;
  classActivityId: number | null;
  examTitle: string | null;
  activityTitle: string | null;
  recordedBy: { id: number; fullName: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

export interface GradebookAverages {
  regular: number | null;
  midterm: number | null;
  final: number | null;
  semester: number | null;
}

export interface GradebookStudentRow {
  student: {
    id: number;
    username: string;
    fullName: string | null;
    avatar: string | null;
  };
  entries: GradebookEntry[];
  averages: GradebookAverages;
  yearAverage?: number | null;
  subjectStatus?: 'TOT' | 'KHA' | 'DAT' | 'CHUA_DAT' | null;
}

export interface GradebookClassSummary {
  id: number;
  name: string;
  gradeLevel: number;
  linkedClassId?: number | null;
  subject?: { id: number; name: string; code: string };
  semester?: { id: number; name: string; academicYear?: { id: number; name: string } };
}

export interface LinkedClassSummary {
  id: number;
  name: string;
  semester?: { id: number; name: string } | null;
}

export interface ClassGradebook {
  class: GradebookClassSummary;
  linkedClassSummary: LinkedClassSummary | null;
  students: GradebookStudentRow[];
}

export interface GradebookCollection {
  scope: 'all' | 'teacher';
  gradebooks: ClassGradebook[];
}

export interface MyGradebook {
  class: GradebookClassSummary;
  student: GradebookStudentRow | null;
  yearAverage: number | null;
  linkedClass: LinkedClassSummary | null;
}

export interface GradeChangeLogItem {
  id: number;
  action: string;
  oldScore: number | null;
  newScore: number | null;
  oldComponentType: GradeComponentType | null;
  newComponentType: GradeComponentType | null;
  reason: string | null;
  changedAt: string;
  changedBy: {
    id: number;
    fullName: string | null;
    role: string;
  } | null;
}

export interface ClassGradeChangeLogItem extends GradeChangeLogItem {
  gradeId: number;
  componentType: GradeComponentType | null;
  student: {
    id: number;
    username: string;
    fullName: string | null;
  } | null;
}

export interface ClassCourseOverview {
  class: ClassItem;
  role: string;
  capabilities: Record<string, boolean>;
  sections: ClassSection[];
  standaloneResources: ClassResource[];
  standaloneActivities: ClassActivity[];
  myCompletions?: Array<{ resourceId: number | null; activityId: number | null; completedAt: string }>;
  mySubmissions?: Array<{
    id: number;
    activityId: number;
    status: string;
    score: number | null;
    feedback: string | null;
    submittedAt: string;
  }>;
}
