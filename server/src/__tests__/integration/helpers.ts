import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing';

export function generateTestToken(
  payload: { id: number; email: string; role: string },
  expiresIn: StringValue = '1h',
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function createTestUser(role: 'student' | 'parent' | 'teacher' | 'admin' = 'student') {
  const roleMap = {
    student: { id: 1, email: 'student@test.com', role: 'student' },
    parent: { id: 2, email: 'parent@test.com', role: 'parent' },
    teacher: { id: 3, email: 'teacher@test.com', role: 'teacher' },
    admin: { id: 4, email: 'admin@test.com', role: 'admin' },
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
