/* ENGLISH MADHYAM ADAPTER
   Chapter-wise PYQ mocks author options with their ordinal baked
   into the text — "1) stationary", "2) temporal", … — and record
   `correct_option_id` as a 1-BASED ordinal (1–4), never 0.

   Two-stage repair, split across the pipeline where each is safe:

   1. preprocessRaw — rebase the 1-based key to 0-based on the RAW
      object, BEFORE normalizeQuestion's range validation. Left to
      postProcess, an out-of-range key of 4 (in 4 options) is clamped
      to option A upstream and the real answer is destroyed. This was
      silently mis-scoring 298 of 310 files. Verified 1-based against
      the solution letter on real mocks (keys span 1..4, never 0).

   2. postProcess — strip the "N) " ordinal prefix from sanitized
      option text so the UI's A–D chips don't render "A) 1) stationary". */
import type { ProviderParser } from '../types';

/** Leading "N." / "N)" list marker, tolerant of a wrapping tag. */
const OPTION_ORDINAL = /^(\s*(?:<[^>]+>\s*)*)\d+\s*[.)]\s+/;

/** 1-based signature: every key is an integer ≥ 1, never 0, and the max
    key fits within the option count as an ordinal. */
function looksOneBased(raw: Record<string, unknown>[]): boolean {
  const keys = raw
    .map((r) => r.correct_option_id)
    .filter((k): k is number => typeof k === 'number' && Number.isInteger(k));
  if (keys.length === 0) return false;
  if (keys.includes(0)) return false;
  const minKey = Math.min(...keys);
  const maxKey = Math.max(...keys);
  const maxOpt = Math.max(
    ...raw.map((r) => (Array.isArray(r.options) ? r.options.length : 0)),
  );
  return minKey === 1 && maxKey <= maxOpt;
}

export const englishMadhyamParser: ProviderParser = {
  id: 'englishmadhyam',
  match: (path) => /(^|\/)providers\/EnglishMadhyam\//i.test(path),

  preprocessRaw: (raw) => {
    if (!looksOneBased(raw)) return raw;
    return raw.map((r) =>
      typeof r.correct_option_id === 'number' && Number.isInteger(r.correct_option_id)
        ? { ...r, correct_option_id: Math.max(0, r.correct_option_id - 1) }
        : r,
    );
  },

  postProcess: (questions) => {
    const numbered = questions.some((q) =>
      q.options.some((o) => OPTION_ORDINAL.test(o)),
    );
    if (!numbered) return questions;
    return questions.map((q) => ({
      ...q,
      options: q.options.map((o) => o.replace(OPTION_ORDINAL, '$1')),
    }));
  },
};
