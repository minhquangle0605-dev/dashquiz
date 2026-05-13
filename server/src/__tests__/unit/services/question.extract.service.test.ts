import { extractTextFromDocument, regexExtract } from '../../../modules/question/question.extract.service';
import JSZip from 'jszip';

describe('QuestionExtractService GIFT parser', () => {
  async function makeDocxBuffer(documentXml: string): Promise<Buffer> {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types" />');
    zip.file('word/document.xml', documentXml);
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  it('extracts GIFT short-answer questions with multiple accepted answers', () => {
    const questions = regexExtract(
      [
        'Who discovered America? {=Christopher Columbus =Columbus}',
        'Capital of Vietnam is {=Ha Noi =Hanoi}.',
      ].join('\n'),
    );

    expect(questions).toHaveLength(2);
    expect(questions[0]).toMatchObject({
      content: 'Who discovered America?',
      questionType: 'SHORT_ANSWER',
      options: [
        { label: 'A', content: 'Christopher Columbus', isCorrect: true },
        { label: 'B', content: 'Columbus', isCorrect: true },
      ],
    });
    expect(questions[1]).toMatchObject({
      content: 'Capital of Vietnam is',
      questionType: 'SHORT_ANSWER',
      options: [
        { label: 'A', content: 'Ha Noi', isCorrect: true },
        { label: 'B', content: 'Hanoi', isCorrect: true },
      ],
    });
  });

  it('extracts GIFT matching questions and stores pairs in the app matching format', () => {
    const questions = regexExtract(
      [
        'Match each country to its capital: {',
        '=Vietnam -> Hanoi',
        '=Japan -> Tokyo',
        '=France -> Paris',
        '}',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      content: 'Match each country to its capital:',
      questionType: 'MATCHING',
      options: [
        { label: 'A', content: 'Vietnam => Hanoi', isCorrect: true },
        { label: 'B', content: 'Japan => Tokyo', isCorrect: true },
        { label: 'C', content: 'France => Paris', isCorrect: true },
      ],
    });
  });

  it('continues to support the older template matching syntax', () => {
    const questions = regexExtract(
      [
        'Cau 1: Type: Matching',
        'Vietnam => Hanoi',
        'Japan => Tokyo',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]?.questionType).toBe('MATCHING');
    expect(questions[0]?.options).toEqual([
      { label: 'A', content: 'Vietnam => Hanoi', isCorrect: true },
      { label: 'B', content: 'Japan => Tokyo', isCorrect: true },
    ]);
  });

  it('detects Dap an short-answer questions with interval alternatives', () => {
    const questions = regexExtract(
      [
        'Cau 5: Tim tap nghiem S cua bat phuong trinh x^2 - 5x + 6 <= 0. (Viet duoi dang doan [a;b], khong chua dau cach)',
        'Dap an: [2;3]; [2; 3]',
        'Giai thich: Tam thuc bac hai co hai nghiem phan biet la 2 va 3.',
        'Do kho: 2',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      questionType: 'SHORT_ANSWER',
      difficulty: 2,
      options: [
        { label: 'A', content: '[2;3]', isCorrect: true },
        { label: 'B', content: '[2; 3]', isCorrect: true },
      ],
    });
    expect(questions[0]?.errors).toEqual([]);
  });

  it('treats a single-letter Dap an as short answer when no choices exist', () => {
    const questions = regexExtract(
      [
        'Cau 7: Ky hieu hoa hoc cua Kali la gi?',
        'Dap an: K',
        'Do kho: 1',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      questionType: 'SHORT_ANSWER',
      options: [{ label: 'A', content: 'K', isCorrect: true }],
    });
    expect(questions[0]?.errors).toEqual([]);
  });

  it('still treats letter answers as multiple choice when choices exist', () => {
    const questions = regexExtract(
      [
        'Cau 8: Select prime numbers.',
        'A. 2',
        'B. 4',
        'C. 5',
        'D. 9',
        'Dap an: A,C',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      questionType: 'MULTIPLE_CHOICE',
      options: [
        { label: 'A', content: '2', isCorrect: true },
        { label: 'B', content: '4', isCorrect: false },
        { label: 'C', content: '5', isCorrect: true },
        { label: 'D', content: '9', isCorrect: false },
      ],
    });
  });

  it('supports answer keys before choices for choice questions', () => {
    const questions = regexExtract(
      [
        'Cau 9: Which one is even?',
        'Dap an: B',
        'A. 3',
        'B. 4',
        'C. 5',
        'D. 7',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      questionType: 'SINGLE_CHOICE',
      options: [
        { label: 'A', content: '3', isCorrect: false },
        { label: 'B', content: '4', isCorrect: true },
        { label: 'C', content: '5', isCorrect: false },
        { label: 'D', content: '7', isCorrect: false },
      ],
    });
  });

  it('keeps equations intact when parsing template matching pairs', () => {
    const questions = regexExtract(
      [
        'Cau 6: Hay ghep phuong trinh o cot trai voi ten goi cua duong bieu dien tuong ung.',
        'Type: Matching',
        'x^2 + y^2 - 2x + 4y - 4 = 0 => Duong tron',
        'y = -x^2 + 3x - 2 => Parabol',
        '2x - 3y + 1 = 0 => Duong thang',
        'Do kho: 2',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      questionType: 'MATCHING',
      difficulty: 2,
      options: [
        { label: 'A', content: 'x^2 + y^2 - 2x + 4y - 4 = 0 => Duong tron', isCorrect: true },
        { label: 'B', content: 'y = -x^2 + 3x - 2 => Parabol', isCorrect: true },
        { label: 'C', content: '2x - 3y + 1 = 0 => Duong thang', isCorrect: true },
      ],
    });
  });

  it('parses matching pairs with arrow or spaced pipe delimiters without splitting math symbols', () => {
    const questions = regexExtract(
      [
        'Cau 10: Type: Matching',
        'x = 1 -> Nghiem don',
        '|x| = 2 | Hai nghiem',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]?.options).toEqual([
      { label: 'A', content: 'x = 1 => Nghiem don', isCorrect: true },
      { label: 'B', content: '|x| = 2 => Hai nghiem', isCorrect: true },
    ]);
  });

  it('keeps equations intact in GIFT matching pairs', () => {
    const questions = regexExtract(
      [
        'Match equations to names: {',
        '=x^2 + y^2 = 1 -> Circle',
        '=y = 2x + 1 -> Line',
        '}',
      ].join('\n'),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({
      questionType: 'MATCHING',
      options: [
        { label: 'A', content: 'x^2 + y^2 = 1 => Circle', isCorrect: true },
        { label: 'B', content: 'y = 2x + 1 => Line', isCorrect: true },
      ],
    });
  });

  it('reads plain GIFT text files', async () => {
    const text = await extractTextFromDocument(
      Buffer.from('Capital of Vietnam is {=Ha Noi =Hanoi}', 'utf8'),
      'text/plain',
      'questions.gift',
    );

    expect(text).toBe('Capital of Vietnam is {=Ha Noi =Hanoi}');
  });

  it('keeps Office Math equations from DOCX as LaTeX during extraction', async () => {
    const buffer = await makeDocxBuffer(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
        <w:body>
          <w:p>
            <w:r><w:t>Cau 1: Tinh </w:t></w:r>
            <m:oMath>
              <m:rad>
                <m:e><m:r><m:t>x</m:t></m:r></m:e>
              </m:rad>
            </m:oMath>
            <w:r><w:t> khi x = 4.</w:t></w:r>
          </w:p>
          <w:p><w:r><w:t>A. 1.5</w:t></w:r></w:p>
          <w:p>
            <w:r><w:t>B. </w:t></w:r>
            <m:oMath>
              <m:sSup>
                <m:e><m:r><m:t>2</m:t></m:r></m:e>
                <m:sup><m:r><m:t>2</m:t></m:r></m:sup>
              </m:sSup>
            </m:oMath>
          </w:p>
          <w:p><w:r><w:t>Dap an: B</w:t></w:r></w:p>
        </w:body>
      </w:document>`,
    );

    const text = await extractTextFromDocument(
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'math.docx',
    );

    expect(text).toContain('Cau 1: Tinh $\\sqrt{x}$ khi x = 4.');
    expect(text).toContain('B. ${2}^{2}$');

    const questions = regexExtract(text);
    expect(questions[0]).toMatchObject({
      content: 'Tinh $\\sqrt{x}$ khi x = 4.',
      options: [
        { label: 'A', content: '1.5', isCorrect: false },
        { label: 'B', content: '${2}^{2}$', isCorrect: true },
      ],
    });
  });

  it('does not remove math multiplication markers when stripping import formatting', () => {
    const questions = regexExtract(
      [
        'Cau 11: Tinh 2 * x khi x = 3.',
        'A. 2 * 3 = 6',
        'B. 2 + 3 = 5',
        'Dap an: A',
      ].join('\n'),
    );

    expect(questions[0]?.content).toBe('Tinh 2 * x khi x = 3.');
    expect(questions[0]?.options[0]?.content).toBe('2 * 3 = 6');
  });
});
