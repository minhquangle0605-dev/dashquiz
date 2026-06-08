import { DashboardShell } from './DashboardShell';

const iconDashboard = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
    />
  </svg>
);
const iconExam = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);
const iconProfile = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);
const iconClasses = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM7 12a3 3 0 100-6 3 3 0 000 6z"
    />
  </svg>
);
const iconDiscussions = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
    />
  </svg>
);
const iconNotifications = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.857 17.082a4.5 4.5 0 01-5.714 0M18 8.25a6 6 0 10-12 0c0 7-3 7-3 8.25h18C21 15.25 18 15.25 18 8.25z"
    />
  </svg>
);
const iconTimetable = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);
const iconKnowledge = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 6a3 3 0 116 0 3 3 0 01-6 0zM5 18a3 3 0 116 0 3 3 0 01-6 0zM13 18a3 3 0 116 0 3 3 0 01-6 0zM12 9v3m0 0l-4 3m4-3l4 3"
    />
  </svg>
);

export default function StudentLayout() {
  const navItems = [
    { to: '/student/dashboard', label: 'Dashboard', end: true, icon: iconDashboard },
    { to: '/student/classes', label: 'My Classes', icon: iconClasses },
    { to: '/student/timetable', label: 'Timetable', icon: iconTimetable },
    { to: '/student/exams', label: 'Exams', icon: iconExam },
    { to: '/student/knowledge-graph', label: 'Knowledge Graph', icon: iconKnowledge },
    { to: '/student/discussions', label: 'Discussions', icon: iconDiscussions },
    { to: '/student/notifications', label: 'Notifications', icon: iconNotifications },
    { to: '/student/profile', label: 'Profile', icon: iconProfile },
  ];

  return (
    <DashboardShell
      roleLabel="Student"
      sidebarClassName="bg-gradient-to-b from-indigo-600 via-indigo-800 to-violet-950"
      activeNavClassName="bg-white text-indigo-900"
      navItems={navItems}
      mobileNavItems={[
        navItems[0],
        navItems[1],
        navItems[2],
        navItems[3],
        navItems[5],
      ]}
    />
  );
}
