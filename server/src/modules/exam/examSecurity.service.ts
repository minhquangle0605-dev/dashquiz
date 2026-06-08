import net from 'net';
import {
  ExamAttemptEventType,
  ExamSecurityLevel,
  Prisma,
  ProctorReviewDecision,
  SecurityRiskLevel,
  SecuritySessionStatus,
  SecuritySeverity,
} from '@prisma/client';
import { prisma } from '../../config/database';
import { AppError } from '../../middlewares/errorHandler';
import { emitAttemptEvent } from '../../socket';

export interface SecuritySettingsInput {
  securityLevel?: ExamSecurityLevel;
  requireFullscreen?: boolean;
  blockCopyPaste?: boolean;
  blockRightClick?: boolean;
  blockShortcuts?: boolean;
  requireCamera?: boolean;
  requirePreCheck?: boolean;
  allowedIpRanges?: string[] | null;
  maxDevices?: number;
  allowResume?: boolean;
  warningThreshold?: number;
  autoSubmitThreshold?: number | null;
  snapshotIntervalSec?: number | null;
  retentionDays?: number;
}

export interface StudentPrecheckInput {
  deviceId?: string;
  userAgent?: string;
  supportsFullscreen?: boolean;
  cameraPermission?: 'granted' | 'denied' | 'prompt' | 'unknown';
  screenSize?: string;
  timezoneOffsetMin?: number;
}

export interface SecuritySessionInput {
  deviceId: string;
  userAgent?: string;
  fullscreenState?: boolean;
  cameraPermission?: string | null;
  screenSize?: string | null;
}

export interface HeartbeatSecurityInput {
  deviceId?: string;
  fullscreenState?: boolean;
  focusState?: boolean;
  cameraPermission?: string | null;
  screenSize?: string | null;
  answeredCount?: number;
  unansweredCount?: number;
  timeRemainingSec?: number;
  currentQuestionId?: number | null;
}

type EffectiveSecuritySetting = Required<
  Omit<SecuritySettingsInput, 'allowedIpRanges' | 'autoSubmitThreshold' | 'snapshotIntervalSec'>
> & {
  allowedIpRanges: string[];
  autoSubmitThreshold: number | null;
  snapshotIntervalSec: number | null;
};

type AttemptForRisk = {
  id: number;
  examId: number;
  studentId: number;
  student?: { fullName: string | null; username: string | null } | null;
};

const DEFAULT_LEVEL_SETTINGS: Record<ExamSecurityLevel, EffectiveSecuritySetting> = {
  LOW: {
    securityLevel: ExamSecurityLevel.LOW,
    requireFullscreen: false,
    blockCopyPaste: false,
    blockRightClick: false,
    blockShortcuts: false,
    requireCamera: false,
    requirePreCheck: false,
    allowedIpRanges: [],
    maxDevices: 2,
    allowResume: true,
    warningThreshold: 25,
    autoSubmitThreshold: null,
    snapshotIntervalSec: null,
    retentionDays: 14,
  },
  MEDIUM: {
    securityLevel: ExamSecurityLevel.MEDIUM,
    requireFullscreen: true,
    blockCopyPaste: true,
    blockRightClick: true,
    blockShortcuts: true,
    requireCamera: false,
    requirePreCheck: true,
    allowedIpRanges: [],
    maxDevices: 1,
    allowResume: true,
    warningThreshold: 15,
    autoSubmitThreshold: 100,
    snapshotIntervalSec: null,
    retentionDays: 30,
  },
  HIGH: {
    securityLevel: ExamSecurityLevel.HIGH,
    requireFullscreen: true,
    blockCopyPaste: true,
    blockRightClick: true,
    blockShortcuts: true,
    requireCamera: false,
    requirePreCheck: true,
    allowedIpRanges: [],
    maxDevices: 1,
    allowResume: true,
    warningThreshold: 15,
    autoSubmitThreshold: 80,
    snapshotIntervalSec: null,
    retentionDays: 45,
  },
  LOCKDOWN: {
    securityLevel: ExamSecurityLevel.LOCKDOWN,
    requireFullscreen: true,
    blockCopyPaste: true,
    blockRightClick: true,
    blockShortcuts: true,
    requireCamera: true,
    requirePreCheck: true,
    allowedIpRanges: [],
    maxDevices: 1,
    allowResume: false,
    warningThreshold: 15,
    autoSubmitThreshold: 70,
    snapshotIntervalSec: 180,
    retentionDays: 60,
  },
};

const EVENT_BASE_POINTS: Partial<Record<ExamAttemptEventType, number>> = {
  [ExamAttemptEventType.TAB_HIDDEN]: 8,
  [ExamAttemptEventType.WINDOW_BLUR]: 8,
  [ExamAttemptEventType.FULLSCREEN_EXITED]: 10,
  [ExamAttemptEventType.COPY]: 8,
  [ExamAttemptEventType.PASTE]: 8,
  [ExamAttemptEventType.CUT]: 8,
  [ExamAttemptEventType.CONTEXT_MENU]: 4,
  [ExamAttemptEventType.SHORTCUT_BLOCKED]: 6,
  [ExamAttemptEventType.OFFLINE]: 4,
  [ExamAttemptEventType.CAMERA_PERMISSION_MISSING]: 20,
  [ExamAttemptEventType.DEVICE_CHANGED]: 20,
  [ExamAttemptEventType.AUTO_SUBMITTED]: 100,
};

const EVENT_MESSAGES: Partial<Record<ExamAttemptEventType, string>> = {
  [ExamAttemptEventType.TAB_HIDDEN]: 'Student switched tabs or hid the exam page',
  [ExamAttemptEventType.WINDOW_BLUR]: 'Exam window lost focus',
  [ExamAttemptEventType.FULLSCREEN_EXITED]: 'Student exited fullscreen mode',
  [ExamAttemptEventType.COPY]: 'Copy action was attempted',
  [ExamAttemptEventType.PASTE]: 'Paste action was attempted',
  [ExamAttemptEventType.CUT]: 'Cut action was attempted',
  [ExamAttemptEventType.CONTEXT_MENU]: 'Right-click menu was opened',
  [ExamAttemptEventType.SHORTCUT_BLOCKED]: 'A restricted keyboard shortcut was blocked',
  [ExamAttemptEventType.OFFLINE]: 'Student went offline during the exam',
  [ExamAttemptEventType.CAMERA_PERMISSION_MISSING]: 'Required camera permission is missing',
  [ExamAttemptEventType.DEVICE_CHANGED]: 'Attempt moved to a different device or browser session',
  [ExamAttemptEventType.AUTO_SUBMITTED]: 'Attempt was automatically submitted by policy or timer',
};

function normalizeAllowedIpRanges(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function buildSettingsPayload(
  settings: SecuritySettingsInput | null | undefined,
): EffectiveSecuritySetting {
  const level = settings?.securityLevel ?? ExamSecurityLevel.MEDIUM;
  const defaults = DEFAULT_LEVEL_SETTINGS[level] ?? DEFAULT_LEVEL_SETTINGS.MEDIUM;

  return {
    ...defaults,
    ...settings,
    securityLevel: level,
    allowedIpRanges: normalizeAllowedIpRanges(settings?.allowedIpRanges),
    maxDevices: Math.max(1, Math.min(10, Number(settings?.maxDevices ?? defaults.maxDevices))),
    warningThreshold: Math.max(1, Math.min(100, Number(settings?.warningThreshold ?? defaults.warningThreshold))),
    autoSubmitThreshold:
      settings?.autoSubmitThreshold === null
        ? null
        : settings?.autoSubmitThreshold === undefined
          ? defaults.autoSubmitThreshold
          : Math.max(1, Math.min(100, Number(settings.autoSubmitThreshold))),
    snapshotIntervalSec:
      settings?.snapshotIntervalSec === null || settings?.snapshotIntervalSec === undefined
        ? null
        : Math.max(30, Math.min(3600, Number(settings.snapshotIntervalSec))),
    retentionDays: Math.max(1, Math.min(365, Number(settings?.retentionDays ?? defaults.retentionDays))),
  };
}

function toSettingsInputJson(settings: EffectiveSecuritySetting): Prisma.InputJsonValue {
  return settings.allowedIpRanges as Prisma.InputJsonValue;
}

function toSettingsResponse(
  row:
    | {
        id?: number;
        examId?: number;
        securityLevel: ExamSecurityLevel;
        requireFullscreen: boolean;
        blockCopyPaste: boolean;
        blockRightClick: boolean;
        blockShortcuts: boolean;
        requireCamera: boolean;
        requirePreCheck: boolean;
        allowedIpRanges: Prisma.JsonValue | null;
        maxDevices: number;
        allowResume: boolean;
        warningThreshold: number;
        autoSubmitThreshold: number | null;
        snapshotIntervalSec: number | null;
        retentionDays: number;
        createdAt?: Date;
        updatedAt?: Date;
      }
    | null,
  examId?: number,
) {
  const payload = buildSettingsPayload(
    row
      ? {
          securityLevel: row.securityLevel,
          requireFullscreen: row.requireFullscreen,
          blockCopyPaste: row.blockCopyPaste,
          blockRightClick: row.blockRightClick,
          blockShortcuts: row.blockShortcuts,
          requireCamera: row.requireCamera,
          requirePreCheck: row.requirePreCheck,
          allowedIpRanges: normalizeAllowedIpRanges(row.allowedIpRanges),
          maxDevices: row.maxDevices,
          allowResume: row.allowResume,
          warningThreshold: row.warningThreshold,
          autoSubmitThreshold: row.autoSubmitThreshold,
          snapshotIntervalSec: row.snapshotIntervalSec,
          retentionDays: row.retentionDays,
        }
      : null,
  );

  return {
    id: row?.id ?? null,
    examId: row?.examId ?? examId ?? null,
    ...payload,
    createdAt: row?.createdAt ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

function normalizeIp(ip: string | null | undefined): string {
  if (!ip) return 'unknown';
  return ip.replace(/^::ffff:/, '').trim();
}

function ipv4ToInt(ip: string): number | null {
  const normalized = normalizeIp(ip);
  if (net.isIP(normalized) !== 4) return null;
  return normalized.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function ipv4MatchesCidr(ip: string, cidr: string): boolean {
  const [base, maskBitsRaw] = cidr.split('/');
  const maskBits = Number(maskBitsRaw);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null || !Number.isInteger(maskBits) || maskBits < 0 || maskBits > 32) {
    return false;
  }
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function ipAllowed(ipAddress: string, allowedIpRanges: string[]): boolean {
  if (allowedIpRanges.length === 0) return true;
  const ip = normalizeIp(ipAddress);
  return allowedIpRanges.some((range) => {
    if (range.includes('/')) return ipv4MatchesCidr(ip, range);
    return normalizeIp(range) === ip;
  });
}

function riskLevelFromScore(score: number): SecurityRiskLevel {
  if (score >= 80) return SecurityRiskLevel.CRITICAL;
  if (score >= 60) return SecurityRiskLevel.HIGH;
  if (score >= 35) return SecurityRiskLevel.MEDIUM;
  if (score >= 15) return SecurityRiskLevel.WATCH;
  return SecurityRiskLevel.LOW;
}

function severityFromPoints(points: number): SecuritySeverity {
  if (points >= 80) return SecuritySeverity.CRITICAL;
  if (points >= 20) return SecuritySeverity.HIGH;
  if (points >= 8) return SecuritySeverity.MEDIUM;
  return SecuritySeverity.LOW;
}

function computeRiskSummary(violations: Array<{ riskPoints: number; reviewStatus?: string }>) {
  const active = violations.filter((v) => v.reviewStatus !== 'FALSE_POSITIVE' && v.reviewStatus !== 'DISMISSED');
  const score = Math.min(100, active.reduce((total, violation) => total + violation.riskPoints, 0));
  return { riskScore: score, riskLevel: riskLevelFromScore(score) };
}

export class ExamSecurityService {
  async getEffectiveSettings(examId: number) {
    const row = await prisma.examSecuritySetting.findUnique({ where: { examId } });
    return buildSettingsPayload(
      row
        ? {
            securityLevel: row.securityLevel,
            requireFullscreen: row.requireFullscreen,
            blockCopyPaste: row.blockCopyPaste,
            blockRightClick: row.blockRightClick,
            blockShortcuts: row.blockShortcuts,
            requireCamera: row.requireCamera,
            requirePreCheck: row.requirePreCheck,
            allowedIpRanges: normalizeAllowedIpRanges(row.allowedIpRanges),
            maxDevices: row.maxDevices,
            allowResume: row.allowResume,
            warningThreshold: row.warningThreshold,
            autoSubmitThreshold: row.autoSubmitThreshold,
            snapshotIntervalSec: row.snapshotIntervalSec,
            retentionDays: row.retentionDays,
          }
        : null,
    );
  }

  async validateStartAccess(examId: number, ipAddress: string) {
    const settings = await this.getEffectiveSettings(examId);
    if (!ipAllowed(ipAddress, settings.allowedIpRanges)) {
      throw new AppError('Your current network is not allowed for this exam', 403);
    }
    return settings;
  }

  async getExamSecuritySettings(examId: number, userId: number, role: string) {
    await this.ensureTeacherCanAccessExam(examId, userId, role);
    const row = await prisma.examSecuritySetting.findUnique({ where: { examId } });
    return {
      success: true,
      message: 'Exam security settings retrieved successfully',
      data: toSettingsResponse(row, examId),
    };
  }

  async updateExamSecuritySettings(
    examId: number,
    input: SecuritySettingsInput,
    userId: number,
    role: string,
  ) {
    await this.ensureTeacherCanAccessExam(examId, userId, role);
    const settings = buildSettingsPayload(input);
    const row = await prisma.examSecuritySetting.upsert({
      where: { examId },
      create: {
        examId,
        securityLevel: settings.securityLevel,
        requireFullscreen: settings.requireFullscreen,
        blockCopyPaste: settings.blockCopyPaste,
        blockRightClick: settings.blockRightClick,
        blockShortcuts: settings.blockShortcuts,
        requireCamera: settings.requireCamera,
        requirePreCheck: settings.requirePreCheck,
        allowedIpRanges: toSettingsInputJson(settings),
        maxDevices: settings.maxDevices,
        allowResume: settings.allowResume,
        warningThreshold: settings.warningThreshold,
        autoSubmitThreshold: settings.autoSubmitThreshold,
        snapshotIntervalSec: settings.snapshotIntervalSec,
        retentionDays: settings.retentionDays,
      },
      update: {
        securityLevel: settings.securityLevel,
        requireFullscreen: settings.requireFullscreen,
        blockCopyPaste: settings.blockCopyPaste,
        blockRightClick: settings.blockRightClick,
        blockShortcuts: settings.blockShortcuts,
        requireCamera: settings.requireCamera,
        requirePreCheck: settings.requirePreCheck,
        allowedIpRanges: toSettingsInputJson(settings),
        maxDevices: settings.maxDevices,
        allowResume: settings.allowResume,
        warningThreshold: settings.warningThreshold,
        autoSubmitThreshold: settings.autoSubmitThreshold,
        snapshotIntervalSec: settings.snapshotIntervalSec,
        retentionDays: settings.retentionDays,
      },
    });

    return {
      success: true,
      message: 'Exam security settings saved successfully',
      data: toSettingsResponse(row, examId),
    };
  }

  async runStudentPrecheck(
    examId: number,
    studentId: number,
    input: StudentPrecheckInput,
    ipAddress: string,
  ) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        status: true,
        title: true,
        isPractice: true,
        createdBy: true,
        examAssignments: { select: { classId: true } },
        examSchedules: {
          select: { classId: true, status: true, startTime: true, endTime: true },
        },
      },
    });
    if (!exam) throw new AppError('Exam not found', 404);

    const settings = await this.getEffectiveSettings(examId);
    const now = new Date();
    // Personal knowledge-graph practice (owned by this student) skips the
    // class-assignment + schedule gates — it is self-launched, not assigned.
    const isOwnerPractice = exam.isPractice && exam.createdBy === studentId;
    const assignedClassIds = exam.examAssignments.map((a) => a.classId);
    const enrollments = await prisma.classStudent.findMany({
      where: { studentId, classId: { in: assignedClassIds } },
      select: { classId: true },
    });
    const studentClassIds = enrollments.map((e) => e.classId);
    const hasAssignment = isOwnerPractice || studentClassIds.length > 0;
    const hasPerClassSchedule = exam.examSchedules.some((s) => s.classId !== null);
    const activeSchedule = exam.examSchedules.some(
      (s) =>
        s.status === 'ACTIVE' &&
        s.startTime <= now &&
        s.endTime > now &&
        (!hasPerClassSchedule || s.classId === null || (s.classId !== null && studentClassIds.includes(s.classId))),
    );
    const scheduleOk =
      isOwnerPractice ||
      (hasPerClassSchedule ? activeSchedule : exam.status === 'PUBLISHED' || activeSchedule);
    const ipOk = ipAllowed(ipAddress, settings.allowedIpRanges);
    const fullscreenOk = !settings.requireFullscreen || input.supportsFullscreen !== false;
    const cameraOk = !settings.requireCamera || input.cameraPermission === 'granted';

    const checks = [
      {
        key: 'assignment',
        label: 'Exam assignment',
        status: hasAssignment ? 'passed' : 'failed',
        required: true,
        message: hasAssignment ? 'You are assigned to this exam.' : 'You are not assigned to this exam.',
      },
      {
        key: 'schedule',
        label: 'Exam window',
        status: scheduleOk ? 'passed' : 'failed',
        required: true,
        message: scheduleOk ? 'The exam is currently available.' : 'This exam is not available right now.',
      },
      {
        key: 'ip',
        label: 'Network',
        status: ipOk ? 'passed' : 'failed',
        required: settings.allowedIpRanges.length > 0,
        message: ipOk ? 'Your network is allowed.' : 'Your current network is not allowed for this exam.',
      },
      {
        key: 'fullscreen',
        label: 'Fullscreen support',
        status: fullscreenOk ? 'passed' : 'failed',
        required: settings.requireFullscreen,
        message: fullscreenOk ? 'Fullscreen is supported.' : 'This browser cannot enter fullscreen mode.',
      },
      {
        key: 'camera',
        label: 'Camera permission',
        status: cameraOk ? 'passed' : 'failed',
        required: settings.requireCamera,
        message: cameraOk ? 'Camera permission is ready.' : 'Camera permission is required for this exam.',
      },
    ];

    const canStart = checks.every((check) => check.status === 'passed' || !check.required);

    return {
      success: true,
      message: 'Exam pre-check completed',
      data: {
        canStart,
        serverTime: now,
        ipAddress: normalizeIp(ipAddress),
        settings: toSettingsResponse({
          ...settings,
          id: undefined,
          examId,
          allowedIpRanges: settings.allowedIpRanges as Prisma.JsonValue,
        }),
        checks,
      },
    };
  }

  async createOrUpdateSecuritySession(
    attemptId: number,
    studentId: number,
    input: SecuritySessionInput,
    ipAddress: string,
  ) {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { fullName: true, username: true } },
      },
    });
    if (!attempt) throw new AppError('Attempt not found', 404);
    if (attempt.studentId !== studentId) throw new AppError('Access denied', 403);
    if (attempt.status !== 'IN_PROGRESS') throw new AppError('This attempt is no longer active', 400);

    const settings = await this.getEffectiveSettings(attempt.examId);
    if (!ipAllowed(ipAddress, settings.allowedIpRanges)) {
      throw new AppError('Your current network is not allowed for this exam', 403);
    }

    const existing = await prisma.attemptSecuritySession.findUnique({ where: { attemptId } });
    if (existing && existing.deviceId !== input.deviceId) {
      const event = await prisma.examAttemptEvent.create({
        data: {
          attemptId,
          type: ExamAttemptEventType.DEVICE_CHANGED,
          metadata: {
            previousDeviceId: existing.deviceId,
            nextDeviceId: input.deviceId,
            ipAddress: normalizeIp(ipAddress),
          },
        },
      });
      await this.normalizeAttemptEvent(event, attempt);
      emitAttemptEvent(attempt.examId, {
        attemptId,
        studentId: attempt.studentId,
        studentName: attempt.student.fullName || attempt.student.username || 'Student',
        type: event.type,
        occurredAt: event.occurredAt,
        clientElapsedSec: event.clientElapsedSec,
        questionId: event.questionId,
        metadata: event.metadata,
      });

      if (!settings.allowResume && settings.maxDevices <= 1) {
        throw new AppError('This exam is locked to the original device session', 409);
      }
    }

    const session = await prisma.attemptSecuritySession.upsert({
      where: { attemptId },
      create: {
        attemptId,
        studentId,
        deviceId: input.deviceId,
        userAgent: input.userAgent ?? null,
        ipAddress: normalizeIp(ipAddress),
        fullscreenState: input.fullscreenState ?? false,
        cameraPermission: input.cameraPermission ?? null,
        screenSize: input.screenSize ?? null,
      },
      update: {
        deviceId: input.deviceId,
        userAgent: input.userAgent ?? existing?.userAgent ?? null,
        ipAddress: normalizeIp(ipAddress),
        lastHeartbeatAt: new Date(),
        fullscreenState: input.fullscreenState ?? existing?.fullscreenState ?? false,
        cameraPermission: input.cameraPermission ?? existing?.cameraPermission ?? null,
        screenSize: input.screenSize ?? existing?.screenSize ?? null,
        status: SecuritySessionStatus.ACTIVE,
      },
    });

    return {
      success: true,
      message: 'Security session is active',
      data: session,
    };
  }

  async touchSecuritySession(
    attemptId: number,
    studentId: number,
    input: HeartbeatSecurityInput,
    ipAddress: string,
  ) {
    const session = await prisma.attemptSecuritySession.findUnique({ where: { attemptId } });
    if (!session) return null;
    if (session.studentId !== studentId) throw new AppError('Access denied', 403);

    const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId }, select: { examId: true } });
    if (!attempt) throw new AppError('Attempt not found', 404);
    const settings = await this.getEffectiveSettings(attempt.examId);
    if (!ipAllowed(ipAddress, settings.allowedIpRanges)) {
      throw new AppError('Your current network is not allowed for this exam', 403);
    }

    return prisma.attemptSecuritySession.update({
      where: { attemptId },
      data: {
        ipAddress: normalizeIp(ipAddress),
        lastHeartbeatAt: new Date(),
        fullscreenState: input.fullscreenState ?? session.fullscreenState,
        cameraPermission: input.cameraPermission ?? session.cameraPermission,
        screenSize: input.screenSize ?? session.screenSize,
        status: SecuritySessionStatus.ACTIVE,
      },
    });
  }

  async closeSecuritySession(attemptId: number) {
    await prisma.attemptSecuritySession.updateMany({
      where: { attemptId, status: { not: SecuritySessionStatus.CLOSED } },
      data: { status: SecuritySessionStatus.CLOSED },
    });
  }

  async normalizeAttemptEvent(
    event: {
      id: number;
      attemptId: number;
      type: ExamAttemptEventType;
      occurredAt: Date;
      metadata: Prisma.JsonValue | null;
    },
    attempt?: AttemptForRisk,
  ) {
    const basePoints = EVENT_BASE_POINTS[event.type] ?? 0;
    if (basePoints <= 0) return null;

    const sameTypeCount = await prisma.attemptViolation.count({
      where: {
        attemptId: event.attemptId,
        eventType: event.type,
        occurredAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });
    const patternBonus = sameTypeCount >= 5 ? 10 : sameTypeCount >= 2 ? 5 : 0;
    const riskPoints = Math.min(100, basePoints + patternBonus);
    const violation = await prisma.attemptViolation.upsert({
      where: { eventId: event.id },
      create: {
        attemptId: event.attemptId,
        eventId: event.id,
        eventType: event.type,
        severity: severityFromPoints(riskPoints),
        riskPoints,
        message: EVENT_MESSAGES[event.type] ?? 'Suspicious exam activity was detected',
        metadata: event.metadata ?? Prisma.JsonNull,
        occurredAt: event.occurredAt,
      },
      update: {
        severity: severityFromPoints(riskPoints),
        riskPoints,
        metadata: event.metadata ?? Prisma.JsonNull,
      },
    });

    if (attempt) {
      const summary = await this.getAttemptRiskSummary(event.attemptId);
      return { violation, ...summary };
    }
    return { violation };
  }

  async getAttemptRiskSummary(attemptId: number) {
    const violations = await prisma.attemptViolation.findMany({
      where: { attemptId },
      select: { riskPoints: true, reviewStatus: true },
    });
    return computeRiskSummary(violations);
  }

  async getEvidenceReport(examId: number, attemptId: number, userId: number, role: string) {
    await this.ensureTeacherCanAccessExam(examId, userId, role);
    const attempt = await prisma.examAttempt.findFirst({
      where: { id: attemptId, examId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            username: true,
            studentProfile: { select: { studentCode: true, homeroomClassName: true } },
          },
        },
        securitySession: true,
        attemptEvents: {
          orderBy: { occurredAt: 'asc' },
          select: {
            id: true,
            type: true,
            occurredAt: true,
            clientElapsedSec: true,
            questionId: true,
            metadata: true,
          },
        },
        attemptViolations: {
          orderBy: { occurredAt: 'asc' },
          include: { reviewer: { select: { id: true, fullName: true, username: true } } },
        },
        proctorReview: {
          include: { reviewer: { select: { id: true, fullName: true, username: true } } },
        },
      },
    });
    if (!attempt) throw new AppError('Attempt not found', 404);

    const riskSummary = computeRiskSummary(attempt.attemptViolations);
    const eventCounts = attempt.attemptEvents.reduce<Record<string, number>>((counts, event) => {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
      return counts;
    }, {});

    return {
      success: true,
      message: 'Attempt evidence retrieved successfully',
      data: {
        attempt: {
          id: attempt.id,
          status: attempt.status,
          startedAt: attempt.startedAt,
          submittedAt: attempt.submittedAt,
          isAutoSubmitted: attempt.isAutoSubmitted,
          totalScore: attempt.totalScore === null ? null : Number(attempt.totalScore),
          timeSpentSec: attempt.timeSpentSec,
        },
        student: {
          id: attempt.student.id,
          name: attempt.student.fullName,
          username: attempt.student.username,
          studentCode: attempt.student.studentProfile?.studentCode ?? null,
          homeroomClassName: attempt.student.studentProfile?.homeroomClassName ?? null,
        },
        risk: riskSummary,
        eventCounts,
        securitySession: attempt.securitySession,
        timeline: attempt.attemptEvents,
        violations: attempt.attemptViolations,
        review: attempt.proctorReview,
      },
    };
  }

  async saveProctorReview(
    examId: number,
    attemptId: number,
    input: {
      decision: ProctorReviewDecision;
      finalRiskLevel: SecurityRiskLevel;
      summary?: string | null;
    },
    userId: number,
    role: string,
  ) {
    await this.ensureTeacherCanAccessExam(examId, userId, role);
    const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId, examId } });
    if (!attempt) throw new AppError('Attempt not found', 404);

    const review = await prisma.proctorReview.upsert({
      where: { attemptId },
      create: {
        attemptId,
        reviewerId: userId,
        decision: input.decision,
        finalRiskLevel: input.finalRiskLevel,
        summary: input.summary ?? null,
      },
      update: {
        reviewerId: userId,
        decision: input.decision,
        finalRiskLevel: input.finalRiskLevel,
        summary: input.summary ?? null,
      },
    });

    return {
      success: true,
      message: 'Proctor review saved successfully',
      data: review,
    };
  }

  private async ensureTeacherCanAccessExam(examId: number, userId: number, role: string) {
    const exam = await prisma.exam.findFirst({
      where: { id: examId, ...(role === 'admin' ? {} : { createdBy: userId }) },
      select: { id: true },
    });
    if (!exam) throw new AppError('Exam not found or unauthorized', 404);
  }
}

export const examSecurityService = new ExamSecurityService();
