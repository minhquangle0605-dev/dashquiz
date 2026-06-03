import { GoogleGenerativeAI } from '@google/generative-ai';

import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { COMPLETED_ATTEMPT_STATUSES } from '../../utils/constants';

const REMEDIAL_PER_WRONG_QUESTION = 1;
const REMEDIAL_MAX_QUESTIONS = 10;
const REMEDIAL_MIN_QUESTIONS = 3;

interface GeminiOption {
  label: string;
  content: string;
  isCorrect: boolean;
}

interface GeminiQuestion {
  content: string;
  options: GeminiOption[];
  explanation?: string;
  difficulty?: number;
  topicId?: number | null;
}

interface RemedialResult {
  sessionId: number;
  totalQuestions: number;
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!env.gemini.apiKey) {
    throw new AppError(
      'GEMINI_API_KEY is not configured on the server',
      503,
    );
  }
  return new GoogleGenerativeAI(env.gemini.apiKey);
}

function clampQuestionCount(wrongCount: number): number {
  const target = wrongCount * REMEDIAL_PER_WRONG_QUESTION;
  if (target < REMEDIAL_MIN_QUESTIONS) return REMEDIAL_MIN_QUESTIONS;
  if (target > REMEDIAL_MAX_QUESTIONS) return REMEDIAL_MAX_QUESTIONS;
  return target;
}

function pickPrimaryTopicId(
  wrongAnswers: Array<{ question: { topicId: number } }>,
): number {
  const counts = new Map<number, number>();
  for (const a of wrongAnswers) {
    counts.set(a.question.topicId, (counts.get(a.question.topicId) ?? 0) + 1);
  }
  let bestId = wrongAnswers[0].question.topicId;
  let bestCount = -1;
  for (const [id, count] of counts.entries()) {
    if (count > bestCount) {
      bestId = id;
      bestCount = count;
    }
  }
  return bestId;
}

function buildPrompt(
  wrongAnswers: Array<{
    question: {
      content: string;
      difficulty: number;
      topicId: number;
      options: Array<{ id: number; label: string; content: string; isCorrect: boolean }>;
      topic: { name: string };
      chapter: { name: string };
      subject: { name: string };
    };
    selectedOptionId: number | null;
  }>,
  desiredCount: number,
): string {
  const cases = wrongAnswers.map((a, i) => {
    const correct = a.question.options.find((o) => o.isCorrect);
    const chosen = a.selectedOptionId
      ? a.question.options.find((o) => o.id === a.selectedOptionId)
      : null;
    const optionsText = a.question.options
      .map((o) => `${o.label}. ${o.content}${o.isCorrect ? ' [CORRECT]' : ''}`)
      .join('\n   ');

    return `Question ${i + 1}:
- Subject: ${a.question.subject.name}
- Chapter: ${a.question.chapter.name}
- Topic: ${a.question.topic.name}
- Difficulty (1-5): ${a.question.difficulty}
- Content: ${a.question.content}
- Options:
   ${optionsText}
- Correct answer: ${correct ? `${correct.label}. ${correct.content}` : 'N/A'}
- Student chose: ${chosen ? `${chosen.label}. ${chosen.content}` : 'BLANK'}`;
  }).join('\n\n');

  return `You are an expert teacher. Below is a list of multiple-choice questions that the student answered INCORRECTLY. Each question includes the correct answer and the wrong answer the student chose — these are clues to the student's MISCONCEPTIONS.

${cases}

Generate EXACTLY ${desiredCount} NEW multiple-choice questions to help the student overcome the above misconceptions. Requirements:
1. Same topic, same difficulty (±1 level) as the incorrect questions.
2. Focus on testing the same core concepts the student got wrong.
3. DO NOT copy or directly paraphrase the original questions — they must be new questions.
4. Each question has 4 options A/B/C/D, with EXACTLY one correct answer.
5. Include a brief explanation (1-3 sentences) of why the correct answer is correct.

Return ONLY a valid JSON array (no markdown, no code fence, no explanatory text before/after), following this schema:
[
  {
    "content": "string",
    "options": [
      { "label": "A", "content": "string", "isCorrect": false },
      { "label": "B", "content": "string", "isCorrect": true },
      { "label": "C", "content": "string", "isCorrect": false },
      { "label": "D", "content": "string", "isCorrect": false }
    ],
    "explanation": "string",
    "difficulty": 3
  }
]`;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  return trimmed;
}

function parseGeminiQuestions(raw: string): GeminiQuestion[] {
  const cleaned = stripCodeFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) {
      throw new AppError('AI returned invalid JSON', 502);
    }
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new AppError('AI returned invalid JSON', 502);
    }
  }

  if (!Array.isArray(parsed)) {
    throw new AppError('AI response is not an array', 502);
  }

  const questions: GeminiQuestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const content = typeof obj.content === 'string' ? obj.content.trim() : '';
    const optionsRaw = Array.isArray(obj.options) ? obj.options : [];
    const options: GeminiOption[] = [];
    for (const opt of optionsRaw) {
      if (!opt || typeof opt !== 'object') continue;
      const o = opt as Record<string, unknown>;
      const label = typeof o.label === 'string' ? o.label.trim().toUpperCase().slice(0, 1) : '';
      const optContent = typeof o.content === 'string' ? o.content.trim() : '';
      const isCorrect = Boolean(o.isCorrect);
      if (!label || !optContent) continue;
      options.push({ label, content: optContent, isCorrect });
    }

    if (!content || options.length < 2) continue;
    const correctCount = options.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) continue;

    questions.push({
      content,
      options,
      explanation: typeof obj.explanation === 'string' ? obj.explanation.trim() : undefined,
      difficulty: typeof obj.difficulty === 'number' ? obj.difficulty : undefined,
    });
  }

  if (questions.length === 0) {
    throw new AppError('AI returned no usable questions', 502);
  }
  return questions;
}

function buildDistractorPrompt(input: {
  pairs: Array<{ left: string; right: string }>;
  questionContent?: string;
  subjectName?: string;
  topicName?: string;
}): string {
  const pairsText = input.pairs
    .map((p, i) => `  ${i + 1}. "${p.left}" => "${p.right}"`)
    .join('\n');

  const contextParts: string[] = [];
  if (input.subjectName) contextParts.push(`Subject: ${input.subjectName}`);
  if (input.topicName) contextParts.push(`Topic: ${input.topicName}`);
  if (input.questionContent) contextParts.push(`Question: ${input.questionContent}`);
  const context = contextParts.length > 0 ? `\n${contextParts.join('\n')}\n` : '';

  return `You are an expert teacher composing a MATCHING question.${context}
Below are the CORRECT pairs (left <=> right) already in the question:
${pairsText}

Generate EXACTLY ONE distractor "right side" answer such that:
1. Same format, same unit, same value type as the existing right sides (e.g., if the right sides are fractions/trigonometric values → the distractor should also be a valid fraction/trigonometric value).
2. DOES NOT match any of the right sides above (whitespace-insensitive comparison).
3. IS NOT a correct answer for any of the left sides above.
4. Plausible — could trick the student but still within the same knowledge area.
5. Concise (max ~60 characters).

Return ONLY a single valid JSON string, no markdown, no explanation, following the schema:
{ "distractor": "string" }`;
}

function parseDistractorResponse(raw: string): string {
  const cleaned = stripCodeFence(raw);
  try {
    const parsed = JSON.parse(cleaned) as { distractor?: unknown };
    if (typeof parsed.distractor === 'string' && parsed.distractor.trim()) {
      return parsed.distractor.trim();
    }
  } catch {
    // Fall through to fallback parsing
  }

  const match = cleaned.match(/"distractor"\s*:\s*"([^"]+)"/);
  if (match && match[1].trim()) return match[1].trim();

  throw new AppError('AI returned no usable distractor', 502);
}

export class AiService {
  async startPractice(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'AI practice — Phase 9' };
  }

  /**
   * Generates one plausible-looking distractor right-side value for a MATCHING
   * question, based on the existing correct pairs and their semantic context.
   */
  async generateMatchingDistractor(input: {
    pairs: Array<{ left: string; right: string }>;
    questionContent?: string;
    subjectName?: string;
    topicName?: string;
  }): Promise<string> {
    const prompt = buildDistractorPrompt(input);
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: env.gemini.model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.8,
      },
    });

    let raw: string;
    try {
      const response = await model.generateContent(prompt);
      raw = response.response.text();
    } catch (error) {
      logger.error('Gemini call failed (matching distractor)', { error });
      throw new AppError('AI service is temporarily unavailable', 503);
    }

    const distractor = parseDistractorResponse(raw);
    const normalized = distractor.replace(/\s+/g, ' ').trim();
    const existing = new Set(
      input.pairs.map((p) => p.right.replace(/\s+/g, ' ').trim().toLowerCase()),
    );
    if (existing.has(normalized.toLowerCase())) {
      throw new AppError('AI distractor duplicated an existing answer — try again', 502);
    }
    return normalized;
  }

  /**
   * Generates remedial multiple-choice questions from the wrong answers of a
   * student's exam attempt, persists them as an AiPracticeSession, and
   * returns the new sessionId for the student to practice.
   */
  async generateRemedialPractice(
    attemptId: number,
    studentId: number,
  ): Promise<RemedialResult> {
    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, studentId },
      include: {
        attemptAnswers: {
          where: { isCorrect: false },
          include: {
            question: {
              include: {
                options: true,
                topic: true,
                chapter: true,
                subject: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new AppError('Exam attempt not found', 404);
    }
    if (!(COMPLETED_ATTEMPT_STATUSES as readonly string[]).includes(attempt.status)) {
      throw new AppError('Exam attempt has not been submitted yet', 400);
    }

    const wrongAnswers = attempt.attemptAnswers;
    if (wrongAnswers.length === 0) {
      throw new AppError('No wrong answers to remediate', 400);
    }

    const desiredCount = clampQuestionCount(wrongAnswers.length);
    const prompt = buildPrompt(wrongAnswers, desiredCount);

    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: env.gemini.model,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    let raw: string;
    try {
      const response = await model.generateContent(prompt);
      raw = response.response.text();
    } catch (error) {
      logger.error('Gemini call failed', { error });
      throw new AppError('AI service is temporarily unavailable', 503);
    }

    const generated = parseGeminiQuestions(raw);
    const primaryTopicId = pickPrimaryTopicId(wrongAnswers);

    const session = await prisma.aiPracticeSession.create({
      data: {
        studentId,
        topicId: primaryTopicId,
        sourceAttemptId: attemptId,
        totalQuestions: generated.length,
        questions: {
          create: generated.map((q) => {
            const correct = q.options.find((o) => o.isCorrect)!;
            return {
              content: q.content,
              optionsJson: q.options as unknown as object,
              correctOption: correct.label,
              explanation: q.explanation ?? null,
            };
          }),
        },
      },
    });

    return { sessionId: session.id, totalQuestions: generated.length };
  }

  /**
   * Returns a remedial session with its generated questions, hiding the
   * correct answers if the student has not yet answered each question.
   */
  async getRemedialSession(sessionId: number, studentId: number) {
    const session = await prisma.aiPracticeSession.findFirst({
      where: { id: sessionId, studentId },
      include: {
        questions: { orderBy: { id: 'asc' } },
        topic: { include: { chapter: { include: { subject: true } } } },
      },
    });
    if (!session) throw new AppError('Practice session not found', 404);

    return {
      id: session.id,
      sourceAttemptId: session.sourceAttemptId,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      createdAt: session.createdAt,
      topic: {
        id: session.topic.id,
        name: session.topic.name,
        chapter: session.topic.chapter.name,
        subject: session.topic.chapter.subject.name,
      },
      questions: session.questions.map((q) => {
        const answered = q.studentAnswer !== null && q.studentAnswer !== undefined;
        return {
          id: q.id,
          content: q.content,
          options: q.optionsJson as Array<{ label: string; content: string; isCorrect: boolean }>,
          studentAnswer: q.studentAnswer ?? null,
          isCorrect: q.isCorrect ?? null,
          // Reveal correctOption + explanation only after answering
          correctOption: answered ? q.correctOption : null,
          explanation: answered ? q.explanation : null,
        };
      }),
    };
  }

  /**
   * Records the student's choice for one remedial question and reports
   * whether it was correct, returning the canonical correct option and
   * explanation for immediate feedback.
   */
  async submitRemedialAnswer(
    sessionId: number,
    questionId: number,
    studentId: number,
    selectedLabel: string,
  ) {
    const session = await prisma.aiPracticeSession.findFirst({
      where: { id: sessionId, studentId },
      include: { questions: { where: { id: questionId } } },
    });
    if (!session || session.questions.length === 0) {
      throw new AppError('Question not found in this session', 404);
    }

    const question = session.questions[0];
    if (question.studentAnswer !== null && question.studentAnswer !== undefined) {
      throw new AppError('Question already answered', 400);
    }

    const normalized = selectedLabel.trim().toUpperCase().slice(0, 1);
    const isCorrect = normalized === question.correctOption;

    await prisma.$transaction([
      prisma.aiGeneratedQuestion.update({
        where: { id: questionId },
        data: { studentAnswer: normalized, isCorrect },
      }),
      ...(isCorrect
        ? [
            prisma.aiPracticeSession.update({
              where: { id: sessionId },
              data: { correctAnswers: { increment: 1 } },
            }),
          ]
        : []),
    ]);

    return {
      isCorrect,
      correctOption: question.correctOption,
      explanation: question.explanation,
    };
  }
}

export const aiService = new AiService();
