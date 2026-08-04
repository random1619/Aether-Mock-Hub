/* 360 MOCKS ADAPTER — comprehensive parser for the "Pro Level" generator.

   Schema (uniform across all 25 files, verified by survey):
     { question, comp?, options[4], correct_option_id (0-based int),
       solution, marks, section }
   839 questions: 703 letter-option, 136 content-option; every key is a valid
   0-based int; no empty stems; no missing solutions/sections/marks.

   The vendor's quirks, each handled by a dedicated stage below:

   1. SHUFFLED LETTER OPTIONS — the whole question (intro + numbered
      statements + the "A)…B)…C)…D)…" code list) lives in `question`, and
      `options[]` is bare, often-shuffled letters (["D","A","C","B"]). These
      collide with the UI's own A–D chips, so options are re-sorted into A–D
      slot order and the key remapped. (normalizeLetterQuestion)

   2. PRE-SHUFFLE KEYS — some keys were authored against the pre-shuffle
      letter order. When the solution states the intended letter, that letter
      wins and the key is repaired (3 real cases: Geography Q27, Modern
      History Q41, Criminal Law Q16). (solutionLetter)

   3. CODE-MIXED BILINGUAL — Hindi AND English share one untagged stream.
      Every language run is wrapped in explicit `.eqt`/`.hqt` spans so the
      renderer's language toggle separates them exactly (symbols stay with
      their language). (tagBilingual → shared segmentBilingual)

   4. CHATGPT-EXPORT RESIDUE — 571 questions carry `data-start` / `data-end`
      / `data-col-size` attributes (ChatGPT copy-paste noise). Stripped at the
      source via the `sanitizeHtml` hook so the guarantee doesn't depend on a
      global FORBID_ATTR entry. (stripResidueAttrs)

   5. VALIDATION GUARD — asserts the canonical contract on every question
      (non-empty stem, 4 non-empty options, in-range key) and records a
      warning for any violation, so a vendor schema drift surfaces loudly
      instead of silently mis-scoring the way the EnglishMadhyam 1-based-key
      drift once mis-scored 298 mocks. (validate)

   Duplicate / non-permutation letter sets (2 real: [D,A,C,A], [C,B,D,B])
   can never be re-sorted into a knowably-correct A–D order, so they are left
   exactly as authored and flagged — never confidently corrupted. */
import type { Question } from '@/types';
import type { ProviderParser } from '../types';
import { segmentBilingual } from './bilingual';

/* ── shared helpers ─────────────────────────────────────────────────────── */

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Visible (tag-stripped, entity-collapsed) text — used for emptiness checks. */
const visibleText = (html: string | undefined): string => stripHtml(html ?? '');

/* ── Stage 4: ChatGPT-export residue ────────────────────────────────────── */

/** Matches the residue attributes ChatGPT copy-paste bakes into the HTML.
    Word-boundaried so `data-start` can't match a hypothetical `data-startx`. */
const RESIDUE_ATTR_RE = /\s*data-(?:start|end|col-size)="[^"]*"/gi;

/** Strip ChatGPT-export residue attributes. Pure + idempotent; removes only
    the named noise attributes, never tags or text, so content/layout are
    untouched. The global DOMPurify FORBID_ATTR also strips these — this hook
    makes the guarantee provider-local and testable in isolation. */
function stripResidueAttrs(html: string): string {
  // Fast path is case-insensitive (residue can appear uppercased in some exports).
  if (!html || !/data-/i.test(html)) return html;
  return html.replace(RESIDUE_ATTR_RE, '');
}

/* ── Stage 1+2: letter-option unshuffle + key repair ────────────────────── */

/** Returns the letter when an option is just a placeholder ("<p>A</p>" → "A"). */
function placeholderLetter(optionHtml: string): string | null {
  const t = stripHtml(optionHtml);
  return /^[A-Da-d]$/.test(t) ? t.toUpperCase() : null;
}

/* Solutions state the intended letter: "Answer (उत्तर): D", "Answer / उत्तर: B",
   "Answer: (c)", "उत्तर: (b)". The keyword must not sit inside a Latin word
   ("Transcription" contains "ans"), and the captured letter must be standalone.
   Note: \b can't be used — Devanagari chars are non-word in JS regex. Hindi
   trap words that merely START with उत्तर (उत्तराधिकारी "successor", उत्तरी
   "northern", उत्तर-पश्चिम, उत्तरदायित्व) are handled: they never have a
   standalone A–D letter within the lookahead window, so they yield null. */
const ANSWER_KEYWORD = /(?<![A-Za-z])(?:answer|उत्तर|उतर|ans)(?![A-Za-z])/i;
const STANDALONE_LETTER = /(?<![A-Za-z])([A-Da-d])(?![A-Za-z])/;
const SOLUTION_LOOKAHEAD = 20;

function solutionLetter(solutionHtml: string | undefined): string | null {
  if (!solutionHtml) return null;
  const text = stripHtml(solutionHtml);
  const kw = ANSWER_KEYWORD.exec(text);
  if (!kw) return null;
  const tail = text.slice(kw.index + kw[0].length, kw.index + kw[0].length + SOLUTION_LOOKAHEAD);
  const m = STANDALONE_LETTER.exec(tail);
  return m ? m[1].toUpperCase() : null;
}

function normalizeLetterQuestion(q: Question, warnings: string[]): Question {
  if (q.options.length !== 4) return q;
  const letters = q.options.map(placeholderLetter);
  if (letters.some((l) => l === null)) {
    // Some option isn't a bare A–D placeholder — either real content or an
    // out-of-range label (e.g. "E" in a match-the-following). Skip silently:
    // real content is the common case and needs no warning.
    return q;
  }
  const displayed = letters as string[];

  /* The unshuffle math assumes options are a PERMUTATION of A,B,C,D — each
     letter exactly once. Some files carry duplicated letters (["D","A","C","A"],
     ["C","B","D","B"]) where two options claim the same label; sorting then
     picks an arbitrary slot and remapping the key against a clean A–D
     assumption yields the WRONG answer. With no unique-letter set the correct
     order is unknowable, so leave the question exactly as authored and flag it
     instead of confidently corrupting the key. */
  if (new Set(displayed).size !== 4) {
    warnings.push(
      `Mocks360: letter options are not a unique A–D set ([${displayed.join(',')}]) — left unchanged`,
    );
    return q;
  }

  const fromSolution = solutionLetter(q.solution);
  const intended = fromSolution ?? displayed[q.correct_option_id] ?? null;
  if (!intended || !/^[A-D]$/.test(intended)) {
    warnings.push('Mocks360: could not determine correct letter for a letter-option question — left unchanged');
    return q;
  }

  const newKey = intended.charCodeAt(0) - 65; /* 'A' → 0 */
  const sorted = q.options
    .map((html, i) => ({ html, letter: displayed[i] }))
    .sort((a, b) => a.letter.localeCompare(b.letter))
    .map((o) => o.html);

  const reordered = sorted.some((o, i) => o !== q.options[i]);
  const keyMoved = newKey !== q.correct_option_id;
  if (!reordered && !keyMoved) return q;

  const repaired = fromSolution !== null && fromSolution !== displayed[q.correct_option_id];
  warnings.push(
    `Mocks360: normalized letter options (key ${q.correct_option_id} → ${newKey}${repaired ? ', repaired via solution' : ''})`,
  );
  return { ...q, options: sorted, correct_option_id: newKey };
}

/* ── Stage 3: bilingual tagging ─────────────────────────────────────────── */

/** Segment one question's rich HTML fields (returns a new object only when
    something actually changed, so untouched questions keep reference equality
    for React memoization). */
function tagBilingual(q: Question): Question {
  const question = segmentBilingual(q.question, document);
  const comp = q.comp ? segmentBilingual(q.comp, document) : q.comp;
  const solution = q.solution ? segmentBilingual(q.solution, document) : q.solution;
  if (question === q.question && comp === q.comp && solution === q.solution) {
    return q; // nothing was bilingual/tag-worthy — keep identity
  }
  return { ...q, question, comp, solution };
}

/* ── Stage 5: validation guard ──────────────────────────────────────────── */

/** Assert the canonical contract on every question; record a warning for each
    violation. Never mutates — a guard, not a fixer. This is the tripwire that
    turns a silent vendor schema drift into a loud, countable signal. */
function validate(questions: Question[], warnings: string[]): void {
  let emptyStem = 0;
  let badOptCount = 0;
  let emptyOption = 0;
  let keyOutOfRange = 0;
  let letterOptionCount = 0;

  questions.forEach((q, i) => {
    const n = i + 1;
    if (!visibleText(q.question)) {
      emptyStem++;
      warnings.push(`Mocks360: Q${n} has an empty stem`);
    }
    if (q.options.length !== 4) {
      badOptCount++;
      warnings.push(`Mocks360: Q${n} has ${q.options.length} options (expected 4)`);
    }
    q.options.forEach((o, oi) => {
      if (!visibleText(o)) {
        emptyOption++;
        warnings.push(`Mocks360: Q${n} option ${oi + 1} is empty`);
      }
    });
    if (
      !Number.isInteger(q.correct_option_id) ||
      q.correct_option_id < 0 ||
      q.correct_option_id >= q.options.length
    ) {
      keyOutOfRange++;
      warnings.push(
        `Mocks360: Q${n} correct_option_id ${q.correct_option_id} out of range (${q.options.length} options)`,
      );
    }
    if (q.options.length === 4 && q.options.every((o) => placeholderLetter(o) !== null)) {
      letterOptionCount++;
    }
  });

  // A single summary line keeps the per-file log readable when the data is
  // clean, while the per-question pushes above preserve exact locations when
  // something drifts.
  if (emptyStem || badOptCount || emptyOption || keyOutOfRange) {
    warnings.push(
      `Mocks360: contract violations — ${emptyStem} empty stem(s), ${badOptCount} bad option count(s), ` +
        `${emptyOption} empty option(s), ${keyOutOfRange} out-of-range key(s)`,
    );
  }
}

/* ── adapter ────────────────────────────────────────────────────────────── */

export const mocks360Parser: ProviderParser = {
  id: 'mocks360',
  match: (path) => /(^|\/)providers\/Mocks360\//i.test(path),

  // Stage 4 — runs during field mapping, before the shared DOMPurify pass.
  sanitizeHtml: stripResidueAttrs,

  postProcess: (questions, warnings) => {
    const processed = questions.map((q) => tagBilingual(normalizeLetterQuestion(q, warnings)));
    // Stage 5 — validate the FINAL processed output so the guard reflects what
    // actually ships, catching any corruption introduced upstream too.
    validate(processed, warnings);
    return processed;
  },
};
