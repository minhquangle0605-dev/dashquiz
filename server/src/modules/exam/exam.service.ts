import type { PlaceholderJsonResponse } from '../../types/common';

/**
 * Exam domain: Prisma, node-cron — create/configure exams, scheduling, assignment, auto-submit.
 */
export class ExamService {
  /**
   * Lists exams visible to the caller (by role/class/enrollment).
   */
  async listExams(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Exam list — Phase 5' };
  }

  /**
   * Creates a new exam shell (settings, duration, question set references).
   */
  async createExam(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Create exam — placeholder' };
  }

  /**
   * Updates configuration: window, attempts, shuffle, proctor flags.
   */
  async updateExam(_examId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Update exam — placeholder' };
  }

  /**
   * Schedules publish/open/close times; registers cron jobs for reminders and auto-submit.
   */
  async scheduleExam(_examId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Schedule exam — placeholder' };
  }

  /**
   * Assigns exam instances to classes or individual students.
   */
  async assignExam(_examId: string, _assigneeIds: string[]): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Assign exam — placeholder' };
  }

  /**
   * Submits attempt when timer ends or cron fires; idempotent per attempt id.
   */
  async autoSubmitAttempt(_attemptId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Auto-submit attempt ${_attemptId} — placeholder` };
  }
}

export const examService = new ExamService();
