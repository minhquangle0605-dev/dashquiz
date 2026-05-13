import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

export function generateTestToken(
  payload: { id: number; username: string; role: string },
  expiresIn: StringValue = '1h',
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function createTestUser(role: 'student' | 'parent' | 'teacher' | 'admin' = 'student') {
  const roleMap = {
    student: { id: 1, username: 'student1', role: 'student' },
    parent: { id: 2, username: 'parent1', role: 'parent' },
    teacher: { id: 3, username: 'teacher1', role: 'teacher' },
    admin: { id: 4, username: 'admin1', role: 'admin' },
  };
  return roleMap[role];
}

export function loginAsRole(role: 'student' | 'parent' | 'teacher' | 'admin' = 'student') {
  const user = createTestUser(role);
  return {
    user,
    token: generateTestToken(user),
    authHeader: `Bearer ${generateTestToken(user)}`,
  };
}
