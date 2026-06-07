import { GoogleGenerativeAI } from '@google/generative-ai';

import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';

function getGeminiClient(): GoogleGenerativeAI {
  if (!env.gemini.apiKey) {
    throw new AppError(
      'GEMINI_API_KEY is not configured on the server',
      503,
    );
  }
  return new GoogleGenerativeAI(env.gemini.apiKey);
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  return trimmed;
}

function buildDistractorPrompt(input: {
  pairs: Array<{ left: string; right: string }>;
  questionContent?: string;
  subjectName?: string;
}): string {
  const pairsText = input.pairs
    .map((p, i) => `  ${i + 1}. "${p.left}" => "${p.right}"`)
    .join('\n');

  const contextParts: string[] = [];
  if (input.subjectName) contextParts.push(`Subject: ${input.subjectName}`);
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
  /**
   * Generates one plausible-looking distractor right-side value for a MATCHING
   * question, based on the existing correct pairs and their semantic context.
   */
  async generateMatchingDistractor(input: {
    pairs: Array<{ left: string; right: string }>;
    questionContent?: string;
    subjectName?: string;
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
}

export const aiService = new AiService();
