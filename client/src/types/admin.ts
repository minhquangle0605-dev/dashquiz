export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

// DB-stored roles (UserRole enum). PARENT is intentionally absent — it is a
// virtual role granted only via parentPasswordHash login.
export type AdminUserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface AdminUser {
  id: number;
  username: string;
  fullName: string | null;
  phone: string | null;
  avatar: string | null;
  status: UserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  role: AdminUserRole;
  studentProfile?: {
    studentCode: string;
    parentCode: string | null;
    classId: number | null;
  } | null;
  parentProfile?: {
    parentCode: string;
    phoneNumber: string | null;
    _count?: { children: number };
  } | null;
}

export interface CreateUserPayload {
  username?: string;
  password: string;
  fullName: string;
  phone?: string | null;
  role: AdminUserRole;
  accountCode?: string;
  school?: string;
  className?: string;
  classId?: number;
  parentCode?: string;
}

export interface UpdateUserPayload {
  username?: string;
  fullName?: string;
  phone?: string;
  status?: UserStatus;
}

export interface ChangeRolePayload {
  role: AdminUserRole;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
  description: string | null;
  status: number;
  _count?: {
    questions: number;
    exams: number;
    classes: number;
  };
}

export interface UpdateSubjectPayload {
  name?: string;
  description?: string;
  status?: number;
}

export interface AcademicYear {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  _count?: {
    semesters: number;
  };
}

export interface CreateAcademicYearPayload {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

export interface Semester {
  id: number;
  academicYearId: number;
  name: string;
  startDate: string;
  endDate: string;
  academicYear?: AcademicYear;
  _count?: {
    classes: number;
  };
}

export interface CreateSemesterPayload {
  academicYearId: number;
  name: string;
  startDate: string;
  endDate: string;
}

export interface SystemConfig {
  id: number;
  configKey: string;
  configValue: string;
  description: string | null;
  updatedAt: string;
}

export interface UpdateConfigPayload {
  configs: Array<{
    key: string;
    value: string;
    description?: string;
  }>;
}

export interface MonitoringData {
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; percentage: number };
  uptime: number;
  nodeVersion: string;
  platform: string;
  activeConnections?: number;
  requestsPerMinute?: number;
}

export interface ActivityLog {
  id: number;
  userId: number | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    fullName: string | null;
  } | null;
}

export interface Backup {
  id: number;
  filename: string;
  fileSizeMb: number | null;
  createdBy: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  creator?: {
    id: number;
    username: string;
    fullName: string | null;
  };
}

export interface DashboardStats {
  totalUsers: number;
  totalExams: number;
  totalSubjects: number;
  totalQuestions: number;
  usersByRole: Record<string, number>;
  recentActivity: ActivityLog[];
  systemHealth: MonitoringData;
}

export interface RoleOption {
  value: AdminUserRole;
  label: string;
}
