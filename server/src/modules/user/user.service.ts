import type { PlaceholderJsonResponse } from '../../types/common';

/** Lightweight placeholder for future user list/detail DTOs */
export interface UserPlaceholder {
  id: string;
  email: string;
}

/**
 * User domain: Prisma, Multer — CRUD users, profiles, parent–student linking, Excel import.
 */
export class UserService {
  /**
   * Returns the authenticated user's profile (from JWT/session).
   */
  async getMe(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'User profile — Phase 2' };
  }

  /**
   * Updates profile fields and optional avatar (Multer upload handled in route/middleware).
   */
  async updateMe(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Update profile — Phase 2' };
  }

  /**
   * Paginated list of users with filters (role, class, search).
   */
  async listUsers(): Promise<Readonly<{ success: true; message: string; data: UserPlaceholder[] }>> {
    return { success: true, message: 'User list — placeholder', data: [] };
  }

  /**
   * Fetches a single user by id for admin/teacher views.
   */
  async getUserById(_id: string): Promise<UserPlaceholder | null> {
    return null;
  }

  /**
   * Creates a user record (hashed password, role assignment).
   */
  async createUser(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Create user — placeholder' };
  }

  /**
   * Partial update of user fields (admin).
   */
  async updateUser(_id: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Update user — placeholder' };
  }

  /**
   * Soft-delete or hard-delete user per product rules.
   */
  async deleteUser(_id: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Delete user ${_id} — placeholder` };
  }

  /**
   * Links a parent account to one or more student accounts.
   */
  async linkParentToStudents(_parentId: string, _studentIds: string[]): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Parent–student link — placeholder' };
  }

  /**
   * Parses uploaded Excel (Multer) and bulk-creates/updates users.
   */
  async importUsersFromExcel(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Excel user import — placeholder' };
  }
}

export const userService = new UserService();
