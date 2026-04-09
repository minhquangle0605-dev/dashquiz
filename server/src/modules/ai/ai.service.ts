import type { PlaceholderJsonResponse } from '../../types/common';

/**
 * AI domain: OpenAI SDK, Prisma — adaptive questions from wrong answers, practice sessions.
 */
export class AiService {
  /**
   * Opens a practice session seeded from recent mistakes or topic selection.
   */
  async startPractice(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'AI practice — Phase 9' };
  }

  /**
   * Generates the next adaptive item using model + learner state from Prisma.
   */
  async getNextAdaptiveQuestion(_sessionId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Next adaptive question — placeholder' };
  }

  /**
   * Records outcome and updates mastery estimates for follow-up recommendations.
   */
  async recordPracticeOutcome(
    _sessionId: string,
    _questionId: string,
    _correct: boolean,
  ): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Record practice outcome — placeholder' };
  }

  /**
   * Ends session, persists summary stats for analytics linkage.
   */
  async endPracticeSession(_sessionId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `End practice ${_sessionId} — placeholder` };
  }

  /**
   * Builds a prompt payload from wrong-answer history (sanitized) for the OpenAI SDK.
   */
  async buildWrongAnswerPrompt(_attemptId: string): Promise<string> {
    return '';
  }
}

export const aiService = new AiService();
