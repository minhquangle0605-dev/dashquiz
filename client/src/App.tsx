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

const StudentDashboard = lazy(() => import('./pages/student/DashboardPage'));
const KnowledgeGraphPage = lazy(() => import('./pages/student/KnowledgeGraphPage'));
const ExamListPage = lazy(() => import('./pages/student/ExamListPage'));
const TakeExamPage = lazy(() => import('./pages/student/TakeExamPage'));
const ExamResultPage = lazy(() => import('./pages/student/ExamResultPage'));
const AIPracticePage = lazy(() => import('./pages/student/AIPracticePage'));
const RemedialSessionPage = lazy(() => import('./pages/student/RemedialSessionPage'));
const MyClassesPage = lazy(() => import('./pages/student/MyClassesPage'));
const StudentTimetablePage = lazy(() => import('./pages/student/TimetablePage'));

const TeacherDashboard = lazy(() => import('./pages/teacher/DashboardPage'));
const QuestionBankPage = lazy(() => import('./pages/teacher/QuestionBankPage'));
const ExamsPage = lazy(() => import('./pages/teacher/ExamsPage'));
const CreateExamPage = lazy(() => import('./pages/teacher/CreateExamPage'));
const ExamReportsPage = lazy(() => import('./pages/teacher/ExamReportsPage'));
const ClassesPage = lazy(() => import('./pages/teacher/ClassesPage'));
const TeacherTimetablePage = lazy(() => import('./pages/teacher/TimetablePage'));

const ParentDashboard = lazy(() => import('./pages/parent/DashboardPage'));
const ChildResultsPage = lazy(() => import('./pages/parent/ChildResultsPage'));
const ParentTimetablePage = lazy(() => import('./pages/parent/TimetablePage'));

const AdminDashboard = lazy(() => import('./pages/admin/DashboardPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AcademicPage = lazy(() => import('./pages/admin/AcademicPage'));
const SystemPage = lazy(() => import('./pages/admin/SystemPage'));
const AdminTimetablePage = lazy(() => import('./pages/admin/TimetablePage'));
const AdminExamsPage = lazy(() => import('./pages/admin/ExamsPage'));

const NotFoundPage = lazy(() => import('./pages/common/NotFoundPage'));
const ForbiddenPage = lazy(() => import('./pages/common/ForbiddenPage'));
const ServerErrorPage = lazy(() => import('./pages/common/ServerErrorPage'));
const ProfilePage = lazy(() => import('./pages/common/ProfilePage'));
const NotificationsPage = lazy(() => import('./pages/common/NotificationsPage'));
const DiscussionsPage = lazy(() => import('./pages/common/DiscussionsPage'));
const GradebookPage = lazy(() => import('./pages/common/GradebookPage'));
const AdminDiscussionsPage = lazy(() => import('./pages/admin/DiscussionsPage'));

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-page)]">
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-[3px] border-[var(--color-primary-soft-strong)]" />
          <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--color-primary)] border-r-[var(--color-secondary)]" />
        </div>
        <p className="text-sm font-medium text-[var(--color-text-muted)]">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public auth routes — explicit path so layout + Outlet match reliably (RR v7) */}
        <Route path="/login" element={<AuthLayout />}>
          <Route index element={<LoginPage />} />
        </Route>

        {/* Student routes (protected) */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.STUDENT]} />}>
          <Route path="/student" element={<StudentLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="classes" element={<MyClassesPage />} />
            <Route path="timetable" element={<StudentTimetablePage />} />
            <Route path="knowledge-graph" element={<KnowledgeGraphPage />} />
            <Route path="exams" element={<ExamListPage />} />
            <Route path="exams/:id/take" element={<TakeExamPage />} />
            <Route path="attempts/:attemptId/result" element={<ExamResultPage />} />
            <Route path="ai-practice" element={<AIPracticePage />} />
            <Route path="remedial/:sessionId" element={<RemedialSessionPage />} />
            <Route path="discussions" element={<DiscussionsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
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
            <Route path="exams/:id/reports" element={<ExamReportsPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="timetable" element={<TeacherTimetablePage />} />
            <Route path="gradebook" element={<GradebookPage />} />
            <Route path="discussions" element={<DiscussionsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Parent routes (protected) */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.PARENT]} />}>
          <Route path="/parent" element={<ParentLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ParentDashboard />} />
            <Route path="results" element={<ChildResultsPage />} />
            <Route path="timetable" element={<ParentTimetablePage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Admin routes (protected) */}
        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="questions" element={<QuestionBankPage />} />
            <Route path="exams" element={<AdminExamsPage />} />
            <Route path="academic" element={<AcademicPage />} />
            <Route path="timetable" element={<AdminTimetablePage />} />
            <Route path="gradebook" element={<GradebookPage />} />
            <Route path="discussions" element={<AdminDiscussionsPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Route>

        {/* Common routes */}
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/500" element={<ServerErrorPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
