import type { PlaceholderJsonResponse } from '../../types/common';

/** Semester placeholder */
export interface SemesterPlaceholder {
  id: string;
  name: string;
  academicYearId: string;
}

/**
 * Academic domain: subjects, academic years, semesters management.
 */
export class AcademicService {
  /**
   * Lists catalog subjects (optionally filtered by program/level).
   */
  async listSubjects(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Subjects — Phase 3' };
  }

  /**
   * Lists academic years for admin configuration and scoping data.
   */
  async listAcademicYears(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Academic years — Phase 3' };
  }

  /**
   * CRUD helpers for subjects (create/update/delete) for admin APIs.
   */
  async createSubject(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Create subject — placeholder' };
  }

  async updateSubject(_id: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Update subject — placeholder' };
  }

  async deleteSubject(_id: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Delete subject ${_id} — placeholder` };
  }

  /**
   * CRUD for academic years and nested semesters.
   */
  async createAcademicYear(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Create academic year — placeholder' };
  }

  async createSemester(_academicYearId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Create semester for ${_academicYearId} — placeholder` };
  }

  async listSemesters(_academicYearId: string): Promise<ReadonlyArray<SemesterPlaceholder>> {
    return [];
  }
}

export const academicService = new AcademicService();
