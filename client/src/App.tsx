import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import StudentLayout from './layouts/StudentLayout';
import TeacherLayout from './layouts/TeacherLayout';
import ParentLayout from './layouts/ParentLayout';
import AdminLayout from './layouts/AdminLayout';

// Auth pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));

// Student pages
const StudentDashboard = lazy(() => import('./pages/student/DashboardPage'));
const ExamListPage = lazy(() => import('./pages/student/ExamListPage'));
const TakeExamPage = lazy(() => import('./pages/student/TakeExamPage'));
const ResultPage = lazy(() => import('./pages/student/ResultPage'));
const AIPracticePage = lazy(() => import('./pages/student/AIPracticePage'));

// Teacher pages
const TeacherDashboard = lazy(() => import('./pages/teacher/DashboardPage'));
const QuestionBankPage = lazy(() => import('./pages/teacher/QuestionBankPage'));
const CreateExamPage = lazy(() => import('./pages/teacher/CreateExamPage'));
const ClassesPage = lazy(() => import('./pages/teacher/ClassesPage'));

// Parent pages
const ParentDashboard = lazy(() => import('./pages/parent/DashboardPage'));
const ChildResultsPage = lazy(() => import('./pages/parent/ChildResultsPage'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AcademicPage = lazy(() => import('./pages/admin/AcademicPage'));
const SystemPage = lazy(() => import('./pages/admin/SystemPage'));

// Common pages
const NotFoundPage = lazy(() => import('./pages/common/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./pages/common/ForbiddenPage'));
const ProfilePage = lazy(() => import('./pages/common/ProfilePage'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Student routes */}
        <Route path="/student" element={<StudentLayout />}>
          <Route index element={<StudentDashboard />} />
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="exams" element={<ExamListPage />} />
          <Route path="exams/:id/take" element={<TakeExamPage />} />
          <Route path="exams/:id/result" element={<ResultPage />} />
          <Route path="ai-practice" element={<AIPracticePage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Teacher routes */}
        <Route path="/teacher" element={<TeacherLayout />}>
          <Route index element={<TeacherDashboard />} />
          <Route path="dashboard" element={<TeacherDashboard />} />
          <Route path="questions" element={<QuestionBankPage />} />
          <Route path="exams/create" element={<CreateExamPage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Parent routes */}
        <Route path="/parent" element={<ParentLayout />}>
          <Route index element={<ParentDashboard />} />
          <Route path="dashboard" element={<ParentDashboard />} />
          <Route path="results" element={<ChildResultsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="academic" element={<AcademicPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Common routes */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
