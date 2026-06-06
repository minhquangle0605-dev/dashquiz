import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// AI ENRICHMENT (PDF §5/§7/§14 — "AI assists AFTER deterministic parsing,
// never silently publishes"). Given an already-parsed question, Gemini suggests
// difficulty, tags, topic, an improved explanation, and flags weak distractors.
// Suggestions are returned for review — nothing is applied or saved here.
// ─────────────────────────────────────────────────────────────────────────────

export interface AiEnrichInput {
  content: string;
  questionType: string;
  options: Array<{ label: string; content: string; isCorrect: boolean }>;
  subjectName?: string;
  chapterName?: string;
  currentDifficulty?: number;
}

export interface AiWeakDistractor {
  label: string;
  reason: string;
}

export interface AiSuggestion {
  available: boolean;
  difficulty?: number;
  tags?: string[];
  topic?: string;
  explanation?: string;
  weakDistractors?: AiWeakDistractor[];
  notes?: string;
}

export function isAiAvailable(): boolean {
  return Boolean(env.gemini.apiKey);
}

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildPrompt(input: AiEnrichInput): string {
  const options = input.options
    .map((o) => `  ${o.label}. ${stripHtml(o.content)}${o.isCorrect ? '  [CORRECT]' : ''}`)
    .join('\n');
  return `You are a meticulous exam-question reviewer. Analyse the question below and
return enrichment SUGGESTIONS only. Do NOT rewrite the question or change which
option is correct.

Subject: ${input.subjectName || 'unknown'}
Chapter: ${input.chapterName || 'unknown'}
Question type: ${input.questionType}
Question: ${stripHtml(input.content)}
Options:
${options || '  (no options)'}

Return STRICT JSON with this exact shape (omit a field if you have no good suggestion):
{
  "difficulty": <integer 1-5, where 1=very easy and 5=very hard>,
  "tags": [<2-5 short lowercase topic keywords>],
  "topic": "<a concise topic/subtopic name, max 6 words>",
  "explanation": "<a clear explanation of the correct answer, plain text, max 50 words>",
  "weakDistractors": [{"label": "<option letter>", "reason": "<why this distractor is weak/implausible, max 20 words>"}],
  "notes": "<one short overall quality note, or empty string>"
}
Only output the JSON object.`;
}

function clampDifficulty(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
}

function cleanTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 50)
    .slice(0, 6);
  return tags.length > 0 ? Array.from(new Set(tags)) : undefined;
}

function cleanWeakDistractors(
  value: unknown,
  validLabels: Set<string>,
): AiWeakDistractor[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value
    .map((d) => {
      const obj = (d ?? {}) as Record<string, unknown>;
      return {
        label: String(obj.label ?? '').trim().toUpperCase().slice(0, 1),
        reason: String(obj.reason ?? '').trim().slice(0, 200),
      };
    })
    .filter((d) => validLabels.has(d.label) && d.reason.length > 0);
  return list.length > 0 ? list : undefined;
}

function parseJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new AppError('AI returned invalid JSON', 502);
  return JSON.parse(cleaned.slice(start, end + 1));
}

class AiEnrichService {
  async suggestForQuestion(input: AiEnrichInput): Promise<AiSuggestion> {
    if (!isAiAvailable()) return { available: false };

    const client = new GoogleGenerativeAI(env.gemini.apiKey);
    const model = client.getGenerativeModel({
      model: env.gemini.model,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
    });

    let raw: string;
    try {
      const response = await model.generateContent(buildPrompt(input));
      raw = response.response.text();
    } catch (error) {
      logger.error('Gemini call failed (question enrichment)', { error });
      throw new AppError('AI suggestion service is temporarily unavailable', 503);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = parseJson(raw);
    } catch {
      throw new AppError('AI returned an unreadable suggestion', 502);
    }

    const validLabels = new Set(input.options.map((o) => String(o.label).toUpperCase()));
    const explanation =
      typeof parsed.explanation === 'string' && parsed.explanation.trim()
        ? parsed.explanation.trim().slice(0, 600)
        : undefined;
    const topic =
      typeof parsed.topic === 'string' && parsed.topic.trim()
        ? parsed.topic.trim().slice(0, 60)
        : undefined;
    const notes =
      typeof parsed.notes === 'string' && parsed.notes.trim()
        ? parsed.notes.trim().slice(0, 300)
        : undefined;

    return {
      available: true,
      difficulty: clampDifficulty(parsed.difficulty),
      tags: cleanTags(parsed.tags),
      topic,
      explanation,
      weakDistractors: cleanWeakDistractors(parsed.weakDistractors, validLabels),
      notes,
    };
  }
}

export const aiEnrichService = new AiEnrichService();
