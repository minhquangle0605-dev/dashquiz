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
const iconResults = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
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
const iconTimetable = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);
const iconKnowledgeGraph = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 6a2 2 0 100-4 2 2 0 000 4zm0 0v12m0 0a2 2 0 100 4 2 2 0 000-4zm12-8a2 2 0 100-4 2 2 0 000 4zm0 0a6 6 0 01-6 6H9"
    />
  </svg>
);

export default function ParentLayout() {
  return (
    <DashboardShell
      roleLabel="Parent"
      sidebarClassName="bg-gradient-to-b from-amber-500 via-orange-700 to-amber-950"
      activeNavClassName="bg-white text-amber-900"
      navItems={[
        { to: '/parent/dashboard', label: 'Dashboard', end: true, icon: iconDashboard },
        { to: '/parent/results', label: "Child's Results", icon: iconResults },
        { to: '/parent/knowledge-graph', label: 'Knowledge Graph', icon: iconKnowledgeGraph },
        { to: '/parent/timetable', label: 'Timetable', icon: iconTimetable },
        { to: '/parent/profile', label: 'Profile', icon: iconProfile },
      ]}
    />
  );
}
