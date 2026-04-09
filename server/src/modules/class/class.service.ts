import type { PlaceholderJsonResponse } from '../../types/common';

/**
 * Class domain: class management, student enrollment.
 */
export class ClassService {
  /**
   * Lists classes the caller may see (teacher/admin/student enrollment).
   */
  async listClasses(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Classes — Phase 5' };
  }

  /**
   * Creates a class with optional join code and academic context.
   */
  async createClass(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Create class — placeholder' };
  }

  /**
   * Updates class metadata (name, schedule ref, homeroom teacher).
   */
  async updateClass(_classId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Update class — placeholder' };
  }

  /**
   * Enrolls a student in a class; validates capacity and duplicates.
   */
  async enrollStudent(_classId: string, _studentId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Enroll student — placeholder' };
  }

  /**
   * Removes a student from a class roster.
   */
  async unenrollStudent(_classId: string, _studentId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Unenroll student — placeholder' };
  }

  /**
   * Bulk enroll from CSV/Excel or selected ids.
   */
  async bulkEnroll(_classId: string, _studentIds: string[]): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Bulk enroll ${_classId} — placeholder` };
  }
}

export const classService = new ClassService();
