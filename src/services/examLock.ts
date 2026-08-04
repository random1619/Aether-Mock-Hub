/* EXAM LOCK — one active attempt per mock across tabs/windows.
   A tab acquires the lock on start/resume and heartbeats it while
   the exam runs. A second tab trying to start the SAME mock is
   blocked until the first lock goes stale (crash-safe: a dead tab
   stops heartbeating, so its lock expires on its own). */

const LOCK_KEY = 'aether-exam-lock';
/** How often the owning tab refreshes the lock. */
export const LOCK_HEARTBEAT_MS = 5000;
/** A lock older than this without a heartbeat belongs to a dead tab. */
const LOCK_STALE_MS = 15000;

/** Stable id for THIS tab/window, generated once per page load. */
const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

interface ExamLock {
  path: string;
  tabId: string;
  heartbeat: number;
}

function readLock(): ExamLock | null {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' && parsed !== null &&
      typeof (parsed as ExamLock).path === 'string' &&
      typeof (parsed as ExamLock).tabId === 'string' &&
      typeof (parsed as ExamLock).heartbeat === 'number'
    ) {
      return parsed as ExamLock;
    }
  } catch {
    /* corrupt or unavailable storage — treat as unlocked */
  }
  return null;
}

function writeLock(path: string): void {
  try {
    const lock: ExamLock = { path, tabId: TAB_ID, heartbeat: Date.now() };
    localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
  } catch {
    /* private mode / quota — locking is best-effort */
  }
}

/** Try to take the lock for this mock. Fails only when a DIFFERENT tab
    holds a fresh lock for the SAME path (stale locks are reclaimed). */
export function acquireExamLock(path: string): boolean {
  const existing = readLock();
  if (
    existing &&
    existing.tabId !== TAB_ID &&
    existing.path === path &&
    Date.now() - existing.heartbeat < LOCK_STALE_MS
  ) {
    return false;
  }
  writeLock(path);
  return true;
}

/** Refresh our lock. No-op when this tab doesn't hold one. */
export function heartbeatExamLock(): void {
  const existing = readLock();
  if (!existing || existing.tabId !== TAB_ID) return;
  writeLock(existing.path);
}

/** Release the lock if WE hold it — never steals another tab's lock. */
export function releaseExamLock(): void {
  const existing = readLock();
  if (!existing || existing.tabId !== TAB_ID) return;
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
}
