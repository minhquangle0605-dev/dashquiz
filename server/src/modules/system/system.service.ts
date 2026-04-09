import os from 'os';
import { exec } from 'child_process';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { prisma } from '../../config/database';
import { getMinioClient } from '../../config/minio';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';
import { PAGINATION } from '../../utils/constants';
import type {
  UpdateConfigsInput,
  ListActivityLogsQuery,
  ListBackupsQuery,
} from './system.validation';

function execPromise(cmd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout, stderr });
    });
  });
}

export class SystemService {
  // ═══════════════════════════════════════════════
  // SYSTEM CONFIGS (UC42)
  // ═══════════════════════════════════════════════

  async getConfigs() {
    const configs = await prisma.systemConfig.findMany({
      orderBy: { configKey: 'asc' },
    });

    return {
      success: true,
      message: 'System configs retrieved successfully',
      data: configs,
    };
  }

  async updateConfigs(data: UpdateConfigsInput) {
    const results = await prisma.$transaction(
      data.configs.map((c) =>
        prisma.systemConfig.upsert({
          where: { configKey: c.key },
          create: {
            configKey: c.key,
            configValue: c.value,
            description: c.description ?? null,
          },
          update: {
            configValue: c.value,
            ...(c.description !== undefined && { description: c.description }),
          },
        }),
      ),
    );

    return {
      success: true,
      message: `${results.length} config(s) updated successfully`,
      data: results,
    };
  }

  // ═══════════════════════════════════════════════
  // MONITORING (UC43)
  // ═══════════════════════════════════════════════

  async getMonitoring() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();

    const cpuUsage = cpus.map((cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return ((total - idle) / total) * 100;
    });
    const avgCpuUsage = cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length;

    const [totalUsers, totalExams, totalQuestions] = await Promise.all([
      prisma.user.count(),
      prisma.exam.count(),
      prisma.question.count(),
    ]);

    return {
      success: true,
      message: 'System monitoring data',
      data: {
        system: {
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname(),
          uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
          nodeVersion: process.version,
        },
        cpu: {
          model: cpus[0]?.model ?? 'Unknown',
          cores: cpus.length,
          usagePercent: Math.round(avgCpuUsage * 100) / 100,
        },
        memory: {
          total: `${Math.round(totalMem / 1024 / 1024)} MB`,
          used: `${Math.round(usedMem / 1024 / 1024)} MB`,
          free: `${Math.round(freeMem / 1024 / 1024)} MB`,
          usagePercent: Math.round((usedMem / totalMem) * 10000) / 100,
        },
        process: {
          pid: process.pid,
          uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
        },
        database: {
          totalUsers,
          totalExams,
          totalQuestions,
        },
      },
    };
  }

  // ═══════════════════════════════════════════════
  // ACTIVITY LOGS (UC44)
  // ═══════════════════════════════════════════════

  async listActivityLogs(query: ListActivityLogsQuery) {
    const page = query.page ?? PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(query.limit ?? PAGINATION.DEFAULT_LIMIT, PAGINATION.MAX_LIMIT);
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }
    if (query.entityType) {
      where.entityType = { contains: query.entityType, mode: 'insensitive' };
    }
    if (query.from || query.to) {
      where.createdAt = {} as Record<string, Date>;
      if (query.from) where.createdAt.gte = query.from;
      if (query.to) where.createdAt.lte = query.to;
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, username: true, email: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Activity logs retrieved successfully',
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // ═══════════════════════════════════════════════
  // BACKUP & RESTORE (UC45)
  // ═══════════════════════════════════════════════

  async createBackup(userId: number) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql.gz`;

    const backup = await prisma.backup.create({
      data: {
        filename,
        createdBy: userId,
        status: 'IN_PROGRESS',
      },
    });

    // Run pg_dump in background
    this.runBackupProcess(backup.id, filename).catch((err) => {
      logger.error('Backup process failed:', err);
    });

    return {
      success: true,
      message: 'Backup started',
      data: {
        id: backup.id,
        filename: backup.filename,
        status: backup.status,
        createdAt: backup.createdAt,
      },
    };
  }

  private async runBackupProcess(backupId: number, filename: string) {
    try {
      const dbUrl = env.db.url;
      const pgDumpCmd = `pg_dump "${dbUrl}" --no-owner --no-acl`;

      const { stdout: dumpData } = await execPromise(pgDumpCmd);

      const gzipStream = createGzip();
      const inputStream = Readable.from(Buffer.from(dumpData, 'utf-8'));

      const chunks: Buffer[] = [];
      const collectStream = new (require('stream').PassThrough)();
      collectStream.on('data', (chunk: Buffer) => chunks.push(chunk));

      await pipeline(inputStream, gzipStream, collectStream);

      const gzippedBuffer = Buffer.concat(chunks);
      const fileSizeMb = gzippedBuffer.length / (1024 * 1024);

      const minioClient = getMinioClient();
      const objectName = `backups/${filename}`;
      const uploadStream = Readable.from(gzippedBuffer);

      await minioClient.putObject(
        env.minio.bucket,
        objectName,
        uploadStream,
        gzippedBuffer.length,
        { 'Content-Type': 'application/gzip' },
      );

      await prisma.backup.update({
        where: { id: backupId },
        data: {
          status: 'COMPLETED',
          fileSizeMb: Math.round(fileSizeMb * 100) / 100,
        },
      });

      logger.info(`Backup completed: ${filename} (${fileSizeMb.toFixed(2)} MB)`);
    } catch (error) {
      await prisma.backup.update({
        where: { id: backupId },
        data: { status: 'FAILED' },
      });
      logger.error(`Backup failed for ID ${backupId}:`, error);
      throw error;
    }
  }

  async restoreBackup(backupId: number) {
    const backup = await prisma.backup.findUnique({ where: { id: backupId } });
    if (!backup) {
      throw new AppError('Backup not found', 404);
    }

    if (backup.status !== 'COMPLETED') {
      throw new AppError('Can only restore from completed backups', 400);
    }

    const objectName = `backups/${backup.filename}`;

    try {
      const minioClient = getMinioClient();
      const stream = await minioClient.getObject(env.minio.bucket, objectName);

      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }
      const gzippedBuffer = Buffer.concat(chunks);

      const gunzipStream = createGunzip();
      const inputStream = Readable.from(gzippedBuffer);
      const sqlChunks: Buffer[] = [];
      const collectStream = new (require('stream').PassThrough)();
      collectStream.on('data', (chunk: Buffer) => sqlChunks.push(chunk));

      await pipeline(inputStream, gunzipStream, collectStream);

      const sqlData = Buffer.concat(sqlChunks).toString('utf-8');

      const dbUrl = env.db.url;
      const psqlCmd = `psql "${dbUrl}"`;

      await new Promise<void>((resolve, reject) => {
        const child = exec(psqlCmd, { maxBuffer: 50 * 1024 * 1024 }, (error) => {
          if (error) reject(error);
          else resolve();
        });
        child.stdin?.write(sqlData);
        child.stdin?.end();
      });

      logger.info(`Backup restored successfully: ${backup.filename}`);

      return {
        success: true,
        message: 'Database restored successfully',
        data: { backupId, filename: backup.filename },
      };
    } catch (error) {
      logger.error(`Restore failed for backup ${backupId}:`, error);
      throw new AppError('Restore failed. Check server logs for details.', 500);
    }
  }

  async listBackups(query: ListBackupsQuery) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const skip = (page - 1) * limit;

    const [backups, total] = await Promise.all([
      prisma.backup.findMany({
        include: {
          creator: { select: { id: true, username: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.backup.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Backups retrieved successfully',
      data: backups,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }
}

export const systemService = new SystemService();
