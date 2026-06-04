import JSZip from 'jszip';

// Avoid pulling real MinIO / env / winston into the unit test.
const putObject = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../config/minio', () => ({
  getMinioClient: () => ({ putObject }),
}));
jest.mock('../../../config/env', () => ({
  env: { minio: { bucket: 'test-bucket' } },
}));
jest.mock('../../../utils/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { questionZipService } from '../../../modules/question/question.zip.service';

const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function makeZip(
  questions: unknown,
  images: Record<string, Buffer> = {},
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('questions.json', JSON.stringify(questions));
  for (const [path, buffer] of Object.entries(images)) {
    zip.file(path, buffer);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

afterEach(() => jest.clearAllMocks());

describe('questionZipService', () => {
  describe('importFromZip', () => {
    it('parses a valid multiple-choice bundle with no images', async () => {
      const buffer = await makeZip([
        {
          question_text: 'What is 2 + 2?',
          options: [
            { label: 'A', text: '3' },
            { label: 'B', text: '4' },
            { label: 'C', text: '5' },
            { label: 'D', text: '6' },
          ],
          correct_answer: 'B',
          difficulty: 'easy',
        },
      ]);

      const result = await questionZipService.importFromZip(buffer, 7);

      expect(result.total).toBe(1);
      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(0);
      const q = result.questions[0];
      expect(q.questionType).toBe('SINGLE_CHOICE');
      expect(q.difficulty).toBe(2);
      expect(q.options.find((o) => o.label === 'B')?.isCorrect).toBe(true);
      expect(q.errors).toHaveLength(0);
      expect(putObject).not.toHaveBeenCalled();
    });

    it('flags a question whose correct_answer matches no option, but keeps valid ones', async () => {
      const buffer = await makeZip([
        {
          question_text: 'Bad question',
          options: [
            { label: 'A', text: 'one' },
            { label: 'B', text: 'two' },
          ],
          correct_answer: 'E',
        },
        {
          question_text: 'Good question',
          options: [
            { label: 'A', text: 'one' },
            { label: 'B', text: 'two' },
          ],
          correct_answer: 'A',
        },
      ]);

      const result = await questionZipService.importFromZip(buffer, 7);

      expect(result.total).toBe(2);
      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(1);
      expect(result.questions[0].errors.length).toBeGreaterThan(0);
      expect(result.questions[1].errors).toHaveLength(0);
    });

    it('uploads a referenced image and sets its inline URL', async () => {
      const buffer = await makeZip(
        [
          {
            question_text: 'See the picture',
            question_image: 'images/q1.png',
            options: [
              { label: 'A', text: 'yes' },
              { label: 'B', text: 'no' },
            ],
            correct_answer: 'A',
          },
        ],
        { 'images/q1.png': SAMPLE_PNG },
      );

      const result = await questionZipService.importFromZip(buffer, 7);

      expect(result.invalid).toBe(0);
      expect(result.questions[0].questionImageUrl).toMatch(/\/api\/questions\/images\//);
      expect(putObject).toHaveBeenCalledTimes(1);
    });

    it('reports an error when a referenced image is missing from the ZIP', async () => {
      const buffer = await makeZip([
        {
          question_text: 'Missing image',
          question_image: 'images/nope.png',
          options: [
            { label: 'A', text: 'yes' },
            { label: 'B', text: 'no' },
          ],
          correct_answer: 'A',
        },
      ]);

      const result = await questionZipService.importFromZip(buffer, 7);

      expect(result.invalid).toBe(1);
      expect(result.questions[0].errors.some((e) => /not found/i.test(e))).toBe(true);
      expect(putObject).not.toHaveBeenCalled();
    });

    it('rejects a non-image file referenced as an image', async () => {
      const buffer = await makeZip(
        [
          {
            question_text: 'Fake image',
            question_image: 'images/fake.png',
            options: [
              { label: 'A', text: 'yes' },
              { label: 'B', text: 'no' },
            ],
            correct_answer: 'A',
          },
        ],
        { 'images/fake.png': Buffer.from('this is not really a png file at all') },
      );

      const result = await questionZipService.importFromZip(buffer, 7);

      expect(result.invalid).toBe(1);
      expect(result.questions[0].errors.some((e) => /not a valid/i.test(e))).toBe(true);
      expect(putObject).not.toHaveBeenCalled();
    });

    it('accepts the Moodle-style content_html + per-option is_correct format', async () => {
      const buffer = await makeZip([
        {
          type: 'single_choice',
          content_html: '<p>Which statement is correct?</p>',
          options: [
            { label: 'A', content_html: '<p>Wrong</p>', is_correct: false },
            { label: 'B', content_html: '<p>Correct</p>', is_correct: true },
            { label: 'C', content_html: '<p>Also wrong</p>', is_correct: false },
          ],
          difficulty: 'medium',
        },
      ]);

      const result = await questionZipService.importFromZip(buffer, 7);

      expect(result.invalid).toBe(0);
      const q = result.questions[0];
      expect(q.questionType).toBe('SINGLE_CHOICE');
      expect(q.content).toContain('Which statement is correct?');
      expect(q.options.find((o) => o.label === 'B')?.isCorrect).toBe(true);
      expect(q.options.find((o) => o.label === 'A')?.isCorrect).toBe(false);
    });

    it('rewrites an inline <img> in content_html to a stored URL and uploads once', async () => {
      const buffer = await makeZip(
        [
          {
            type: 'single_choice',
            content_html:
              '<p>See the pyramid</p><img src="images/cau_1.png" />',
            options: [
              { label: 'A', content_html: '<p>Yes</p>', is_correct: true },
              { label: 'B', content_html: '<p>No</p>', is_correct: false },
            ],
          },
        ],
        { 'images/cau_1.png': SAMPLE_PNG },
      );

      const result = await questionZipService.importFromZip(buffer, 7);

      expect(result.invalid).toBe(0);
      const q = result.questions[0];
      expect(q.content).toMatch(/<img[^>]+src="\/api\/questions\/images\//);
      expect(q.content).not.toContain('images/cau_1.png');
      expect(putObject).toHaveBeenCalledTimes(1);
    });

    it('flags an inline image that is missing from the ZIP', async () => {
      const buffer = await makeZip([
        {
          content_html: '<p>Look</p><img src="images/missing.png" />',
          options: [
            { label: 'A', text: 'yes' },
            { label: 'B', text: 'no' },
          ],
          correct_answer: 'A',
        },
      ]);

      const result = await questionZipService.importFromZip(buffer, 7);

      expect(result.invalid).toBe(1);
      expect(result.questions[0].errors.some((e) => /not found/i.test(e))).toBe(true);
    });

    it('throws when questions.json is absent', async () => {
      const zip = new JSZip();
      zip.file('readme.txt', 'no questions here');
      const buffer = await zip.generateAsync({ type: 'nodebuffer' });

      await expect(questionZipService.importFromZip(buffer, 7)).rejects.toThrow(
        /questions\.json/i,
      );
    });

    it('throws on a corrupted ZIP', async () => {
      await expect(
        questionZipService.importFromZip(Buffer.from('not a zip'), 7),
      ).rejects.toThrow(/ZIP/i);
    });
  });

  describe('generateTemplateZip', () => {
    it('produces a re-readable ZIP with questions.json and a valid sample image', async () => {
      const buffer = await questionZipService.generateTemplateZip();
      const zip = await JSZip.loadAsync(buffer);

      const json = zip.file('questions.json');
      expect(json).not.toBeNull();
      const parsed = JSON.parse(await json!.async('string'));
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);

      const sample = zip.file('images/sample.png');
      expect(sample).not.toBeNull();
    });
  });
});
