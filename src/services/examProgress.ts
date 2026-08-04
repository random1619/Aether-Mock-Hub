/* EXAM PROGRESS — resume snapshot for an in-progress attempt.
   Persisted separately from aether-db so the heavy history store
   isn't touched on every click. Deliberately zustand-free: the
   examStore drives saves (debounced), this module owns the shape,
   validation, and storage key. */

export interface ExamProgressSnapshot {
  version: 1;
  /** Canonical mock path — the resume offer is keyed to this. */
  path: string;
  /** ISO timestamp of the last write (for "saved 5 min ago" display). */
  savedAt: string;
  answers: Record<number, number>;
  flags: number[];
  visited: number[];
  currentIdx: number;
  currentSectionIdx: number;
  /** Wall-clock deadline (ms epoch). Persisting the DEADLINE (not remaining
      seconds) means a reload can't grant extra time — the clock kept running
      while the tab was closed, exactly like the real TCS exam. */
  endsAt: number;
  questionTimes: Record<number, number>;
  fsExits: number;
  /** Focus-loss violations so far (tab switch / window blur). */
  tabSwitches?: number;
  /** System wall clock jumped mid-exam (possible timer tampering). */
  clockTampered?: boolean;
  /** Whether options were shuffled for this attempt. */
  optionsShuffled?: boolean;
  /** Per-question display permutation: qIdx → original option indices. */
  optionOrder?: Record<number, number[]>;
}

import { keySuffix } from '@/services/profileStore';

/* Namespaced by the active profile (Guest → unsuffixed legacy key, a named
   profile → '::<id>') so an in-progress exam belongs to whoever started it.
   A getter (not a constant) so a profile switch applies on the next access. */
function KEY(): string {
  return `aether-exam-progress${keySuffix()}`;
}

/** Desktop bridge injected by the Electron preload — undefined in browsers. */
function desktop(): any {
  return (window as any).aetherDesktop;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Accept `number | null` so a single hand-edited null answer
    doesn't reject the entire snapshot. Nulls are stripped at restore. */
function isNumericRecord(x: unknown): x is Record<number, number | null> {
  if (!isPlainObject(x)) return false;
  return Object.values(x).every(
    (v) => (typeof v === 'number' && Number.isFinite(v)) || v === null,
  );
}

function isNumberArray(x: unknown): x is number[] {
  return Array.isArray(x) && x.every((v) => typeof v === 'number' && Number.isInteger(v) && v >= 0);
}

function isOptionOrder(x: unknown): x is Record<number, number[]> {
  if (!isPlainObject(x)) return false;
  return Object.values(x).every(isNumberArray);
}

/** Structural validation — a corrupt or hand-edited snapshot is treated as
    absent (and wiped) rather than restored into a broken exam state. The
    anti-cheat fields are optional (older snapshots predate them) but must
    be well-typed when present. */
function isValidSnapshot(x: unknown): x is ExamProgressSnapshot {
  if (!isPlainObject(x)) return false;
  const optionalOk =
    (x.tabSwitches === undefined || (typeof x.tabSwitches === 'number' && Number.isFinite(x.tabSwitches))) &&
    (x.clockTampered === undefined || typeof x.clockTampered === 'boolean') &&
    (x.optionsShuffled === undefined || typeof x.optionsShuffled === 'boolean') &&
    (x.optionOrder === undefined || isOptionOrder(x.optionOrder));
  return (
    optionalOk &&
    x.version === 1 &&
    typeof x.path === 'string' &&
    x.path.length > 0 &&
    typeof x.savedAt === 'string' &&
    typeof x.endsAt === 'number' &&
    Number.isFinite(x.endsAt) &&
    isNumericRecord(x.answers) &&
    isNumericRecord(x.questionTimes) &&
    isNumberArray(x.flags) &&
    isNumberArray(x.visited) &&
    typeof x.currentIdx === 'number' &&
    Number.isInteger(x.currentIdx) &&
    x.currentIdx >= 0 &&
    typeof x.currentSectionIdx === 'number' &&
    Number.isInteger(x.currentSectionIdx) &&
    x.currentSectionIdx >= 0 &&
    typeof x.fsExits === 'number' &&
    Number.isFinite(x.fsExits)
  );
}

/** Persist a snapshot. Silent on failure (quota/private mode) — resume is a
    convenience, never worth breaking the exam over. The snapshot is also
    mirrored to disk through the Electron main process: localStorage commits
    are async, so a hard crash / power cut can lose the last seconds of
    answers. The disk copy survives that (and is written atomically). */
export function saveProgress(snap: ExamProgressSnapshot): void {
  const json = JSON.stringify(snap);
  try {
    localStorage.setItem(KEY(), json);
  } catch {
    /* ignore */
  }
  try {
    desktop()?.autosaveExam?.(json); // fire-and-forget — never blocks the exam
  } catch {
    /* non-Electron */
  }
}

/** Load whatever snapshot exists, or null when missing/invalid. Invalid
    blobs are removed so we don't re-validate the same garbage every load. */
export function loadProgress(): ExamProgressSnapshot | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY());
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isValidSnapshot(parsed)) return parsed;
  } catch {
    /* fall through */
  }
  clearProgress();
  return null;
}

/** Load the snapshot only if it belongs to THIS mock and the exam clock
    hasn't already run out (no point resuming into an instant auto-submit). */
export function loadProgressFor(path: string): ExamProgressSnapshot | null {
  const snap = loadProgress();
  if (!snap || snap.path !== path) return null;
  if (snap.endsAt <= Date.now()) {
    clearProgress();
    return null;
  }
  return snap;
}

/** Crash-recovery path: read the on-disk mirror written by the Electron
    main process. Used when localStorage lost the snapshot (hard crash) —
    same keying and expiry rules as loadProgressFor. Returns null in
    browsers or when no valid mirror exists for this mock. */
export async function loadProgressFromDisk(path: string): Promise<ExamProgressSnapshot | null> {
  const d = desktop();
  if (!d?.loadAutosave) return null;
  try {
    const raw: string | null = await d.loadAutosave();
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSnapshot(parsed) || parsed.path !== path) return null;
    if (parsed.endsAt <= Date.now()) {
      clearProgress();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY());
  } catch {
    /* ignore */
  }
  try {
    desktop()?.clearAutosave?.();
  } catch {
    /* non-Electron */
  }
}
