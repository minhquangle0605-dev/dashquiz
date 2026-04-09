import { AiService } from '../../../modules/ai/ai.service';

const aiService = new AiService();

describe('AiService', () => {
  describe('startPractice', () => {
    it('should return success placeholder response', async () => {
      const result = await aiService.startPractice();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Phase 9');
    });
  });

  describe('getNextAdaptiveQuestion', () => {
    it('should return placeholder for next question', async () => {
      const result = await aiService.getNextAdaptiveQuestion('session-1');
      expect(result.success).toBe(true);
    });
  });

  describe('recordPracticeOutcome', () => {
    it('should return placeholder for recording outcome', async () => {
      const result = await aiService.recordPracticeOutcome('session-1', 'q1', true);
      expect(result.success).toBe(true);
    });
  });

  describe('endPracticeSession', () => {
    it('should return placeholder for ending session', async () => {
      const result = await aiService.endPracticeSession('session-1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('session-1');
    });
  });

  describe('buildWrongAnswerPrompt', () => {
    it('should return empty string (placeholder)', async () => {
      const prompt = await aiService.buildWrongAnswerPrompt('attempt-1');
      expect(typeof prompt).toBe('string');
    });
  });
});
