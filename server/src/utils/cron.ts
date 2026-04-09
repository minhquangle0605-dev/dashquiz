import cron from 'node-cron';
import { prisma } from '../config/database';
import { examService } from '../modules/exam/exam.service';
import { studentExamService } from '../modules/student-exam/studentExam.service';
import { emitExamTimeWarning } from '../socket';
import { logger } from './logger';

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Detect in-progress attempts that are within the 5-minute warning
 * window and emit exam:time-warning to those exam rooms.
 */
async function checkTimeWarnings(): Promise<void> {
  try {
    const WARNING_MINUTES = 5;
    const now = new Date();

    const soonExpiring = await prisma.$queryRaw<
      Array<{ exam_id: number; duration_min: number; title: string }>
    >`
      SELECT DISTINCT e.id AS exam_id, e.duration_min, e.title
      FROM exam_attempts ea
      JOIN exams e ON e.id = ea.exam_id
      WHERE ea.status = 'IN_PROGRESS'
        AND ea.started_at + ((e.duration_min - ${WARNING_MINUTES}) || ' minutes')::interval <= ${now}
        AND ea.started_at + (e.duration_min || ' minutes')::interval > ${now}
    `;

    for (const row of soonExpiring) {
      emitExamTimeWarning(row.exam_id, {
        examId: row.exam_id,
        minutesRemaining: WARNING_MINUTES,
        message: `Còn ${WARNING_MINUTES} phút để hoàn thành bài kiểm tra "${row.title}"!`,
      });
    }

    if (soonExpiring.length > 0) {
      logger.debug(`[Cron] Sent time warnings for ${soonExpiring.length} exam(s)`);
    }
  } catch (error) {
    logger.error('[Cron] Failed to check time warnings:', error);
  }
}

export function startExamScheduleCron(): void {
  scheduledTask = cron.schedule('* * * * *', async () => {
    try {
      const scheduleResult = await examService.processSchedules();
      if (scheduleResult.activated > 0 || scheduleResult.closed > 0) {
        logger.info(
          `[Cron] Exam schedules processed: ${scheduleResult.activated} activated, ${scheduleResult.closed} closed`,
        );
      }
    } catch (error) {
      logger.error('[Cron] Failed to process exam schedules:', error);
    }

    try {
      const autoSubmitResult = await studentExamService.autoSubmitExpiredAttempts();
      if (autoSubmitResult.submitted > 0) {
        logger.info(
          `[Cron] Auto-submitted ${autoSubmitResult.submitted}/${autoSubmitResult.total} expired attempts`,
        );
      }
    } catch (error) {
      logger.error('[Cron] Failed to auto-submit expired attempts:', error);
    }

    await checkTimeWarnings();
  });

  logger.info('[Cron] Exam schedule, auto-submit & time-warning checker started (every minute)');
}

export function stopExamScheduleCron(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('[Cron] Exam schedule checker stopped');
  }
}
