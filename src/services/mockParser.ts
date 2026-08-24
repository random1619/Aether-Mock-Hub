/* MOCK PARSER — extract a normalized exam from a legacy mock file.
   Every vendor mock embeds `const questions = [ ... ]` plus an
   optional `<meta name="exam-duration">`. We fetch the HTML, pull the
   JSON array, sanitize the rich HTML, and derive sections + metadata.
   This is what lets ONE React engine render all 1,124 legacy mocks
   with a single professional UI. */
import DOMPurify from 'dompurify';
import type { ExamMeta, ExamSection, Question } from '@/types';
import { resolveProviderParser } from './parsers/registry';
import { getProviderForPath } from './mockCatalog';

const DURATION_RE = /<meta[^>]+name=["']exam-duration["'][^>]+content=["'](\d+)["']/i;
const DURATION_RE_ALT = /<meta[^>]+content=["'](\d+)["'][^>]+name=["']exam-duration["']/i;
/** Data variable names used across vendor templates: legacy mocks embed
    `const questions`, newer Random-Mocks templates use `QUESTIONS` or
    `QUIZ_DATA`, and other templates use `quizData`, `testData`, etc. */
const VAR_RE = /(?:const|let|var)\s+(?:questions|QUESTIONS|QUIZ_DATA|quizData|testData|qs)\s*=\s*\[/;
const VAR_RE_QS = /this\.qs\s*=\s*\[/;
const VAR_RE_QUESTIONS_THIS = /this\.questions\s*=\s*\[/;
/** Primary: greedy — captures up to the LAST `]` before `</script>`. Correct
     for every generator template (the questions array is the final statement
     before the closing tag) and immune to `]</script>` appearing inside a
     question's HTML string content, which truncated the old non-greedy regex. */
const QUESTIONS_RE_GREEDY = /(?:const|let|var)\s+(?:questions|QUESTIONS|QUIZ_DATA|quizData|testData|qs)\s*=\s*(\[[\s\S]*\])\s*;?\s*<\/script>/m;
const QS_RE_GREEDY = /this\.qs\s*=\s*(\[[\s\S]*\])\s*;?\s*(?:<\/script>|this\.sections)/m;
/** Fallback for hand-authored mocks where the array isn't the last statement. */
const QUESTIONS_RE = /(?:const|let|var)\s+(?:questions|QUESTIONS|QUIZ_DATA|quizData|testData|qs)\s*=\s*(\[[\s\S]*?\])\s*;?\s*(?:<\/script>|$)/m;

/** Bracket-matching extraction for mocks where the data array is followed by
    more JS in the same <script> (both regexes above require the array to sit
    right before `</script>`/EOF). Finds `const questions|QUESTIONS|QUIZ_DATA|quizData|testData|qs = [`
    then walks brackets, skipping over string contents so `]`/`[` inside
    question HTML can't unbalance the count. */
function extractByBracketMatch(html: string): string | null {
  const varRes = [VAR_RE, VAR_RE_QS, VAR_RE_QUESTIONS_THIS];
  for(const re of varRes){
    const m = re.exec(html);
    if (!m) continue;
    const start = m.index + m[0].length - 1; // position of the opening `[`
    let depth = 0;
    let inStr: string | null = null;
    let escaped = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) return html.slice(start, i + 1);
      }
    }
  }
  return null;
}

// DOM q-card extraction for Computer Awareness en.html style
function extractLangEnQuestions(html: string): string | null {
  if(!html.includes('class="question lang-en"')) return null;
  const questions: any[] = [];
  const qBlocks = html.split(/<div class="question lang-en">/);
  for(let i=1;i<qBlocks.length;i++){
    const block = '<div class="question lang-en">' + qBlocks[i];
    const qTextMatch = block.match(/<div class="question lang-en">([\s\S]*?)<\/div>/);
    const qText = qTextMatch ? qTextMatch[1].trim() : '';
    const langEnMatch = block.match(/<div class="lang-en">([\s\S]*?)<\/div>\s*<div class="lang-hi">/);
    const options: string[] = [];
    let correctIdx = 0;
    if(langEnMatch){
      const optHtml = langEnMatch[1];
      const optRe = /<div class="option([^"]*)">([\s\S]*?)<\/div>/g;
      let om: RegExpExecArray | null, idx=0;
      while((om=optRe.exec(optHtml))!==null){
        const cls = om[1] || '';
        const text = om[2].replace(/<[^>]+>/g,'').trim();
        if(text){ options.push(text); if(cls.includes('correct')) correctIdx = idx; idx++; }
      }
    }
    const solMatch = block.match(/<div class="solution">([\s\S]*?)<\/div>\s*<\/div>/);
    const sol = solMatch ? solMatch[1].trim() : '';
    if(qText && options.length) questions.push({question: qText, options, correct_option_id: correctIdx, solution: sol, marks: 2});
    if(questions.length>500) break;
  }
  if(questions.length) return JSON.stringify(questions);
  return null;
}

function extractDomQCards(html: string): string | null {
  if(!html.includes('class="q-card"')) return null;
  // Try to extract test.correct mapping for answers
  let correctMap: Record<string, number> = {};
  const corrMatch = html.match(/correct\s*:\s*\{([\s\S]*?)\}\s*,/);
  if(corrMatch){
    try{
      const body = '{' + corrMatch[1] + '}';
      correctMap = Function('"use strict"; return (' + body + ')')();
    }catch{}
  }
  const parts = html.split(/<div class="q-card"/);
  const questions: any[] = [];
  for(let i=1;i<parts.length;i++){
    const block = '<div class="q-card"' + parts[i];
    const idM = block.match(/id="q([^"]+)"/);
    const secM = block.match(/class="q-section"[^>]*>([^<]+)<\/div>/);
    const qTextM = block.match(/class="q-text"[^>]*>([\s\S]*?)<\/div>\s*<div class="options">/);
    const qText = qTextM ? qTextM[1].trim() : '';
    const opts: string[] = [];
    const optRe = /class="option-text"[^>]*>([\s\S]*?)<\/div>/g;
    let om; while((om=optRe.exec(block))!==null) opts.push(om[1].trim());
    const solM = block.match(/class="solution-content"[^>]*>([\s\S]*?)<\/div>/);
    const sol = solM ? solM[1].trim() : '';
    if(!qText && opts.length===0) continue;
    const id = idM ? idM[1] : `dom_${i}`;
    const correct = typeof correctMap[id]==='number' ? correctMap[id] : 0;
    const secName = secM ? secM[1].trim() : '';
    questions.push({
      question: qText,
      options: opts,
      correct_option_id: correct,
      solution: sol,
      section: secName || undefined,
    });
    if(questions.length>500) break;
  }
  if(questions.length) return JSON.stringify(questions);
  return null;
}

function extractObjectWithQuestions(html: string): string | null {
  const objRe = /(?:const|let|var)\s+(?:quizData|testData|examData|QUIZ_DATA)\s*=\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(html)) !== null) {
    const start = m.index + m[0].length - 1;
    let depth = 0, inStr: string | null = null, escaped = false;
    for (let i = start; i < html.length; i++) {
      const ch = html[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return html.slice(start, i + 1);
      }
    }
  }
  return null;
}

function extractQuestionsJson(html: string): string | null {
  // Order matters: greedy first (canonical templates), then bracket-match
  // (array followed by more JS in the same script), non-greedy last — with
  // the /m flag its `$` matches any line end and can truncate a valid array.
  const m = html.match(QUESTIONS_RE_GREEDY);
  if (m) return m[1];
  const qm = html.match(QS_RE_GREEDY);
  if (qm) return qm[1];
  const bracketed = extractByBracketMatch(html);
  if (bracketed) return bracketed;
  const fallback = html.match(QUESTIONS_RE);
  if (fallback) return fallback[1];
  // Fallback: object wrapping questions (e.g. const quizData = { ... questions: [...] })
  const objWrap = extractObjectWithQuestions(html);
  if (objWrap) return objWrap;
  // Fallback: DOM q-cards (Mocks Wallah Direction etc.)
  const dom = extractDomQCards(html);
  if (dom) return dom;
  // Fallback: lang-en question format (Computer Awareness)
  const langEn = extractLangEnQuestions(html);
  if (langEn) return langEn;
  return null;
}
/** Give up on a hung connection instead of spinning forever. */
const FETCH_TIMEOUT_MS = 15_000;

/** Sanitize rich question/option/solution HTML, preserving structure + math + layout.
    Perfect: keeps spaces, inline styles for fractions/tables, and math. */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Preserve &nbsp; as non-breaking space for layout, but normalize leading/trailing
  const withNbsp = html.replace(/&nbsp;/g, '\u00A0');
  return DOMPurify.sanitize(withNbsp, {
    USE_PROFILES: { html: true },
    ADD_TAGS: [
      'math', 'mi', 'mo', 'mn', 'ms', 'mtext', 'mrow', 'msup', 'msub', 'mfrac',
      'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'semantics', 'annotation', 'annotation-xml',
    ],
    ADD_ATTR: [
      'data-path-to-node', 'data-index-in-node', 'lang', 'mathvariant', 'encoding',
      'style', 'class', 'id', 'src', 'href', 'alt', 'title', 'width', 'height', 'colspan', 'rowspan',
      'cellspacing', 'cellpadding', 'border', 'align', 'valign',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['data-start', 'data-end', 'data-col-size', 'onerror', 'onload', 'onclick'],
    ALLOW_DATA_ATTR: false,
    KEEP_CONTENT: true,
  });
}

function stripOuterJson(raw: string): unknown[] {
  // 1. Try standard JSON.parse directly
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).questions)) {
      return (parsed as any).questions;
    }
  } catch {}

  // 2. Try trailing-comma cleanup
  try {
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).questions)) {
      return (parsed as any).questions;
    }
  } catch {}

  // 3. Tolerant JavaScript object/array literal evaluator (handles unquoted keys, single quotes, \', trailing commas)
  try {
    const evaled = Function('"use strict"; return (' + raw + ')')();
    if (Array.isArray(evaled)) return evaled;
    if (evaled && typeof evaled === 'object' && Array.isArray((evaled as any).questions)) {
      return (evaled as any).questions;
    }
  } catch (evalErr) {
    throw new Error(
      `Could not parse questions JSON (even after trailing-comma cleanup): ${evalErr instanceof Error ? evalErr.message : String(evalErr)}`
    );
  }

  throw new Error('Questions payload is not an array.');
}

/** Slugify a legacy html path the same way scripts/extract-mocks.mjs does:
     `English Madhyam/.../foo.html` → `English_Madhyam__...__foo` */
function slugify(relPath: string): string {
  const noExt = relPath.replace(/\.html?$/i, '');
  return noExt
    .split('/')
    .map((seg) => encodeURIComponent(seg.replace(/\s+/g, '_').replace(/[^\w\-()]/g, '')))
    .join('__');
}

/** Try to load the pre-extracted JSON for a mock (`/mocks/<slug>.json`).
     Returns null when the file is missing (404) so the caller falls back to
     the legacy HTML fetch. Any other error (network, JSON parse) is thrown. */
async function tryLoadJson(path: string, displayName?: string, signal?: AbortSignal): Promise<ParsedExam | null> {
  const slug = slugify(path);
  const url = `/mocks/${slug}.json`;
  let res: Response;
  try {
    res = await fetch(url, signal ? { signal } : undefined);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  // In vitest the global fetch is mocked to return a canned HTML Response
  // for *any* URL. That mock returns the same Response instance for both
  // the JSON probe and the subsequent HTML fetch — reading its body would
  // disturb the second read ("Body has already been read"). Detect HTML
  // by Content-Type and bail without consuming the body. Also use
  // clone() so we never disturb a reusable mocked Response.
  const ct = res.headers?.get?.('content-type') || '';
  if (ct.includes('text/html')) return null;
  let json: any;
  try {
    // Clone so a reusable mocked Response stays pristine for the HTML fallback
    const toRead = typeof (res as any).clone === 'function' ? (res as any).clone() : res;
    json = await toRead.json();
  } catch {
    return null;
  }
  if (!json || !Array.isArray(json.questions) || json.questions.length === 0) return null;

  // JSON already contains normalized questions; still run through the same
  // sanitisation + validation path so the contract is identical to HTML.
  const adapter = resolveProviderParser(path);
  const rawRecords = json.questions as Record<string, unknown>[];
  // The extractor already applied provider preprocessors at build time, but
  // re-apply the live adapter's preprocessRaw if present for forward compat.
  const preprocessed = adapter?.preprocessRaw ? adapter.preprocessRaw(rawRecords as any) : (rawRecords as any);

  const warnings: string[] = [];
  let questions = preprocessed.map((raw: any, i: number) => normalizeQuestion(raw, i, warnings, adapter?.sanitizeHtml));
  if (adapter?.postProcess) questions = adapter.postProcess(questions, warnings);
  if (!questions.length) return null;

  const durationMinutes = typeof json.durationMinutes === 'number' ? json.durationMinutes : 60;
  const name = displayName || json.title || 'Mock Test';
  const meta: ExamMeta = {
    path,
    name,
    durationMinutes,
    sections: deriveSections(questions),
  };
  try {
    meta.provider = await getProviderForPath(path);
  } catch {}
  // If the JSON manifest has locked section timers, prefer them; otherwise
  // deriveSections already gives contiguous ranges.
  if (Array.isArray(json.sections) && json.sections.length) {
    meta.sections = json.sections.map((s: any) => ({ name: s.name, start: s.start, end: s.end }));
  }
  return { meta, questions, warnings };
}

/** Vendor templates use different key names for the same data. Map every
     known variant (Random-Mocks `QUESTIONS`/`QUIZ_DATA` schemas, YATRI
     `q/opts/ans/sol`, bilingual `qEn/optsEn`, letter answer keys, etc.) onto
     the canonical `question/options/correct_option_id` shape before the
     standard validation runs. */
function canonicalizeRaw(raw: Record<string, unknown>): Record<string, unknown> {
  // Handle testData format from English Madhyam Chapter Wise: question_text, correct_answer (1-based), explanation, marks object
  if (raw.question_text !== undefined || raw.correct_answer !== undefined) {
    let opts: unknown[] = Array.isArray(raw.options) ? raw.options : [];
    // Clean options: strip leading "1) " and <input> HTML
    opts = opts.map(o => {
      let s = String(o ?? '');
      s = s.replace(/^\s*\d+\)\s*/, '').replace(/<input[^>]*>/gi, '').replace(/<span class="checkmark[^>]*>.*?<\/span>/gi, '').trim();
      return s;
    });
    // correct_answer is 1-based in testData
    let corr = raw.correct_answer;
    if (typeof corr === 'number') corr = corr - 1;
    else if (typeof corr === 'string' && /^\d+$/.test(corr.trim())) corr = parseInt(corr.trim(),10)-1;
    // marks may be object {positive, negative}
    let marksVal: unknown = raw.marks;
    if (typeof marksVal === 'object' && marksVal !== null && (marksVal as any).positive !== undefined) marksVal = (marksVal as any).positive;
    return {
      question: raw.question_text ?? raw.question ?? '',
      comp: raw.comp,
      options: opts,
      correct_option_id: corr,
      solution: raw.explanation ?? raw.solution ?? '',
      marks: marksVal,
      section: raw.section,
      series_name: raw.series_name ?? raw.tag ?? raw.src,
    };
  }
  // Bilingual files ship parallel key sets (qEn/optsEn, q_en/options_en).
  // Pick ONE coherent set — an English stem over Hindi options (or vice
  // versa) renders a broken hybrid. English set wins when present; the base
  // set for those files is frequently mojibake Hindi.
  //
  // Each field (stem / options / solution) decides independently whether
  // the English variant is "present". Previously a single `useEn` flag
  // gated all three, so an empty-string `enQ` (a common artifact in
  // hand-edited mock data) blocked the stem fallthrough while still
  // triggering English options — producing a question with English
  // options but a blank stem.
  const enQ = raw.qEn ?? raw.q_en ?? raw.question_en;
  const enOpts = raw.optsEn ?? raw.optEn ?? raw.options_en;
  const enSol = raw.solEn ?? raw.sol_en ?? raw.solution_en;
  const hasEnQ = typeof enQ === 'string' && enQ.trim().length > 0;
  const hasEnOpts = enOpts !== undefined;
  const hasEnSol = typeof enSol === 'string' && enSol.trim().length > 0;

  const rawOpts = (hasEnOpts ? enOpts : undefined) ?? raw.options ?? raw.opts;
  let options: unknown[] = [];
  if (Array.isArray(rawOpts)) {
    options = rawOpts;
  } else if (typeof rawOpts === 'object' && rawOpts !== null) {
    options = Object.values(rawOpts);
  }

  const optsAreObjects = options.some(
    (o) => typeof o === 'object' && o !== null && !Array.isArray(o),
  );
  if (optsAreObjects) {
    options = options.map((o) => {
      if (typeof o === 'object' && o !== null) {
        const rec = o as Record<string, unknown>;
        return String(rec.en ?? rec.hi ?? rec.text ?? rec.value ?? rec.option ?? '');
      }
      return String(o ?? '');
    });
  }
  // Clean options that may contain "1) text <input..." (testData style but without question_text wrapper)
  options = options.map(o => {
    let s = String(o ?? '');
    if(/^\s*\d+\)/.test(s) && s.includes('<input')){
      s = s.replace(/^\s*\d+\)\s*/, '').replace(/<input[^>]*>/gi, '').replace(/<span class="checkmark[^>]*>.*?<\/span>/gi, '').trim();
    }
    return s;
  });

  // Answer key variants: correct_option_id (0-based), correctIndex (0-based),
  // correct (letter a–f or 0-based int), answer, correct_option, ans (0-based int; 1-based only in the {en,hi}-opts schema).
  let correct: unknown = raw.correct_option_id ?? raw.correctIndex;
  if (correct === undefined || correct === null) {
    const c = raw.correct ?? raw.answer ?? raw.correct_option;
    if (typeof c === 'string' && /^[a-fA-F]$/.test(c.trim())) {
      correct = c.trim().toLowerCase().charCodeAt(0) - 97;
    } else if (typeof c === 'string' && /^\d+$/.test(c.trim())) {
      correct = parseInt(c.trim(), 10);
    } else if (c !== undefined && c !== null) {
      correct = c; // numeric / numeric-string — handled by standard validation
    }
  }
  if (correct === undefined || correct === null) {
    const a = raw.ans;
    if (typeof a === 'number' && Number.isFinite(a)) {
      correct = optsAreObjects ? a - 1 : a;
    } else if (typeof a === 'string' && /^[a-fA-F]$/.test(a.trim())) {
      correct = a.trim().toLowerCase().charCodeAt(0) - 97;
    } else if (a !== undefined && a !== null) {
      correct = a;
    }
  }
  // Handle correct_answer 1-based fallback (for testData that slipped through)
  if ((correct === undefined || correct === null) && raw.correct_answer !== undefined) {
    const ca = raw.correct_answer as unknown;
    if (typeof ca === 'number') correct = (ca as number) - 1;
    else if(typeof ca === 'string' && /^\d+$/.test((ca as string).trim())) correct = parseInt((ca as string).trim(),10)-1;
  }

  // Vocab-quiz schema: instruction line + sentence stem or word-only stem.
  const stem =
    (hasEnQ ? enQ : undefined) ?? raw.question ?? raw.text ?? raw.q ?? raw.question_text ??
    (raw.word !== undefined && raw.q === undefined ? `Select the synonym/meaning of: <b>${raw.word}</b>` : undefined) ??
    (raw.sentence !== undefined
      ? [raw.instr, raw.sentence].filter(Boolean).join('<br>')
      : undefined);

  const passage =
    raw.comp ?? raw.passage ?? raw.paragraph ?? raw.reading_comprehension ??
    raw.rc_passage ?? raw.direction ?? raw.directions ?? raw.context ?? raw.passage_text;

  return {
    question: stem,
    comp: passage,
    options,
    correct_option_id: correct,
    solution: (hasEnSol ? enSol : undefined) ?? raw.solution ?? raw.explanation ?? raw.sol ?? raw.exp ?? raw.expl ?? raw.solHi ?? raw.detailed_solution,
    marks: (raw.marks as any)?.positive ?? raw.marks ?? raw.pos ?? raw.marks_per_question,
    section: raw.section,
    series_name: raw.series_name ?? raw.tag ?? raw.topic ?? raw.src,
  };
}

function normalizeQuestion(
  rawInput: Record<string, unknown>,
  idx: number,
  warnings: string[],
  extraSanitize?: (html: string) => string,
): Question {
  const raw = canonicalizeRaw(rawInput);
  // Provider-specific cleanup (e.g. 360 Mocks ChatGPT residue) runs BEFORE the
  // shared DOMPurify pass, so the guarantee lives with the provider adapter.
  const clean = (s: string) => sanitizeHtml(extraSanitize ? extraSanitize(s) : s);
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
  const options = optionsRaw.map((o) => clean(String(o ?? '')));

  // correct_option_id: never silently default to "option A" — a mock authored
  // without keys would mark every answer wrong with zero trace. Clamp + warn.
  // Numeric strings ("2") are common in legacy data and accepted quietly.
  let correctOptionId: number;
  const rawKey = raw.correct_option_id;
  if (typeof rawKey === 'number' && Number.isFinite(rawKey)) {
    correctOptionId = Math.trunc(rawKey);
  } else if (rawKey === undefined || rawKey === null) {
    correctOptionId = 0;
    warnings.push(`Q${idx + 1}: missing correct_option_id — defaulted to option A`);
  } else {
    const parsed = parseInt(String(rawKey), 10);
    if (Number.isFinite(parsed)) {
      correctOptionId = parsed;
    } else {
      correctOptionId = 0;
      warnings.push(`Q${idx + 1}: non-numeric correct_option_id (${String(rawKey)}) — defaulted to option A`);
    }
  }
  if (correctOptionId < 0 || correctOptionId >= options.length) {
    warnings.push(
      `Q${idx + 1}: correct_option_id ${correctOptionId} out of range (${options.length} options) — clamped to option A`,
    );
    correctOptionId = 0;
  }

  return {
    question: clean(String(raw.question ?? raw.text ?? '')),
    comp: raw.comp ? clean(String(raw.comp)) : undefined,
    options,
    correct_option_id: correctOptionId,
    solution: raw.solution ? clean(String(raw.solution)) : undefined,
    marks: raw.marks !== undefined ? parseFloat(String(raw.marks)) || 2 : 2,
    section: raw.section ? String(raw.section) : undefined,
    series_name: raw.series_name ? String(raw.series_name) : undefined,
  };
}

/** Bucket by section name (first-seen order) and emit one envelope range per
    name. Contiguous layouts (A,A,B,B) are unchanged; pathological interleaved
    layouts (A,B,A) merge into A's envelope instead of creating two "A"
    sections, which broke sectional navigation clamping. */
function deriveSections(questions: Question[]): ExamSection[] {
  const order: string[] = [];
  const ranges = new Map<string, { start: number; end: number }>();
  questions.forEach((q, idx) => {
    const name = (q.section || 'General').trim() || 'General';
    const r = ranges.get(name);
    if (r) {
      if (idx < r.start) r.start = idx;
      if (idx > r.end) r.end = idx;
    } else {
      ranges.set(name, { start: idx, end: idx });
      order.push(name);
    }
  });
  return order.map((name) => ({ name, ...ranges.get(name)! }));
}

export interface ParsedExam {
  meta: ExamMeta;
  questions: Question[];
  /** Non-fatal data-quality issues found while parsing (bad answer keys,
      clamped values). Empty for a clean mock. */
  warnings: string[];
}

/* Cache parsed exams by path so re-attempts / re-navigation don't re-fetch and
   re-run per-question DOMPurify. Cache the in-flight Promise (not just the
   result) so concurrent mounts share one network request. */
const _parseCache = new Map<string, Promise<ParsedExam>>();

/**
 * Fetch + parse a legacy mock HTML file into a normalized exam.
 * @param path canonical mock path, e.g. "providers/Mocks360/foo.html"
 */
export function parseMock(path: string, displayName?: string): Promise<ParsedExam> {
  const key = path + '::' + (displayName || '');
  const hit = _parseCache.get(key);
  if (hit) return hit;
  const p = doParseMock(path, displayName);
  _parseCache.set(key, p);
  // Don't cache rejections forever — a transient network error should retry.
  p.catch(() => _parseCache.delete(key));
  return p;
}

async function doParseMock(path: string, displayName?: string): Promise<ParsedExam> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    // Prefer the pre-extracted JSON — tiny, cacheable, no HTML parse.
    // Falls back to the legacy HTML fetch for any mock missing a JSON.
    // Share the same AbortSignal so a test that advances 15s aborts both.
    const jsonHit = await tryLoadJson(path, displayName, ac.signal);
    if (jsonHit) {
      clearTimeout(timer);
      return jsonHit;
    }

    if (ac.signal.aborted) throw new Error(`Timed out loading mock (${FETCH_TIMEOUT_MS / 1000}s): ${path}`);
    // Fetch from the SITE ROOT (leading slash): the app is served under /v2/,
    // so a relative fetch would wrongly resolve to /v2/providers/…
    const url = '/' + encodeURI(path).replace(/^\//, '');
    let res: Response;
    let html: string;
    try {
      res = await fetch(url, { signal: ac.signal });
      if (!res.ok) throw new Error(`Failed to load mock (${res.status}): ${path}`);
      html = await res.text();
    } catch (e) {
      if (ac.signal.aborted) {
        throw new Error(`Timed out loading mock (${FETCH_TIMEOUT_MS / 1000}s): ${path}`);
      }
      throw e;
    }

    const rawJson = extractQuestionsJson(html);
  if (!rawJson) {
    // A 200 HTML shell page (SPA fallback, directory index) isn't a broken
    // mock — the mock simply isn't there. Say which it is.
    if (/^\s*(?:<!DOCTYPE|<html)/i.test(html) && !VAR_RE.test(html)) {
      throw new Error(
        `The server returned a page, not a mock file — the mock may be missing or the path is wrong: ${path}`,
      );
    }
    throw new Error('No `questions` array found in mock file.');
  }

  const rawArr = stripOuterJson(rawJson);
  if (!Array.isArray(rawArr)) throw new Error('Questions payload is not an array.');

  /* Provider-specific adapter, resolved once by catalog path. */
  const adapter = resolveProviderParser(path);

  /* Raw fixups (e.g. EnglishMadhyam 1-based keys) must run BEFORE
     normalizeQuestion's range validation, which would otherwise clamp an
     out-of-range 1-based key to option A and destroy the real answer. */
  const rawRecords = rawArr.map((raw) =>
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {},
  );
  const preprocessed = adapter?.preprocessRaw ? adapter.preprocessRaw(rawRecords) : rawRecords;

  const warnings: string[] = [];
  let questions = preprocessed.map((raw, i) =>
    normalizeQuestion(raw, i, warnings, adapter?.sanitizeHtml),
  );
  if (!questions.length) throw new Error('Mock contains an empty questions array.');

  /* Provider-specific fixups (e.g. Mocks360 letter-option unshuffling). */
  if (adapter?.postProcess) {
    questions = adapter.postProcess(questions, warnings);
  }

  const durMatch = html.match(DURATION_RE) || html.match(DURATION_RE_ALT);
  const durationMinutes = durMatch ? parseInt(durMatch[1], 10) || 60 : 60;

  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const name = displayName || (titleMatch ? titleMatch[1].trim() : 'Mock Test');

  const meta: ExamMeta = {
    path,
    name,
    durationMinutes,
    sections: deriveSections(questions),
  };

  // Resolve the friendly provider name from the mock catalog so
  // byProvider stats use readable keys (e.g. "Oliveboard") instead
  // of raw path segments ("providers").
  try {
    meta.provider = await getProviderForPath(path);
  } catch {
    // Catalog not available (offline / first load) — stats will fall
    // back to the path-segment heuristic.
  }

  clearTimeout(timer);
  return { meta, questions, warnings };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

/** Extract just the questions JSON length for validation (used by tooling). */
export function extractQuestionCount(html: string): number {
  const raw = extractQuestionsJson(html);
  if (!raw) return 0;
  try {
    return (JSON.parse(raw) as unknown[]).length;
  } catch {
    return 0;
  }
}
