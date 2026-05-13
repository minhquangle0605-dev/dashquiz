import mammoth from 'mammoth';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import PDFDocument from 'pdfkit';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AppError } from '../../middlewares/errorHandler';

export type ExtractedQuestionKind =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'MATCHING';

export interface ExtractedOption {
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface ExtractedQuestion {
  content: string;
  questionType: ExtractedQuestionKind;
  difficulty: number;
  explanation: string | null;
  options: ExtractedOption[];
  warnings: string[];
  errors: string[];
  sourceLine: number | null;
  sourceText: string;
}

export interface ExtractionResult {
  rawTextPreview: string;
  source: 'openai' | 'regex';
  questions: ExtractedQuestion[];
  warnings: string[];
  templateRules: string[];
}

const DOCX_MIMETYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const PDF_MIMETYPES = new Set(['application/pdf']);
const TEXT_MIMETYPES = new Set(['text/plain', 'application/gift']);

const QUESTION_MARKER =
  /^(?:\s*)(?:C[âa]u|Question|Q|B[àa]i|Problem)\s*\d+\s*[\.:)]|^\s*\d+\s*[\.:)]\s+/i;

const OPTION_MARKER = /^\s*(\*?\s*)?([A-Z])\s*[\.\):\-]\s*(.*)$/i;
const ANSWER_MARKER =
  /^\s*(?:D[áa]p\s*[áa]n|Answer|Correct|Key|D\/A|DA|D\.A|Dap an dung)\s*[:.\-]\s*(.*)$/i;
const EXPLANATION_MARKER =
  /^\s*(?:Gi[ảa]i\s*th[íi]ch|Explanation|L[ờo]i\s*gi[ảa]i|Solution|Ch[úu]\s*th[íi]ch)\s*[:.\-]\s*(.*)$/i;
const TYPE_MARKER =
  /^\s*(?:Lo[ạa]i|Type|Question\s*type)\s*[:.\-]\s*(.*)$/i;
const DIFFICULTY_MARKER =
  /^\s*(?:D[ộo]\s*kh[óo]|Difficulty)\s*[:.\-]\s*([1-5])\b/i;

const TEMPLATE_RULES = [
  'Multiple choice: start each item with "Cau 1:" or "Question 1:". Put choices on separate lines as "A.", "B.", "C.", "D.". Mark correct answers with "*A." / "*B." or add "Dap an: B". Use "Dap an: A,C" for multiple correct choices.',
  'True/False: write "[T]" or "[F]" after the question, or use "Dap an: T/F". The importer stores this as two options: True and False.',
  'Short answer: use Moodle GIFT syntax, for example: Capital of Vietnam is {=Ha Noi =Hanoi}. The older "Dap an: ..." format is still supported.',
  'Matching: use Moodle GIFT syntax with one pair per line: { =Vietnam -> Hanoi =Japan -> Tokyo }. The older "Type: Matching" plus "left => right" format is still supported.',
  'Optional lines: "Giai thich: ..." for explanation and "Do kho: 1-5" for difficulty.',
  'DOCX: bolding a whole option or the option label also marks it as correct. Plain .txt/.gift files are supported for GIFT short-answer and matching questions. PDF scan/images need OCR and may not extract text reliably.',
];

export function isSupportedDocumentMime(mime: string, filename = ''): boolean {
  if (DOCX_MIMETYPES.has(mime) || PDF_MIMETYPES.has(mime) || TEXT_MIMETYPES.has(mime)) return true;
  const lower = filename.toLowerCase();
  return (
    lower.endsWith('.docx') ||
    lower.endsWith('.doc') ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.gift')
  );
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function nodeLocalName(node: unknown): string {
  const value = node as { localName?: string; nodeName?: string } | null;
  return String(value?.localName || value?.nodeName || '').replace(/^.*:/, '');
}

function childElements(node: unknown): unknown[] {
  const value = node as { childNodes?: { length: number; item: (index: number) => unknown } } | null;
  if (!value?.childNodes) return [];

  const elements: unknown[] = [];
  for (let i = 0; i < value.childNodes.length; i++) {
    const child = value.childNodes.item(i) as { nodeType?: number };
    if (child?.nodeType === 1) elements.push(child);
  }
  return elements;
}

function firstChildElement(node: unknown, localName: string): unknown | null {
  return childElements(node).find((child) => nodeLocalName(child) === localName) ?? null;
}

function attrByLocalName(node: unknown, localName: string): string | null {
  const value = node as {
    attributes?: { length: number; item: (index: number) => { localName?: string; nodeName?: string; value?: string } | null };
  } | null;
  if (!value?.attributes) return null;

  for (let i = 0; i < value.attributes.length; i++) {
    const attr = value.attributes.item(i);
    if (attr && nodeLocalName(attr) === localName) return attr.value ?? null;
  }
  return null;
}

function textOfNode(node: unknown): string {
  const value = node as { textContent?: string } | null;
  return value?.textContent ?? '';
}

function isWordRunBold(run: unknown): boolean {
  const props = firstChildElement(run, 'rPr');
  if (!props) return false;
  return childElements(props).some((child) => {
    const local = nodeLocalName(child);
    return local === 'b' || local === 'bCs';
  });
}

function latexText(value: string): string {
  return value
    .replace(/−/g, '-')
    .replace(/×/g, '\\times ')
    .replace(/÷/g, '\\div ')
    .replace(/≤/g, '\\le ')
    .replace(/≥/g, '\\ge ')
    .replace(/≠/g, '\\ne ')
    .replace(/≈/g, '\\approx ')
    .replace(/±/g, '\\pm ')
    .replace(/∞/g, '\\infty ')
    .replace(/π/g, '\\pi ')
    .replace(/θ/g, '\\theta ')
    .replace(/°/g, '^{\\circ}');
}

function renderMathChild(node: unknown, localName: string): string {
  const child = firstChildElement(node, localName);
  return child ? renderOmmlMath(child) : '';
}

function renderMathChildren(node: unknown): string {
  return childElements(node)
    .filter((child) => !/Pr$/.test(nodeLocalName(child)) && nodeLocalName(child) !== 'ctrlPr')
    .map(renderOmmlMath)
    .join('');
}

function renderDelimiterMath(node: unknown): string {
  const props = firstChildElement(node, 'dPr');
  const begin = props ? attrByLocalName(firstChildElement(props, 'begChr'), 'val') || '(' : '(';
  const end = props ? attrByLocalName(firstChildElement(props, 'endChr'), 'val') || ')' : ')';
  const body = renderMathChild(node, 'e') || renderMathChildren(node);
  return `\\left${begin}${body}\\right${end}`;
}

function renderNaryMath(node: unknown): string {
  const props = firstChildElement(node, 'naryPr');
  const chr = props ? attrByLocalName(firstChildElement(props, 'chr'), 'val') : null;
  const opMap: Record<string, string> = {
    '∑': '\\sum',
    '∫': '\\int',
    '∏': '\\prod',
    '⋂': '\\bigcap',
    '⋃': '\\bigcup',
  };
  const operator = (chr && opMap[chr]) || latexText(chr || '\\sum');
  const sub = renderMathChild(node, 'sub');
  const sup = renderMathChild(node, 'sup');
  const body = renderMathChild(node, 'e');
  return `${operator}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''} ${body}`.trim();
}

function renderMatrixMath(node: unknown): string {
  const rows = childElements(node)
    .filter((child) => nodeLocalName(child) === 'mr')
    .map((row) =>
      childElements(row)
        .filter((cell) => nodeLocalName(cell) === 'e')
        .map(renderOmmlMath)
        .join(' & '),
    )
    .filter(Boolean);
  return rows.length > 0 ? `\\begin{matrix}${rows.join('\\\\')}\\end{matrix}` : '';
}

function renderAccentMath(node: unknown): string {
  const props = firstChildElement(node, 'accPr');
  const chr = props ? attrByLocalName(firstChildElement(props, 'chr'), 'val') : null;
  const body = renderMathChild(node, 'e');
  if (!body) return '';
  if (chr === '⃗' || chr === '→' || chr === '↔') return `\\vec{${body}}`;
  if (chr === '^') return `\\hat{${body}}`;
  if (chr === '~') return `\\tilde{${body}}`;
  return `\\overset{${latexText(chr || '')}}{${body}}`;
}

function renderOmmlMath(node: unknown): string {
  const local = nodeLocalName(node);

  switch (local) {
    case 'oMath':
    case 'oMathPara':
    case 'e':
    case 'num':
    case 'den':
    case 'sub':
    case 'sup':
    case 'deg':
    case 'box':
    case 'borderBox':
      return renderMathChildren(node);
    case 'r':
      return renderMathChildren(node);
    case 't':
      return latexText(textOfNode(node));
    case 'f': {
      const numerator = renderMathChild(node, 'num');
      const denominator = renderMathChild(node, 'den');
      return `\\frac{${numerator}}{${denominator}}`;
    }
    case 'rad': {
      const degree = renderMathChild(node, 'deg');
      const body = renderMathChild(node, 'e');
      return degree ? `\\sqrt[${degree}]{${body}}` : `\\sqrt{${body}}`;
    }
    case 'sSup':
      return `{${renderMathChild(node, 'e')}}^{${renderMathChild(node, 'sup')}}`;
    case 'sSub':
      return `{${renderMathChild(node, 'e')}}_{${renderMathChild(node, 'sub')}}`;
    case 'sSubSup':
      return `{${renderMathChild(node, 'e')}}_{${renderMathChild(node, 'sub')}}^{${renderMathChild(node, 'sup')}}`;
    case 'acc':
      return renderAccentMath(node);
    case 'bar':
      return `\\overline{${renderMathChild(node, 'e')}}`;
    case 'd':
      return renderDelimiterMath(node);
    case 'nary':
      return renderNaryMath(node);
    case 'func': {
      const name = renderMathChild(node, 'fName').trim();
      const arg = renderMathChild(node, 'e');
      return /^[A-Za-z]+$/.test(name) ? `\\${name} ${arg}` : `${name}${arg}`;
    }
    case 'fName':
      return renderMathChildren(node);
    case 'm':
      return renderMatrixMath(node);
    case 'limLow':
      return `\\underset{${renderMathChild(node, 'lim')}}{${renderMathChild(node, 'e')}}`;
    case 'limUpp':
      return `\\overset{${renderMathChild(node, 'lim')}}{${renderMathChild(node, 'e')}}`;
    case 'groupChr':
      return renderMathChild(node, 'e');
    default:
      return renderMathChildren(node);
  }
}

function renderDocxXmlNode(node: unknown): string {
  const local = nodeLocalName(node);

  if (local === 'oMath' || local === 'oMathPara') {
    const math = renderOmmlMath(node).replace(/\s+/g, ' ').trim();
    return math ? ` $${math}$ ` : '';
  }

  if (local === 't') return textOfNode(node);
  if (local === 'tab') return ' ';
  if (local === 'br' || local === 'cr') return '\n';

  if (local === 'r') {
    const text = childElements(node)
      .filter((child) => nodeLocalName(child) !== 'rPr')
      .map(renderDocxXmlNode)
      .join('');
    return isWordRunBold(node) && text.trim() ? `**${text}**` : text;
  }

  if (local === 'p') {
    return `${childElements(node).map(renderDocxXmlNode).join('')}\n`;
  }

  if (local === 'tc') {
    return `${childElements(node).map(renderDocxXmlNode).join('').trim()}\t`;
  }

  if (local === 'tr') {
    return `${childElements(node).map(renderDocxXmlNode).join('').trim()}\n`;
  }

  if (local === 'tbl') {
    return `${childElements(node).map(renderDocxXmlNode).join('').trim()}\n`;
  }

  return childElements(node).map(renderDocxXmlNode).join('');
}

async function extractTextFromDocxXml(buffer: Buffer): Promise<string | null> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) return null;

  const doc = new DOMParser().parseFromString(documentXml, 'application/xml');
  const body = doc.getElementsByTagName('w:body')[0] || doc.documentElement;
  const text = renderDocxXmlNode(body);
  return cleanText(text);
}

function htmlToMarkedText(html: string): string {
  let out = html;
  out = out.replace(/<\s*br\s*\/?>/gi, '\n');
  out = out.replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n');
  out = out.replace(/<\s*(p|div|li|h[1-6]|tr|table|tbody|thead|ul|ol)\b[^>]*>/gi, '\n');
  out = out.replace(/<\s*(strong|b)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/gi, '**$2**');
  out = out.replace(/<\s*(em|i)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/gi, '_$2_');
  out = out.replace(/<\s*u\b[^>]*>([\s\S]*?)<\/\s*u\s*>/gi, '__$1__');
  out = out.replace(/<[^>]+>/g, '');
  return cleanText(decodeHtmlEntities(out));
}

function cleanText(text: string): string {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(line)) return false;
      if (/^trang\s+\d+(\s*\/\s*\d+)?$/i.test(line)) return false;
      return true;
    });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const xmlText = await extractTextFromDocxXml(buffer);
    if (xmlText) return xmlText;
  } catch (err) {
    logger.warn(`DOCX XML extraction failed, falling back to mammoth: ${(err as Error).message}`);
  }

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: ['u => u'],
      includeDefaultStyleMap: true,
    },
  );
  return htmlToMarkedText(result.value || '');
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2 ships as ESM; require it dynamically so this file can stay CJS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('pdf-parse');
  const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
  if (!PDFParse) {
    throw new AppError('pdf-parse module is not available', 500);
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return cleanText(result?.text || '');
}

export async function extractTextFromDocument(
  buffer: Buffer,
  mimetype: string,
  filename = '',
): Promise<string> {
  const lower = filename.toLowerCase();
  if (DOCX_MIMETYPES.has(mimetype) || lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return extractTextFromDocx(buffer);
  }
  if (PDF_MIMETYPES.has(mimetype) || lower.endsWith('.pdf')) {
    return extractTextFromPdf(buffer);
  }
  if (TEXT_MIMETYPES.has(mimetype) || lower.endsWith('.txt') || lower.endsWith('.gift')) {
    return cleanText(buffer.toString('utf8'));
  }
  throw new AppError('Unsupported file type. Please upload a .docx, .pdf, .txt, or .gift file.', 400);
}

function lineNumberOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function splitIntoQuestionBlocks(text: string): Array<{ text: string; sourceLine: number }> {
  const normalized = text
    .replace(/([^\n])((?:C[âa]u|Question|Q|B[àa]i|Problem)\s*\d+\s*[\.:)])/gi, '$1\n$2')
    .trim();

  const matches = [...normalized.matchAll(new RegExp(QUESTION_MARKER.source, 'gim'))];
  if (matches.length === 0) {
    return normalized ? [{ text: normalized, sourceLine: 1 }] : [];
  }

  return matches.map((match, idx) => {
    const start = match.index ?? 0;
    const end = matches[idx + 1]?.index ?? normalized.length;
    return {
      text: normalized.slice(start, end).trim(),
      sourceLine: lineNumberOf(normalized, start),
    };
  });
}

function stripMarkdownMarkers(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\*\s+(?=\S)/g, '')
    .replace(/\s+\(\*\)\s*$/g, '')
    .trim();
}

function stripQuestionMarker(line: string): string {
  return line
    .replace(/^(?:C[âa]u|Question|Q|B[àa]i|Problem)?\s*\d+\s*[\.:)]\s*/i, '')
    .trim();
}

function normalizeAnswerToken(value: string): string {
  const token = value.trim().toUpperCase();
  if (['TRUE', 'T', 'DUNG', 'DÚNG', 'ĐÚNG', 'ĐUNG'].includes(token)) return 'T';
  if (['FALSE', 'F', 'SAI'].includes(token)) return 'F';
  return token;
}

function normalizeClassifierText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function splitTopLevelDelimited(value: string, delimiters: Set<string>): string[] {
  const parts: string[] = [];
  let current = '';
  const stack: string[] = [];
  let escaped = false;
  let quote: string | null = null;
  const matchingClose: Record<string, string> = {
    '[': ']',
    '(': ')',
    '{': '}',
  };

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      current += char;
      quote = char;
      continue;
    }

    if (char === '[' || char === '(' || char === '{') {
      stack.push(matchingClose[char]);
      current += char;
      continue;
    }

    if (stack.length > 0 && char === stack[stack.length - 1]) {
      stack.pop();
      current += char;
      continue;
    }

    if (stack.length === 0 && delimiters.has(char)) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitAnswerTokens(answer: string): string[] {
  return splitTopLevelDelimited(answer.replace(/\band\b/gi, ','), new Set([',', ';', '/', '|']))
    .map((part) => normalizeAnswerToken(part.replace(/[\[\]\(\)]/g, '').trim()))
    .filter(Boolean);
}

function splitShortAnswerAlternatives(answer: string): string[] {
  return splitTopLevelDelimited(answer, new Set([';']));
}

function looksLikeChoiceAnswer(rawAnswer: string, tokens: string[]): boolean {
  if (tokens.length === 0 || !tokens.every((token) => /^[A-Z]$/.test(token))) return false;
  const compact = rawAnswer.replace(/[\s\[\]\(\)]/g, '').toUpperCase();
  return /^[A-Z](?:[,;\/|][A-Z])*$/.test(compact);
}

function looksLikeTrueFalseAnswer(tokens: string[]): boolean {
  return tokens.length > 0 && tokens.every((token) => token === 'T' || token === 'F');
}

function isBoldMarked(value: string): boolean {
  return /\*\*[^*]+\*\*/.test(value) || /__[^_]+__/.test(value);
}

function parseOptionLine(line: string): { label: string; content: string; markedCorrect: boolean } | null {
  const match = line.match(OPTION_MARKER);
  if (!match) return null;

  const prefix = match[1] || '';
  const label = match[2].toUpperCase();
  let content = match[3].trim();
  const markedCorrect =
    prefix.includes('*') ||
    content.startsWith('*') ||
    /\(\*\)\s*$/.test(content) ||
    /[*]\s*$/.test(content) ||
    /[✓✔]\s*$/.test(content) ||
    isBoldMarked(line);

  content = content
    .replace(/^\*\s*/, '')
    .replace(/\(\*\)\s*$/, '')
    .replace(/[✓✔]\s*$/, '');

  return {
    label,
    content: stripMarkdownMarkers(content),
    markedCorrect,
  };
}

function detectQuestionType(
  explicitType: string | null,
  stem: string,
  options: ExtractedOption[],
  answerTokens: string[],
  shortAnswers: string[],
  pairLines: string[],
): ExtractedQuestionKind {
  const type = normalizeClassifierText(explicitType || '');
  if (/matching|match|gh[eé]p|noi|n[ốo]i/.test(type)) return 'MATCHING';
  if (/short|text|tu luan|t[ựu]\s*lu[ậa]n|dien|di[ềe]n/.test(type)) return 'SHORT_ANSWER';
  if (/true|false|dung|sai|đúng|sai/.test(type)) return 'TRUE_FALSE';
  if (/multiple/.test(type)) return 'MULTIPLE_CHOICE';
  if (pairLines.length > 0 && options.length === 0) return 'MATCHING';
  if (/\[(T|F|TRUE|FALSE|DUNG|SAI|ĐÚNG)\]/i.test(stem)) return 'TRUE_FALSE';
  if (answerTokens.some((t) => t === 'T' || t === 'F') && options.length === 0) return 'TRUE_FALSE';
  if (options.length === 0 && shortAnswers.length > 0) return 'SHORT_ANSWER';
  if (options.length === 0 && answerTokens.length > 0) return 'SHORT_ANSWER';
  if (answerTokens.length > 1 || options.filter((o) => o.isCorrect).length > 1) {
    return 'MULTIPLE_CHOICE';
  }
  return 'SINGLE_CHOICE';
}

function labelFromIndex(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function unescapeGiftText(value: string): string {
  return value
    .replace(/\\([{}=~#:\\])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripGiftTitle(value: string): string {
  return value.replace(/^::[^:\n]+::\s*/, '').trim();
}

function stripGiftFeedback(value: string): string {
  return value.replace(/\s*#.*$/, '').trim();
}

function splitGiftAnswerEntries(body: string): string[] {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const answerLines = lines.filter((line) => line.startsWith('='));
  if (lines.length > 1 && answerLines.length > 0 && answerLines.length === lines.length) {
    return answerLines
      .map((line) => unescapeGiftText(stripGiftFeedback(line.slice(1).trim())))
      .filter(Boolean);
  }

  const entries: string[] = [];
  let current: string | null = null;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    const previous = i > 0 ? body[i - 1] : '';
    const startsEntry =
      char === '=' && previous !== '\\' && (current === null || previous === '' || /\s/.test(previous));

    if (startsEntry) {
      if (current !== null && current.trim()) entries.push(current.trim());
      current = '';
      continue;
    }

    if (current !== null) current += char;
  }

  if (current !== null && current.trim()) entries.push(current.trim());
  return entries.map((entry) => unescapeGiftText(stripGiftFeedback(entry))).filter(Boolean);
}

function findGiftClose(text: string, openIndex: number): number {
  for (let i = openIndex + 1; i < text.length; i++) {
    if (text[i] === '}' && text[i - 1] !== '\\') return i;
  }
  return -1;
}

function findGiftStemStart(text: string, openIndex: number, minStart: number): number {
  const lineStart = text.lastIndexOf('\n', openIndex - 1) + 1;
  const currentLine = text.slice(lineStart, openIndex).trim();
  if (currentLine) return Math.max(lineStart, minStart);

  const beforeCurrentLine = text.slice(minStart, Math.max(minStart, lineStart - 1));
  const previousLineBreak = beforeCurrentLine.lastIndexOf('\n');
  return previousLineBreak >= 0 ? minStart + previousLineBreak + 1 : minStart;
}

function parseGiftBlock(
  text: string,
  openIndex: number,
  closeIndex: number,
  stemStart: number,
): ExtractedQuestion | null {
  const rawStem = stripGiftTitle(text.slice(stemStart, openIndex).trim());
  const stem = stripMarkdownMarkers(unescapeGiftText(rawStem.replace(/\s+/g, ' ')));
  const body = text.slice(openIndex + 1, closeIndex).trim();

  if (!stem || !body || body.includes('~')) return null;

  const entries = splitGiftAnswerEntries(body);
  if (entries.length === 0) return null;

  const warnings: string[] = [];
  const errors: string[] = [];
  const matchingPairs = entries
    .map((entry) => splitMatchingPair(entry))
    .filter((pair): pair is [string, string] => pair !== null);

  const isMatching = matchingPairs.length > 0 && matchingPairs.length === entries.length;
  const questionType: ExtractedQuestionKind = isMatching ? 'MATCHING' : 'SHORT_ANSWER';

  let options: ExtractedOption[];
  if (isMatching) {
    options = matchingPairs.map(([left, right], index) => ({
      label: labelFromIndex(index),
      content: `${left} => ${right}`,
      isCorrect: true,
    }));
    if (options.length < 2) errors.push('Matching question needs at least two GIFT pairs.');
  } else {
    options = entries.map((answer, index) => ({
      label: labelFromIndex(index),
      content: answer,
      isCorrect: true,
    }));
    if (options.length < 1) errors.push('Short answer question needs at least one GIFT answer.');
  }

  warnings.push(`${questionType.replace('_', ' ')} was detected from GIFT syntax.`);

  return {
    content: stem,
    questionType,
    difficulty: 3,
    explanation: null,
    options,
    warnings,
    errors,
    sourceLine: lineNumberOf(text, stemStart),
    sourceText: text.slice(stemStart, closeIndex + 1).slice(0, 700),
  };
}

function parseGiftQuestions(text: string): Array<{ question: ExtractedQuestion; start: number; end: number }> {
  const questions: Array<{ question: ExtractedQuestion; start: number; end: number }> = [];
  let cursor = 0;
  let searchIndex = 0;

  while (searchIndex < text.length) {
    const openIndex = text.indexOf('{', searchIndex);
    if (openIndex < 0) break;

    const closeIndex = findGiftClose(text, openIndex);
    if (closeIndex < 0) break;

    const stemStart = findGiftStemStart(text, openIndex, cursor);
    const question = parseGiftBlock(text, openIndex, closeIndex, stemStart);
    if (question) {
      let end = closeIndex + 1;
      if (text[end] === '.') end += 1;
      questions.push({ question, start: stemStart, end });
      cursor = end;
      searchIndex = end;
    } else {
      searchIndex = closeIndex + 1;
    }
  }

  return questions;
}

function splitMatchingPair(line: string): [string, string] | null {
  const cleaned = stripMarkdownMarkers(line).replace(/^\s*[-*]\s*/, '');
  const delimiter = cleaned.match(/\s*(?:=>|->)\s*|\s+\|\s+/);
  if (!delimiter || delimiter.index === undefined) return null;
  const left = cleaned
    .slice(0, delimiter.index)
    .replace(/^[A-Z]\s*[\.\):\-]\s*/i, '')
    .trim();
  const right = cleaned.slice(delimiter.index + delimiter[0].length).trim();
  if (!left || !right) return null;
  return [left, right];
}

function parseQuestionBlock(block: { text: string; sourceLine: number }): ExtractedQuestion | null {
  const rawLines = block.text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (rawLines.length === 0) return null;

  const warnings: string[] = [];
  const errors: string[] = [];
  const stemParts: string[] = [stripQuestionMarker(rawLines[0])];
  const options: ExtractedOption[] = [];
  const pairLines: string[] = [];
  const answerTokens: string[] = [];
  const pendingChoiceAnswers: Array<{ rawAnswer: string; tokens: string[] }> = [];
  const shortAnswers: string[] = [];
  const explanationParts: string[] = [];
  let explicitType: string | null = null;
  let difficulty = 3;
  let captureExplanation = false;
  let lastOption: ExtractedOption | null = null;

  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    const typeMatch = line.match(TYPE_MARKER);
    if (typeMatch) {
      explicitType = typeMatch[1].trim();
      captureExplanation = false;
      continue;
    }

    const diffMatch = line.match(DIFFICULTY_MARKER);
    if (diffMatch) {
      difficulty = Number(diffMatch[1]);
      captureExplanation = false;
      continue;
    }

    const answerMatch = line.match(ANSWER_MARKER);
    if (answerMatch) {
      const rawAnswer = stripMarkdownMarkers(answerMatch[1]);
      const tokens = splitAnswerTokens(rawAnswer);
      if (looksLikeTrueFalseAnswer(tokens)) {
        answerTokens.push(...tokens);
      } else if (options.length > 0 && looksLikeChoiceAnswer(rawAnswer, tokens)) {
        answerTokens.push(...tokens);
      } else if (looksLikeChoiceAnswer(rawAnswer, tokens)) {
        pendingChoiceAnswers.push({ rawAnswer, tokens });
      } else if (rawAnswer.trim()) {
        shortAnswers.push(...splitShortAnswerAlternatives(rawAnswer));
      }
      captureExplanation = false;
      continue;
    }

    const explanationMatch = line.match(EXPLANATION_MARKER);
    if (explanationMatch) {
      captureExplanation = true;
      if (explanationMatch[1]) explanationParts.push(stripMarkdownMarkers(explanationMatch[1]));
      continue;
    }

    if (captureExplanation) {
      explanationParts.push(stripMarkdownMarkers(line));
      continue;
    }

    const option = parseOptionLine(line);
    if (option) {
      const extractedOption: ExtractedOption = {
        label: option.label,
        content: option.content,
        isCorrect: option.markedCorrect,
      };
      options.push(extractedOption);
      lastOption = extractedOption;
      continue;
    }

    const pair = splitMatchingPair(line);
    if (pair) {
      pairLines.push(`${pair[0]} => ${pair[1]}`);
      lastOption = null;
      continue;
    }

    if (lastOption && options.length > 0) {
      lastOption.content = `${lastOption.content} ${stripMarkdownMarkers(line)}`.trim();
    } else {
      stemParts.push(stripMarkdownMarkers(line));
    }
  }

  let stem = stripMarkdownMarkers(stemParts.join(' ').replace(/\s+/g, ' ').trim());
  if (pendingChoiceAnswers.length > 0) {
    if (options.length > 0) {
      pendingChoiceAnswers.forEach((answer) => answerTokens.push(...answer.tokens));
    } else {
      pendingChoiceAnswers.forEach((answer) => {
        shortAnswers.push(...splitShortAnswerAlternatives(answer.rawAnswer));
      });
    }
  }
  const tfInline = stem.match(/\[(T|F|TRUE|FALSE|DUNG|SAI|ĐÚNG)\]/i);
  if (tfInline) {
    answerTokens.push(normalizeAnswerToken(tfInline[1]));
    stem = stem.replace(/\[(T|F|TRUE|FALSE|DUNG|SAI|ĐÚNG)\]/i, '').trim();
  }

  if (!stem) {
    errors.push('Question content is empty.');
  }

  const questionType = detectQuestionType(
    explicitType,
    stem,
    options,
    answerTokens,
    shortAnswers,
    pairLines,
  );
  let normalizedOptions: ExtractedOption[] = options;

  if (questionType === 'MATCHING') {
    normalizedOptions = pairLines.map((line, idx) => ({
      label: labelFromIndex(idx),
      content: line,
      isCorrect: true,
    }));
  } else if (questionType === 'TRUE_FALSE') {
    const correct = answerTokens.find((t) => t === 'T' || t === 'F');
    normalizedOptions = [
      { label: 'A', content: 'True', isCorrect: correct === 'T' },
      { label: 'B', content: 'False', isCorrect: correct === 'F' },
    ];
  } else if (questionType === 'SHORT_ANSWER') {
    normalizedOptions = shortAnswers.map((answer, idx) => ({
      label: labelFromIndex(idx),
      content: answer,
      isCorrect: true,
    }));
  } else {
    const answerSet = new Set(answerTokens.filter((token) => /^[A-Z]$/.test(token)));
    if (answerSet.size > 0) {
      normalizedOptions = options.map((option) => ({
        ...option,
        isCorrect: answerSet.has(option.label),
      }));
    }
  }

  if (questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') {
    if (normalizedOptions.length < 2) {
      errors.push('At least two answer options are required.');
    }
    if (normalizedOptions.some((option) => !option.content.trim())) {
      errors.push('One or more options are empty.');
    }
    const correctCount = normalizedOptions.filter((option) => option.isCorrect).length;
    if (questionType === 'SINGLE_CHOICE' && correctCount !== 1) {
      errors.push('Exactly one correct option is required.');
    }
    if (questionType === 'MULTIPLE_CHOICE' && correctCount < 1) {
      errors.push('At least one correct option is required.');
    }
  }

  if (questionType === 'TRUE_FALSE') {
    if (normalizedOptions.filter((option) => option.isCorrect).length !== 1) {
      errors.push('True/False answer must be marked with [T], [F], or "Dap an: T/F".');
    }
  }

  if (questionType === 'SHORT_ANSWER' && normalizedOptions.length === 0) {
    errors.push('Short answer question needs at least one "Dap an:" value.');
  }

  if (questionType === 'MATCHING' && normalizedOptions.length < 2) {
    errors.push('Matching question needs at least two "left => right" pairs.');
  }

  if (questionType !== 'SINGLE_CHOICE' && questionType !== 'MULTIPLE_CHOICE') {
    warnings.push(`${questionType.replace('_', ' ')} was detected from template markers.`);
  }

  return {
    content: stem,
    questionType,
    difficulty,
    explanation: explanationParts.join(' ').trim() || null,
    options: normalizedOptions,
    warnings,
    errors,
    sourceLine: block.sourceLine,
    sourceText: block.text.slice(0, 700),
  };
}

export function regexExtract(text: string): ExtractedQuestion[] {
  const giftQuestions = parseGiftQuestions(text);
  if (giftQuestions.length === 0) {
    return splitIntoQuestionBlocks(text)
      .map(parseQuestionBlock)
      .filter((q): q is ExtractedQuestion => q !== null);
  }

  let remainingText = text;
  [...giftQuestions]
    .sort((a, b) => b.start - a.start)
    .forEach((gift) => {
      remainingText = `${remainingText.slice(0, gift.start)}\n${remainingText.slice(gift.end)}`;
    });

  const templateQuestions = splitIntoQuestionBlocks(remainingText)
    .map(parseQuestionBlock)
    .filter((q): q is ExtractedQuestion => q !== null)
    .filter((q) => q.content.trim() && q.options.length > 0);

  return [...giftQuestions.map((gift) => gift.question), ...templateQuestions].sort(
    (a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0),
  );
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function openaiExtract(text: string): Promise<ExtractedQuestion[] | null> {
  if (!env.openai.apiKey) return null;

  const MAX_CHARS = 18000;
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const systemPrompt = [
    'Convert raw Vietnamese or English exam text into JSON questions.',
    'Return JSON only with this shape:',
    '{"questions":[{"content":"...","questionType":"SINGLE_CHOICE|MULTIPLE_CHOICE|TRUE_FALSE|SHORT_ANSWER|MATCHING","options":[{"label":"A","content":"...","isCorrect":true|false}],"explanation":null,"difficulty":1,"warnings":[],"errors":[]}]}',
    'For matching options, content must be "left => right".',
    'For short answers, options are acceptable answer strings with isCorrect=true.',
    'Preserve all math notation exactly, including LaTeX delimited by $, radicals, exponents, decimals, degree signs, vector notation, and Unicode math symbols.',
    'Do not invent correct answers. If missing, keep isCorrect=false and add an error.',
    'Return raw JSON with no markdown.',
  ].join('\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmed },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn(`OpenAI extraction failed (${response.status})`);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { questions?: unknown };
    if (!parsed || !Array.isArray(parsed.questions)) return null;

    return (parsed.questions as Array<Record<string, unknown>>)
      .map((raw, index) => normalizeAiQuestion(raw, index))
      .filter((q): q is ExtractedQuestion => q !== null);
  } catch (err) {
    logger.warn(`OpenAI extraction error: ${(err as Error).message}`);
    return null;
  }
}

function normalizeAiQuestion(raw: Record<string, unknown>, index: number): ExtractedQuestion | null {
  const content = String(raw.content || '').trim();
  if (!content) return null;

  const allowedTypes: ExtractedQuestionKind[] = [
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'TRUE_FALSE',
    'SHORT_ANSWER',
    'MATCHING',
  ];
  const rawType = String(raw.questionType || 'SINGLE_CHOICE').toUpperCase() as ExtractedQuestionKind;
  const questionType = allowedTypes.includes(rawType) ? rawType : 'SINGLE_CHOICE';
  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  const options = rawOptions.map((opt, idx) => {
    const value = (opt || {}) as Record<string, unknown>;
    return {
      label: String(value.label || labelFromIndex(idx)).slice(0, 1).toUpperCase(),
      content: String(value.content || '').trim(),
      isCorrect: Boolean(value.isCorrect),
    };
  });

  let difficulty = Number(raw.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    difficulty = 3;
  }

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map((w) => String(w)).filter(Boolean)
    : [];
  const errors = Array.isArray(raw.errors)
    ? raw.errors.map((e) => String(e)).filter(Boolean)
    : [];

  return {
    content,
    questionType,
    difficulty,
    explanation:
      typeof raw.explanation === 'string' && raw.explanation.trim()
        ? raw.explanation.trim()
        : null,
    options,
    warnings,
    errors,
    sourceLine: index + 1,
    sourceText: content,
  };
}

export function generateDocumentImportTemplatePdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 42, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('WebQuiz Question Import Template', { underline: true });
    doc.moveDown(0.8);
    doc.fontSize(10).text('Use these rules when preparing DOCX, PDF, TXT, or GIFT files for automatic import.');
    doc.moveDown();

    doc.fontSize(12).text('Template Rules', { underline: true });
    doc.moveDown(0.4);
    TEMPLATE_RULES.forEach((rule, index) => {
      doc.fontSize(9).text(`${index + 1}. ${rule}`, { width: 500 });
      doc.moveDown(0.25);
    });

    doc.addPage();
    doc.fontSize(12).text('Examples', { underline: true });
    doc.moveDown();
    doc.fontSize(9).text(
      [
        'Cau 1: Which equation is quadratic?',
        'A. x + 1 = 0',
        '*B. x^2 + 2x + 1 = 0',
        'C. x^3 = 8',
        'D. 2x = 4',
        'Giai thich: A quadratic equation has degree 2.',
        '',
        'Cau 2: 2 + 2 = 4 [T]',
        '',
        'Cau 3: Type: Short Answer',
        'What is the chemical symbol of water?',
        'Dap an: H2O; H₂O',
        '',
        'Short Answer GIFT:',
        'Capital of Vietnam is {=Ha Noi =Hanoi}',
        '',
        'Matching GIFT:',
        'Match each country to its capital: {',
        '=Vietnam -> Hanoi',
        '=Japan -> Tokyo',
        '}',
      ].join('\n'),
      { width: 500 },
    );

    doc.end();
  });
}

export class QuestionExtractService {
  async extractFromDocument(
    buffer: Buffer,
    mimetype: string,
    filename = '',
  ): Promise<ExtractionResult> {
    const text = await extractTextFromDocument(buffer, mimetype, filename);
    if (!text) {
      throw new AppError(
        'Could not extract any text from this file. Scanned PDFs need OCR before import.',
        400,
      );
    }

    const warnings: string[] = [];
    if (filename.toLowerCase().endsWith('.pdf') && text.length < 120) {
      warnings.push(
        'Very little text was extracted from this PDF. If it is a scanned image PDF, run OCR first.',
      );
    }

    let questions: ExtractedQuestion[] = [];
    let source: 'openai' | 'regex' = 'regex';

    if (env.openai.apiKey) {
      const aiResult = await openaiExtract(text);
      if (aiResult && aiResult.length > 0) {
        questions = aiResult;
        source = 'openai';
      } else {
        warnings.push('AI parser was unavailable or returned no questions; used template parser.');
        questions = regexExtract(text);
      }
    } else {
      questions = regexExtract(text);
    }

    if (questions.length === 0) {
      warnings.push(
        'No questions detected. Use markers like "Cau 1:", "A.", and "Dap an:" from the template.',
      );
    }

    const rawTextPreview = text.length > 4000 ? `${text.slice(0, 4000)}...` : text;

    return {
      rawTextPreview,
      source,
      questions,
      warnings,
      templateRules: TEMPLATE_RULES,
    };
  }
}

export const questionExtractService = new QuestionExtractService();
