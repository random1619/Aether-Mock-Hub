/* ATTEMPT INTEGRITY — tamper-evident hash for saved attempts.
   Client-side self-integrity only: a determined user can edit both
   the payload and this hash, but casual score edits in localStorage
   (the common case) are detected on read. */
import type { Attempt } from '@/types';

const INTEGRITY_SALT = 'aether-mocks::integrity::v1';

/** Canonical string of the score-bearing fields, in a fixed order. */
function canonicalPayload(a: Attempt): string {
  return [
    a.score,
    a.maxScore,
    a.correct,
    a.incorrect,
    a.unattempted,
    a.accuracy,
    a.submittedAt,
    a.attemptNumber,
    a.fsExits ?? 0,
    a.tabSwitches ?? 0,
  ].join('|');
}

/** FNV-1a 32-bit — tiny, sync, and good enough as a tamper tripwire. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function computeAttemptHash(a: Attempt): string {
  return fnv1a(INTEGRITY_SALT + canonicalPayload(a));
}
