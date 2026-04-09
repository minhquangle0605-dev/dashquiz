import type { PlaceholderJsonResponse } from '../../types/common';

/** Monitoring snapshot for ops dashboards */
export interface MonitoringSnapshot {
  uptime: number;
  memoryUsage: {
    rss: string;
    heapUsed: string;
    heapTotal: string;
  };
  nodeVersion: string;
  platform: string;
}

/**
 * System domain: configs, monitoring, activity logs, backup/restore.
 */
export class SystemService {
  /**
   * Returns public/safe application configuration keys for admin UI.
   */
  async getConfigs(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'System configs — Phase 3' };
  }

  /**
   * Lightweight process metrics (memory, uptime) for health-style admin views.
   */
  async getMonitoring(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'System monitoring' };
  }

  /**
   * Updates mutable system settings (feature flags, SMTP hints) with audit trail.
   */
  async updateConfig(_key: string, _value: unknown): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Update config ${_key} — placeholder` };
  }

  /**
   * Paginated activity log (auth events, admin actions) from Prisma or log store.
   */
  async listActivityLogs(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Activity logs — placeholder' };
  }

  /**
   * Triggers or schedules DB/files backup; returns job id or artifact reference.
   */
  async runBackup(): Promise<PlaceholderJsonResponse> {
    return { success: true, message: 'Backup — placeholder' };
  }

  /**
   * Restores from validated backup artifact (highly restricted operation).
   */
  async runRestore(_backupId: string): Promise<PlaceholderJsonResponse> {
    return { success: true, message: `Restore ${_backupId} — placeholder` };
  }

  /**
   * Internal helper: builds monitoring snapshot (used when exposing metrics again).
   */
  buildMonitoringSnapshot(): MonitoringSnapshot {
    const memUsage = process.memoryUsage();
    return {
      uptime: process.uptime(),
      memoryUsage: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      },
      nodeVersion: process.version,
      platform: process.platform,
    };
  }
}

export const systemService = new SystemService();
