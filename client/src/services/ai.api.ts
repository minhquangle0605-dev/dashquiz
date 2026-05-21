import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';

export interface RemedialOption {
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface RemedialQuestion {
  id: number;
  content: string;
  options: RemedialOption[];
  studentAnswer: string | null;
  isCorrect: boolean | null;
  correctOption: string | null;
  explanation: string | null;
}

export interface RemedialSession {
  id: number;
  sourceAttemptId: number;
  totalQuestions: number;
  correctAnswers: number;
  createdAt: string;
  topic: {
    id: number;
    name: string;
    chapter: string;
    subject: string;
  };
  questions: RemedialQuestion[];
}

export interface GenerateRemedialResponse {
  sessionId: number;
  totalQuestions: number;
}

export interface SubmitRemedialAnswerResponse {
  isCorrect: boolean;
  correctOption: string;
  explanation: string | null;
}

interface ServerResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export async function generateRemedialPractice(
  attemptId: number,
): Promise<GenerateRemedialResponse> {
  const { data } = await api.post<ServerResponse<GenerateRemedialResponse>>(
    API_ENDPOINTS.AI.REMEDIAL_GENERATE,
    { attemptId },
  );
  return data.data;
}

export async function getRemedialSession(
  sessionId: number,
): Promise<RemedialSession> {
  const { data } = await api.get<ServerResponse<RemedialSession>>(
    API_ENDPOINTS.AI.REMEDIAL_SESSION(sessionId),
  );
  return data.data;
}

export async function submitRemedialAnswer(
  sessionId: number,
  questionId: number,
  selectedLabel: string,
): Promise<SubmitRemedialAnswerResponse> {
  const { data } = await api.post<ServerResponse<SubmitRemedialAnswerResponse>>(
    API_ENDPOINTS.AI.REMEDIAL_ANSWER(sessionId, questionId),
    { selectedLabel },
  );
  return data.data;
}

export interface MatchingDistractorRequest {
  pairs: Array<{ left: string; right: string }>;
  questionContent?: string;
  subjectName?: string;
  topicName?: string;
}

export async function generateMatchingDistractor(
  payload: MatchingDistractorRequest,
): Promise<string> {
  const { data } = await api.post<ServerResponse<{ distractor: string }>>(
    API_ENDPOINTS.AI.MATCHING_DISTRACTOR,
    payload,
  );
  return data.data.distractor;
}
