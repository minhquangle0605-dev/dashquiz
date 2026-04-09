import type { PlaceholderJsonResponse } from '../../types/common';

/** Question bank row placeholder */
export interface QuestionPlaceholder {
  id: string;
  stem: string;
  type: 'mcq' | 'short' | 'true_false';
}

/**
 * Question domain: Prisma, xlsx — question bank CRUD, Excel import, tagging.
 */
export class QuestionService {
  /**
   * Lists questions with optional filters (subject, tag, difficulty).
   */
  async listQuestions(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Question bank — Phase 4' };
  }

  /**
   * Retrieves one question by id (respecting visibility/ownership).
   */
  async getQuestionById(_id: string): Promise<QuestionPlaceholder | null> {
    return null;
  }

  /**
   * Creates a question with options, correct answer(s), explanation.
   */
  async createQuestion(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Create question — placeholder' };
  }

  /**
   * Updates question content or metadata.
   */
  async updateQuestion(_id: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Update question — placeholder' };
  }

  /**
   * Deletes or archives a question.
   */
  async deleteQuestion(_id: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Delete question ${_id} — placeholder` };
  }

  /**
   * Bulk import from Excel (xlsx); maps columns to question schema.
   */
  async importQuestionsFromExcel(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Question Excel import — placeholder' };
  }

  /**
   * Adds or replaces tags on a question for discovery and analytics.
   */
  async setQuestionTags(_questionId: string, _tagSlugs: string[]): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Set question tags — placeholder' };
  }
}

export const questionService = new QuestionService();
