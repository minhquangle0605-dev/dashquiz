import type { ExamStatus } from '@/utils/constants';

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
    totalScore: number;
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
  startTime: string;
  endTime: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export interface ExamAssignmentItem {
  id: number;
  examId: number;
  classId: number;
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
}

export interface AssignExamPayload {
  classIds: number[];
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
