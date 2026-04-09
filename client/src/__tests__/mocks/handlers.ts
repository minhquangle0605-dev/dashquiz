import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    if (body.email === 'student@test.com' && body.password === 'Password123!') {
      return HttpResponse.json({
        success: true,
        message: 'Login successful',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJzdHVkZW50QHRlc3QuY29tIiwicm9sZSI6InN0dWRlbnQiLCJpYXQiOjk5OTk5OTk5OTksImV4cCI6OTk5OTk5OTk5OX0.test',
          user: {
            id: 1,
            username: 'teststudent',
            email: 'student@test.com',
            fullName: 'Test Student',
            avatar: null,
            role: 'student',
          },
        },
      });
    }

    if (body.email === 'suspended@test.com') {
      return HttpResponse.json(
        { success: false, message: 'Account is disabled or suspended' },
        { status: 403 },
      );
    }

    return HttpResponse.json(
      { success: false, message: 'Invalid email or password' },
      { status: 401 },
    );
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true, message: 'Logout successful', data: null });
  }),

  http.post('/api/auth/refresh', () => {
    return HttpResponse.json({
      success: true,
      data: {
        accessToken: 'new-access-token',
      },
    });
  }),

  http.get('/api/student/exams', () => {
    return HttpResponse.json({
      success: true,
      data: [
        {
          id: 1,
          title: 'Math Exam',
          subject: { name: 'Math' },
          durationMin: 60,
          status: 'PUBLISHED',
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });
  }),

  http.get('/api/exams/:id', ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: {
        id: Number(params.id),
        title: 'Math Exam',
        durationMin: 60,
        totalQuestions: 10,
        status: 'PUBLISHED',
        subject: { id: 1, name: 'Math', code: 'MATH' },
      },
    });
  }),
];
