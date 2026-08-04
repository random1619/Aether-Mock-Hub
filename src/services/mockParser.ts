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
    `QUIZ_DATA`. */
const VAR_RE = /(?:const|let|var)\s+(questions|QUESTIONS|QUIZ_DATA)\s*=\s*\[/;
/** Primary: greedy — captures up to the LAST `]` before `</script>`. Correct
    for every generator template (the questions array is the final statement
    before the closing tag) and immune to `]</script>` appearing inside a
    question's HTML string content, which truncated the old non-greedy regex. */
const QUESTIONS_RE_GREEDY = /(?:const|let|var)\s+(?:questions|QUESTIONS|QUIZ_DATA)\s*=\s*(\[[\s\S]*\])\s*;?\s*<\/script>/m;
/** Fallback for hand-authored mocks where the array isn't the last statement. */
const QUESTIONS_RE = /(?:const|let|var)\s+(?:questions|QUESTIONS|QUIZ_DATA)\s*=\s*(\[[\s\S]*?\])\s*;?\s*(?:<\/script>|$)/m;

/** Bracket-matching extraction for mocks where the data array is followed by
    more JS in the same <script> (both regexes above require the array to sit
    right before `</script>`/EOF). Finds `const questions|QUESTIONS|QUIZ_DATA = [`
    then walks brackets, skipping over string contents so `]`/`[` inside
    question HTML can't unbalance the count. */
function extractByBracketMatch(html: string): string | null {
  const m = VAR_RE.exec(html);
  if (!m) return null;
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
  return null;
}

function extractQuestionsJson(html: string): string | null {
  // Order matters: greedy first (canonical templates), then bracket-match
  // (array followed by more JS in the same script), non-greedy last — with
  // the /m flag its `$` matches any line end and can truncate a valid array.
  const m = html.match(QUESTIONS_RE_GREEDY);
  if (m) return m[1];
  const bracketed = extractByBracketMatch(html);
  if (bracketed) return bracketed;
  const fallback = html.match(QUESTIONS_RE);
  return fallback ? fallback[1] : null;
}
/** Give up on a hung connection instead of spinning forever. */
const FETCH_TIMEOUT_MS = 15_000;

/** Sanitize rich question/option/solution HTML, preserving structure + math. */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: [
      'math', 'mi', 'mo', 'mn', 'ms', 'mtext', 'mrow', 'msup', 'msub', 'mfrac',
      'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'semantics', 'annotation',
    ],
    ADD_ATTR: ['data-path-to-node', 'data-index-in-node', 'lang', 'mathvariant', 'encoding'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    /* ChatGPT-export residue carried by some vendors (360 Mocks) — pure noise. */
    FORBID_ATTR: ['data-start', 'data-end', 'data-col-size'],
  });
}

function stripOuterJson(raw: string): unknown[] {
  // The embedded array is already valid JSON (double-quoted keys/strings).
  // Parse directly; fall back to a tolerant cleanup for stray trailing commas.
  try {
    return JSON.parse(raw);
  } catch (firstErr) {
    try {
      const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
      return JSON.parse(cleaned);
    } catch {
      // Surface a useful error — a raw SyntaxError ("Unexpected token } in
      // JSON at position 18342") gives no hint that the mock file is broken.
      throw new Error(
        `Could not parse questions JSON (even after trailing-comma cleanup): ${
          firstErr instanceof Error ? firstErr.message : String(firstErr)
        }`,
      );
    }
  }
}

/** Vendor templates use different key names for the same data. Map every
    known variant (Random-Mocks `QUESTIONS`/`QUIZ_DATA` schemas, YATRI
    `q/opts/ans/sol`, bilingual `qEn/optsEn`, letter answer keys, etc.) onto
    the canonical `question/options/correct_option_id` shape before the
    standard validation runs. */
function canonicalizeRaw(raw: Record<string, unknown>): Record<string, unknown> {
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
  let options: unknown[] = Array.isArray(rawOpts) ? rawOpts : [];
  const optsAreObjects = options.some(
    (o) => typeof o === 'object' && o !== null && !Array.isArray(o),
  );
  if (optsAreObjects) {
    options = options.map((o) => {
      if (typeof o === 'object' && o !== null) {
        const rec = o as Record<string, unknown>;
        return String(rec.en ?? rec.hi ?? '');
      }
      return String(o ?? '');
    });
  }

  // Answer key variants: correct_option_id (0-based), correct (letter a–d or
  // 0-based int), ans (0-based int; 1-based only in the {en,hi}-opts schema).
  let correct: unknown = raw.correct_option_id;
  if (correct === undefined || correct === null) {
    const c = raw.correct;
    if (typeof c === 'string' && /^[a-dA-D]$/.test(c.trim())) {
      correct = c.trim().toLowerCase().charCodeAt(0) - 97;
    } else if (c !== undefined && c !== null) {
      correct = c; // numeric / numeric-string — handled by standard validation
    }
  }
  if (correct === undefined || correct === null) {
    const a = raw.ans;
    if (typeof a === 'number' && Number.isFinite(a)) {
      correct = optsAreObjects ? a - 1 : a;
    } else if (a !== undefined && a !== null) {
      correct = a;
    }
  }

  // Vocab-quiz schema: instruction line + sentence stem.
  const stem =
    (hasEnQ ? enQ : undefined) ?? raw.question ?? raw.text ?? raw.q ??
    (raw.sentence !== undefined
      ? [raw.instr, raw.sentence].filter(Boolean).join('<br>')
      : undefined);

  return {
    question: stem,
    comp: raw.comp,
    options,
    correct_option_id: correct,
    solution: (hasEnSol ? enSol : undefined) ?? raw.solution ?? raw.sol ?? raw.exp ?? raw.expl ?? raw.solHi,
    marks: raw.marks ?? raw.pos,
    section: raw.section,
    series_name: raw.series_name ?? raw.tag ?? raw.src,
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
  // Fetch from the SITE ROOT (leading slash): the app is served under /v2/,
  // so a relative fetch would wrongly resolve to /v2/providers/…
  const url = '/' + encodeURI(path).replace(/^\//, '');

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  let html: string;
  try {
    res = await fetch(url, { signal: ac.signal });
    if (!res.ok) throw new Error(`Failed to load mock (${res.status}): ${path}`);
    html = await res.text();
  } catch (e) {
    // The abort signal is the reliable timeout indicator — the rejection's
    // name/type varies across environments (AbortError vs TypeError vs plain
    // Error in some fetch polyfills).
    if (ac.signal.aborted) {
      throw new Error(`Timed out loading mock (${FETCH_TIMEOUT_MS / 1000}s): ${path}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
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

  return { meta, questions, warnings };
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
