import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ROLES } from '@/utils/constants';

import AuthLayout from './layouts/AuthLayout';
import StudentLayout from './layouts/StudentLayout';
import TeacherLayout from './layouts/TeacherLayout';
import ParentLayout from './layouts/ParentLayout';
import AdminLayout from './layouts/AdminLayout';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));

const StudentDashboard = lazy(() => import('./pages/student/DashboardPage'));
const ExamListPage = lazy(() => import('./pages/student/ExamListPage'));
const TakeExamPage = lazy(() => import('./pages/student/TakeExamPage'));
const ExamResultPage = lazy(() => import('./pages/student/ExamResultPage'));
const AIPracticePage = lazy(() => import('./pages/student/AIPracticePage'));

const TeacherDashboard = lazy(() => import('./pages/teacher/DashboardPage'));
const QuestionBankPage = lazy(() => import('./pages/teacher/QuestionBankPage'));
const ExamsPage = lazy(() => import('./pages/teacher/ExamsPage'));
const CreateExamPage = lazy(() => import('./pages/teacher/CreateExamPage'));
const ClassesPage = lazy(() => import('./pages/teacher/ClassesPage'));

const ParentDashboard = lazy(() => import('./pages/parent/DashboardPage'));
const ChildResultsPage = lazy(() => import('./pages/parent/ChildResultsPage'));

const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AcademicPage = lazy(() => import('./pages/admin/AcademicPage'));
const SystemPage = lazy(() => import('./pages/admin/SystemPage'));

const NotFoundPage = lazy(() => import('./pages/common/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./pages/common/ForbiddenPage'));
const ProfilePage = lazy(() => import('./pages/common/ProfilePage'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Student routes (protected) */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.STUDENT]} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="exams" element={<ExamListPage />} />
            <Route path="exams/:id/take" element={<TakeExamPage />} />
            <Route path="attempts/:attemptId/result" element={<ExamResultPage />} />
            <Route path="ai-practice" element={<AIPracticePage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Teacher routes (protected) */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.TEACHER]} />}>
          <Route path="/teacher" element={<TeacherLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboard />} />
            <Route path="questions" element={<QuestionBankPage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="exams/create" element={<CreateExamPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Parent routes (protected) */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.PARENT]} />}>
          <Route path="/parent" element={<ParentLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ParentDashboard />} />
            <Route path="results" element={<ChildResultsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Admin routes (protected) */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="academic" element={<AcademicPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Common routes */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
