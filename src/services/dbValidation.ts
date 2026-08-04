/* DB VALIDATION — structural guards for the persisted aether-db.
   Pure, non-throwing: validators never crash on garbage input,
   they drop invalid entries and report what was dropped. Used by
   attemptStore on every load/import/cross-tab sync so a malformed
   blob can never poison stats math or crash a page. */
import type { AetherDB, Attempt, SavedQuestionRecord, SectionSnapshot } from '@/types';
import { computeAttemptHash } from '@/lib/integrity';

export interface ValidationReport {
  /** Attempts removed because they were structurally unusable. */
  droppedAttempts: number;
  /** Saved-question records removed. */
  droppedSavedQuestions: number;
  /** Stats object was missing or mis-shaped and got replaced with defaults. */
  fixedStats: boolean;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function isValidSectionSnapshot(s: unknown): s is SectionSnapshot {
  if (!isPlainObject(s)) return false;
  return (
    typeof s.name === 'string' &&
    isFiniteNumber(s.start) &&
    isFiniteNumber(s.end) &&
    s.start >= 0 &&
    s.end >= s.start
  );
}

/**
 * Structural check for one persisted attempt. Anything that would break
 * stats math (non-finite numbers) or sorting (bad submittedAt) fails.
 * Note: this is a *guard*, not a repair — repair/coercion happens in
 * validateDb where index context is available.
 */
export function isValidAttempt(a: unknown): a is Attempt {
  if (!isPlainObject(a)) return false;
  return (
    isFiniteNumber(a.score) &&
    isFiniteNumber(a.maxScore) &&
    isFiniteNumber(a.correct) &&
    isFiniteNumber(a.incorrect) &&
    isFiniteNumber(a.unattempted) &&
    isFiniteNumber(a.accuracy) &&
    typeof a.submittedAt === 'string'
  );
}

export function isValidSavedQuestion(s: unknown): s is SavedQuestionRecord {
  if (!isPlainObject(s)) return false;
  return (
    typeof s.id === 'string' &&
    typeof s.examPath === 'string' &&
    typeof s.examName === 'string' &&
    typeof s.question === 'string' &&
    typeof s.questionIdx === 'number' &&
    Number.isInteger(s.questionIdx) &&
    s.questionIdx >= 0 &&
    Array.isArray(s.options) &&
    (s.options as unknown[]).every((o) => typeof o === 'string') &&
    isFiniteNumber(s.correct_option_id)
  );
}

/**
 * Repair one attempt in place where a missing/invalid field has a sane
 * fallback. Returns false when the attempt is beyond repair.
 *
 * Policy: prefer coercion over dropping — losing history is worse than a
 * slightly wrong timestamp or attempt number. Only non-finite core numbers
 * (which would NaN-poison stats) are fatal.
 */
function repairAttempt(a: unknown, fallbackNumber: number): Attempt | null {
  if (!isPlainObject(a)) return null;
  // Core numeric fields: coerce numeric strings, reject true garbage.
  for (const key of ['score', 'maxScore', 'correct', 'incorrect', 'unattempted', 'accuracy'] as const) {
    const v = a[key];
    if (isFiniteNumber(v)) continue;
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    if (Number.isFinite(n)) {
      a[key] = n;
    } else {
      return null; // NaN vector — drop the attempt rather than poison stats
    }
  }
  if (typeof a.submittedAt !== 'string' || !Number.isFinite(Date.parse(a.submittedAt))) {
    a.submittedAt = new Date().toISOString();
  }
  if (typeof a.attemptNumber !== 'number' || !Number.isInteger(a.attemptNumber) || a.attemptNumber < 1) {
    a.attemptNumber = fallbackNumber;
  }
  if (!Array.isArray(a.sections)) {
    a.sections = [];
  } else {
    a.sections = (a.sections as unknown[]).filter(isValidSectionSnapshot);
  }
  if (a.perQuestion !== undefined && !Array.isArray(a.perQuestion)) {
    delete a.perQuestion;
  }
  if (a.questionTimes !== undefined && !isPlainObject(a.questionTimes)) {
    delete a.questionTimes;
  }
  if (a.fsExits !== undefined && !isFiniteNumber(a.fsExits)) {
    delete a.fsExits;
  }
  if (a.tabSwitches !== undefined && !isFiniteNumber(a.tabSwitches)) {
    delete a.tabSwitches;
  }
  if (a.clockTampered !== undefined && typeof a.clockTampered !== 'boolean') {
    delete a.clockTampered;
  }
  if (a.optionsShuffled !== undefined && typeof a.optionsShuffled !== 'boolean') {
    delete a.optionsShuffled;
  }
  if (a.integrity !== undefined && typeof a.integrity !== 'string') {
    delete a.integrity;
  }
  // Verify integrity if hash is present
  if (a.integrity !== undefined) {
    if (a.integrity !== computeAttemptHash((a as unknown) as Attempt)) {
      return null; // Tamper detected — drop the attempt
    }
  }
  return a as unknown as Attempt;
}

/**
 * Deep-ish sanitize of a parsed aether-db blob. Returns a structurally
 * complete db (every top-level key present, every entry valid) plus a
 * report of what was dropped. NEVER throws, regardless of input.
 */
export function validateDb(db: unknown, defaults: AetherDB): { db: AetherDB; report: ValidationReport } {
  const report: ValidationReport = {
    droppedAttempts: 0,
    droppedSavedQuestions: 0,
    fixedStats: false,
  };

  // Top-level must be a plain object; otherwise start from defaults entirely.
  const src: Record<string, unknown> = isPlainObject(db) ? db : {};

  // Settings: merge over defaults, coerce theme to a valid value.
  const srcSettings = isPlainObject(src.settings) ? src.settings : {};
  const rawTheme = srcSettings.theme;
  const theme = rawTheme === 'light' || rawTheme === 'netflix' ? rawTheme : 'dark';
  const settings: AetherDB['settings'] = {
    ...defaults.settings,
    ...(srcSettings as Partial<AetherDB['settings']>),
    theme,
  };
  // Daily goal: must be a positive finite number, otherwise fall back to default.
  if (
    settings.dailyGoalQuestions !== undefined &&
    (!isFiniteNumber(settings.dailyGoalQuestions) || settings.dailyGoalQuestions <= 0)
  ) {
    delete settings.dailyGoalQuestions;
  }

  // Attempts: drop non-array buckets and unrepairable entries.
  const attempts: Record<string, Attempt[]> = {};
  if (isPlainObject(src.attempts)) {
    for (const [path, arr] of Object.entries(src.attempts)) {
      if (!Array.isArray(arr)) {
        report.droppedAttempts++;
        continue;
      }
      const cleaned: Attempt[] = [];
      arr.forEach((raw, i) => {
        const repaired = repairAttempt(raw, i + 1);
        if (repaired) cleaned.push(repaired);
        else report.droppedAttempts++;
      });
      if (cleaned.length) attempts[path] = cleaned;
    }
  }

  // Completed: keep only truthy boolean-ish flags under string keys.
  const completed: Record<string, boolean> = {};
  if (isPlainObject(src.completed)) {
    for (const [path, val] of Object.entries(src.completed)) {
      if (val) completed[path] = true;
    }
  }

  // My List: retain only non-empty string catalog paths, without duplicates.
  const myList = Array.isArray(src.myList)
    ? [...new Set(src.myList.filter((path): path is string => typeof path === 'string' && path.trim() !== '').map((path) => path.trim()))]
    : [];

  // Saved questions: drop malformed records, keep array-per-path shape.
  const savedQuestions: Record<string, SavedQuestionRecord[]> = {};
  if (isPlainObject(src.savedQuestions)) {
    for (const [path, arr] of Object.entries(src.savedQuestions)) {
      if (!Array.isArray(arr)) {
        report.droppedSavedQuestions++;
        continue;
      }
      const cleaned = arr.filter((r): r is SavedQuestionRecord => {
        const ok = isValidSavedQuestion(r);
        if (!ok) report.droppedSavedQuestions++;
        return ok;
      });
      if (cleaned.length) savedQuestions[path] = cleaned;
    }
  }

  // Stats: the store recomputes these on every save, so just guarantee shape.
  let stats = defaults.stats;
  if (isPlainObject(src.stats)) {
    const s = src.stats;
    stats = {
      totalAttempted: isFiniteNumber(s.totalAttempted) ? s.totalAttempted : 0,
      avgAccuracy: isFiniteNumber(s.avgAccuracy) ? s.avgAccuracy : 0,
      bestScore: isPlainObject(s.bestScore) && isFiniteNumber(s.bestScore.score)
        ? (s.bestScore as unknown as AetherDB['stats']['bestScore'])
        : null,
      streakDays: isFiniteNumber(s.streakDays) ? s.streakDays : 0,
      lastActiveDate: typeof s.lastActiveDate === 'string' ? s.lastActiveDate : null,
      byProvider: isPlainObject(s.byProvider)
        ? (s.byProvider as AetherDB['stats']['byProvider'])
        : {},
      bySubject: isPlainObject(s.bySubject)
        ? (s.bySubject as AetherDB['stats']['bySubject'])
        : {},
    };
  } else {
    report.fixedStats = true;
    stats = { ...defaults.stats, byProvider: {}, bySubject: {} };
  }

  const version = isFiniteNumber(src.version) ? src.version : defaults.version;

  return {
    db: { version, settings, attempts, completed, myList, savedQuestions, stats },
    report,
  };
}
