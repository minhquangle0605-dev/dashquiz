import cron from 'node-cron';
import { examService } from '../modules/exam/exam.service';
import { studentExamService } from '../modules/student-exam/studentExam.service';
import { logger } from './logger';

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

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
  });

  logger.info('[Cron] Exam schedule & auto-submit checker started (every minute)');
}

export function stopExamScheduleCron(): void {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('[Cron] Exam schedule checker stopped');
  }
}
