/* ATTEMPT STORE — persistence layer
   Mirrors the legacy aether-db (localStorage['aether-db'], schema v2)
   so progress recorded by the React engine is fully compatible with
   — and a superset of — data recorded by the legacy static site. */
import type { AetherDB, Attempt, Stats, SavedQuestionRecord } from '@/types';
import { validateDb } from '@/services/dbValidation';
import { computeAttemptHash } from '@/lib/integrity';
import { keySuffix } from '@/services/profileStore';

/* Profile-aware storage keys
   Every key in the aether-db family is namespaced by the ACTIVE profile via
   keySuffix(): Guest → '' (the original unsuffixed keys, so legacy data and
   the static site are untouched), a named profile → '::<id>'. These are
   getters (not module constants) so a profile switch takes effect on the very
   next read/write, and to avoid an import-order dependency on profileStore. */
const DB_BASE = 'aether-db';
function DB_KEY(): string {
  return `${DB_BASE}${keySuffix()}`;
}
function CORRUPT_PREFIX(): string {
  return `${DB_KEY()}.corrupt.`;
}
const MAX_CORRUPT_BACKUPS = 2;
const SCHEMA_VER = 3;
const MAX_HISTORY = 5;
/** Study planner default: questions to answer per day to keep the streak. */
export const DEFAULT_DAILY_GOAL = 20;
/** Synthetic exam paths (Smart Revision). Revision attempts count toward the
    daily goal/streak but are excluded from score/provider stats — the same
    questions would otherwise be double-counted under a fake provider. */
export const SMART_REVISION_PATH_PREFIX = 'smart-revision/';
/** Synthetic exam paths (Bookmark Mocks generated from saved questions). */
export const BOOKMARK_MOCK_PATH_PREFIX = 'bookmark-mock/';

function defaultDb(): AetherDB {
  return {
    version: SCHEMA_VER,
    settings: { theme: 'light', sectionalTimer: 'default', portalTheme: 'light', dailyGoalQuestions: DEFAULT_DAILY_GOAL },
    attempts: {},
    completed: {},
    myList: [],
    savedQuestions: {},
    stats: {
      totalAttempted: 0,
      avgAccuracy: 0,
      bestScore: null,
      streakDays: 0,
      lastActiveDate: null,
      byProvider: {},
      bySubject: {},
    },
  };
}

export function canonicalizePath(raw: string): string {
  if (!raw) return '';
  return raw.replace(/\\/g, '/').replace(/^\//, '').replace(/\?.*$/, '').replace(/#.*$/, '').trim();
}

/* ── Path migration (mock files renamed by the generator) ────── */
/** Old→new launch-path map, applied to the live DB once per session. */
let _appliedPathMap = false;

/** Move every progress record keyed by an old path onto its new path.
    Idempotent (re-running with the same map is a no-op once keys are moved).
    Returns true when anything changed. */
function remapPaths(db: AetherDB, map: Record<string, string>): boolean {
  // Canonicalize both sides (map keys/values are launch paths; DB keys are
  // canonical — query strings stripped). Build old→new on canonical keys.
  const canon = new Map<string, string>();
  Object.entries(map).forEach(([oldP, newP]) => {
    const o = canonicalizePath(oldP);
    const n = canonicalizePath(newP);
    if (o && n && o !== n) canon.set(o, n);
  });
  if (!canon.size) return false;
  let changed = false;

  const moveKey = <T>(rec: Record<string, T>, oldK: string, newK: string, merge?: (a: T, b: T) => T): void => {
    if (!(oldK in rec)) return;
    const val = rec[oldK];
    if (newK in rec && merge) rec[newK] = merge(rec[newK], val);
    else if (!(newK in rec)) rec[newK] = val;
    delete rec[oldK];
    changed = true;
  };

  canon.forEach((newP, oldP) => {
    // attempts: merge histories (sort by submittedAt, renumber, cap).
    if (oldP in db.attempts) {
      const oldArr = db.attempts[oldP] || [];
      const newArr = db.attempts[newP] || [];
      const merged = [...newArr, ...oldArr]
        .sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''))
        .slice(-MAX_HISTORY)
        .map((a, i) => ({ ...a, attemptNumber: i + 1 }));
      db.attempts[newP] = merged;
      delete db.attempts[oldP];
      changed = true;
    }
    // completed: simple boolean move.
    moveKey(db.completed, oldP, newP, (a, b) => a || b);
    // savedQuestions: move list + rewrite each record's examPath/id.
    if (oldP in db.savedQuestions) {
      const moved = (db.savedQuestions[oldP] || []).map((r) => ({
        ...r,
        examPath: newP,
        id: `${newP}::${r.questionIdx}`,
      }));
      const existing = db.savedQuestions[newP] || [];
      db.savedQuestions[newP] = [...existing, ...moved];
      delete db.savedQuestions[oldP];
      changed = true;
    }
    // bestScore path.
    if (db.stats.bestScore && db.stats.bestScore.path === oldP) {
      db.stats.bestScore = { ...db.stats.bestScore, path: newP };
      changed = true;
    }
  });

  // byProvider/bySubject are fully rebuilt from attempts on the next save()'s
  // recomputeStats, so no need to hand-edit them here.
  return changed;
}

function migrate(db: AetherDB): AetherDB {
  const def = defaultDb();
  if (!db.version || db.version < SCHEMA_VER) db.version = SCHEMA_VER;
  db.settings = { ...def.settings, ...(db.settings || {}) };
  db.attempts = db.attempts || {};
  db.completed = db.completed || {};
  db.myList = Array.isArray(db.myList) ? [...new Set(db.myList.map(canonicalizePath).filter(Boolean))] : [];
  db.savedQuestions = db.savedQuestions || {};
  db.stats = { ...def.stats, ...(db.stats || {}) };
  db.stats.byProvider = db.stats.byProvider || {};
  db.stats.bySubject = db.stats.bySubject || {};
  return db;
}

/** Apply the generator's old→new path map to the live DB and persist it.
    Called once per session by the app bootstrap after the catalog (and its
    MOCK_PATH_MAP) has loaded — the DB singleton initializes synchronously at
    module import, before the async catalog fetch resolves, so this can't run
    during initial migrate(). Idempotent and a no-op when there's no map. */
export function applyPathMap(map: Record<string, string> | null): void {
  // Latch only on a real map — a null/empty call must not lock out a later,
  // genuine map (the bootstrap fires once, but tests and retries may call again).
  if (_appliedPathMap) return;
  if (!map || !Object.keys(map).length) return;
  _appliedPathMap = true;
  try {
    if (remapPaths(_db, map)) save();
  } catch (e) {
    console.warn('[attemptStore] path remap failed; keeping original paths', e);
  }
}

function migrateFromLegacy(db: AetherDB): AetherDB {
  try {
    const theme = localStorage.getItem('aether-theme');
    if (theme === 'dark' || theme === 'light') db.settings.theme = theme;
    const cr = localStorage.getItem('completedMocks');
    if (cr) {
      const co = JSON.parse(cr) as Record<string, boolean>;
      Object.keys(co).forEach((p) => {
        const c = canonicalizePath(p);
        if (c) db.completed[c] = true;
      });
    }
    const sr = localStorage.getItem('mockScores');
    if (sr) {
      const sc = JSON.parse(sr) as Record<string, Partial<Attempt>>;
      Object.keys(sc).forEach((p) => {
        const d = sc[p];
        const c = canonicalizePath(p);
        if (!c) return;
        db.attempts[c] = [
          {
            score: d.score || 0,
            maxScore: d.maxScore || 0,
            correct: d.correct || 0,
            incorrect: d.incorrect || 0,
            unattempted: d.unattempted || 0,
            accuracy: d.accuracy || 0,
            sections: d.sections || [],
            submittedAt: d.submittedAt || new Date().toISOString(),
            attemptNumber: 1,
          },
        ];
        db.completed[c] = true;
      });
    }
    ['mockScores', 'completedMocks', 'aether-theme', 'sectionalTimerOverride'].forEach((k) =>
      localStorage.removeItem(k),
    );
  } catch (e) {
    console.warn('[attemptStore] legacy migration partial failure', e);
  }
  return db;
}

/** Questions answered per local day (YYYY-MM-DD → count). Skipped questions
    don't count — answering is the effort the study planner rewards. Smart
    Revision attempts DO count: revision is real practice. */
function computeDayActivity(db: AetherDB): Record<string, number> {
  const activity: Record<string, number> = {};
  Object.values(db.attempts).forEach((arr) => {
    if (!arr) return;
    arr.forEach((a) => {
      const key = localDayKey(new Date(a.submittedAt));
      const answered = (a.correct || 0) + (a.incorrect || 0);
      activity[key] = (activity[key] || 0) + answered;
    });
  });
  return activity;
}

function goalOf(db: AetherDB): number {
  const g = db.settings.dailyGoalQuestions;
  return Number.isFinite(g) && (g as number) > 0 ? Math.round(g as number) : DEFAULT_DAILY_GOAL;
}

/** Consecutive days meeting the daily goal, ending today (or yesterday when
    today is still in progress — an unfinished today must not BREAK a streak).
    Exported (pure) for tests. */
export function computeStreak(
  activity: Record<string, number>,
  goal: number,
  fromDay: Date = new Date(),
): number {
  if (goal <= 0) return 0;
  let streak = 0;
  const cursor = new Date(fromDay);
  for (let i = 0; i < 3700; i++) { // ~10y safety bound
    const key = localDayKey(cursor);
    if ((activity[key] || 0) >= goal) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (i === 0) {
      // Today hasn't hit the goal yet — forgive and start from yesterday.
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  return streak;
}

function recomputeStats(db: AetherDB): void {
  const stats: Stats = db.stats;
  stats.byProvider = {};
  stats.bySubject = {};
  let totalAcc = 0;
  let totalCount = 0;
  let best: Stats['bestScore'] = null;

  Object.keys(db.attempts).forEach((path) => {
    const arr = db.attempts[path];
    if (!arr || !arr.length) return;
    // Smart Revision and Bookmark Mock attempts feed the streak/daily goal (via computeDayActivity)
    // but not scoring stats — their questions already counted under the real mock.
    if (path.startsWith(SMART_REVISION_PATH_PREFIX) || path.startsWith(BOOKMARK_MOCK_PATH_PREFIX)) return;
    const latest = arr[arr.length - 1];
    totalAcc += latest.accuracy || 0;
    totalCount++;
    const score = Number.isFinite(latest.score) ? latest.score : 0;
    if (!best || score > best.score) {
      best = { path, score, maxScore: latest.maxScore, accuracy: latest.accuracy };
    }
    // Prefer the friendly provider name stored on the attempt (from the
    // mock catalog). Fall back to path-segment extraction for attempts
    // recorded before this field existed.
    const provider = latest.provider || path.split('/').slice(0, -1).join('/') || 'Unknown';
    const ps = stats.byProvider[provider] || { attempted: 0, totalAcc: 0, avgAccuracy: 0 };
    ps.attempted++;
    ps.totalAcc += latest.accuracy || 0;
    ps.avgAccuracy = Math.round(ps.totalAcc / ps.attempted);
    stats.byProvider[provider] = ps;
  });

  stats.totalAttempted = totalCount;
  stats.avgAccuracy = totalCount > 0 ? Math.round(totalAcc / totalCount) : 0;
  stats.bestScore = best;

  const activity = computeDayActivity(db);
  stats.streakDays = computeStreak(activity, goalOf(db));
  if (Object.keys(activity).length > 0) stats.lastActiveDate = localDayKey();
}

/** Local-calendar YYYY-MM-DD. Streaks track the user's wall clock, so using
    UTC here would roll the day over at the wrong hour for anyone off-UTC. */
export function localDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* In-memory singleton DB */
let _db: AetherDB = defaultDb();
/** false once a write has failed (quota/private mode) — in-memory copy
    stays authoritative for the tab, but callers can warn the user. */
let _storageHealthy = true;

/** UI hook fired the first time a save fails (and on recovery). Injected by
    main.tsx so this service stays UI-free and testable. */
let _onStorageHealthChange: ((healthy: boolean) => void) | null = null;
export function setStorageHealthListener(cb: (healthy: boolean) => void): void {
  _onStorageHealthChange = cb;
}

/** One-time probe: Safari private mode (and some locked-down browsers)
    throw on setItem even though getItem works. Detect before first save. */
function probeStorage(): void {
  try {
    localStorage.setItem('__aether_probe__', '1');
    localStorage.removeItem('__aether_probe__');
  } catch {
    _storageHealthy = false;
  }
}

/** Best-effort rescue of a corrupted blob before we reset over it. Keeps at
    most MAX_CORRUPT_BACKUPS copies so repeated corruption can't eat quota. */
function backupCorrupt(raw: string): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CORRUPT_PREFIX())) stale.push(k);
    }
    stale.sort();
    while (stale.length >= MAX_CORRUPT_BACKUPS) {
      const oldest = stale.shift();
      if (oldest) localStorage.removeItem(oldest);
    }
    localStorage.setItem(`${CORRUPT_PREFIX()}${Date.now()}`, raw);
  } catch {
    /* quota already exhausted — losing the backup is acceptable */
  }
}

/** Parse + validate + migrate a raw aether-db blob. Returns null when the
    blob is unparseable JSON (caller decides the fallback). */
function parseDbBlob(raw: string): { db: AetherDB; changed: boolean } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const { db, report } = validateDb(parsed, defaultDb());
  const dropped = report.droppedAttempts + report.droppedSavedQuestions;
  if (dropped > 0) {
    console.warn(
      `[attemptStore] dropped ${report.droppedAttempts} malformed attempt(s), ` +
        `${report.droppedSavedQuestions} malformed saved question(s)`,
    );
  }
  const migrated = migrate(db);
  // "changed" = validation or migration actually altered the blob — used to
  // avoid rewriting storage on every page load when nothing moved.
  const changed = dropped > 0 || report.fixedStats || JSON.stringify(parsed) !== JSON.stringify(migrated);
  return { db: migrated, changed };
}

/** Recover the best available db when the primary snapshot is missing or
    unparseable: a surviving staging slot → the known-good backup → a rebuild
    purely from the append-only journal. Returns null when nothing usable
    exists (caller falls back to legacy/default). */
function recoverFromBackups(): { db: AetherDB; shouldPersist: boolean } | null {
  const staged = safeGet(STAGING_KEY());
  if (staged) {
    const parsed = parseDbBlob(staged);
    if (parsed) {
      recoverFromJournal(parsed.db);
      return { db: parsed.db, shouldPersist: true };
    }
    safeRemove(STAGING_KEY());
  }
  const backup = safeGet(BACKUP_KEY());
  if (backup) {
    const parsed = parseDbBlob(backup);
    if (parsed) {
      recoverFromJournal(parsed.db);
      return { db: parsed.db, shouldPersist: true };
    }
  }
  const journalDb = defaultDb();
  if (recoverFromJournal(journalDb)) {
    console.warn('[attemptStore] primary store lost — resurrected attempts from journal');
    return { db: migrateFromLegacy(journalDb), shouldPersist: true };
  }
  return null;
}

function load(): { db: AetherDB; shouldPersist: boolean } {
  probeStorage();
  let hadBlob = false;
  try {
    const r = localStorage.getItem(DB_KEY());
    if (r) {
      hadBlob = true;
      const parsed = parseDbBlob(r);
      if (parsed) {
        // Healthy snapshot. Fold in any journaled attempts the snapshot is
        // missing (e.g. the journal commit landed but the snapshot write was
        // lost to a crash), then persist only if that actually changed data.
        const recovered = recoverFromJournal(parsed.db);
        return { db: parsed.db, shouldPersist: parsed.changed || recovered };
      }
      // Corrupted: preserve the blob for forensics, then recover from the
      // backup/journal rather than wiping the user's history to empty.
      console.warn('[attemptStore] DB parse error, backing up corrupted blob and recovering');
      backupCorrupt(r);
      const rescued = recoverFromBackups();
      if (rescued) return rescued;
    } else {
      // Primary key missing (eviction / crash mid-commit / partial wipe).
      const rescued = recoverFromBackups();
      if (rescued) return rescued;
    }
  } catch (e) {
    console.warn('[attemptStore] DB load error, resetting', e);
  }
  const fresh = migrateFromLegacy(defaultDb());
  // Persist only when there was something to overwrite (a corrupted blob or
  // migrated legacy keys) — a first-run visitor with empty storage shouldn't
  // trigger a write + notify storm just by loading the page.
  return { db: fresh, shouldPersist: hadBlob };
}

/* Durability: atomic commit + backups + journal
   The whole history lives in ONE localStorage blob, so a partial/failed
   write (quota from heavy perQuestion arrays, private mode, eviction, or a
   crash mid-setItem) used to wipe everything. These helpers give the
   completed-attempt store the same crash-proofing the in-progress snapshot
   already had: a two-slot atomic commit, a verified read-back, a known-good
   backup slot, and an append-only journal of every attempt. */

/** Second commit slot. save() writes HERE first, verifies it, and only then
    copies it over the primary key — so a crash mid-commit never leaves the
    primary truncated. */
function STAGING_KEY(): string {
  return `${DB_KEY()}.next`;
}
/** Last blob that was verified durably written. Load falls back to this when
    the primary is missing/corrupt. */
function BACKUP_KEY(): string {
  return `${DB_KEY()}.backup`;
}
/** Append-only log of committed attempts. If the main store is ever lost,
    load() replays this to resurrect attempts the snapshots don't have. */
function JOURNAL_KEY(): string {
  return `${DB_KEY()}.journal`;
}
/** Blob size (chars) above which we try to shed review detail before giving
    up on a quota-rejected write. History + correctness are never sacrificed —
    only re-renderable review/time data goes. */
const QUOTA_TRIM_THRESHOLD = 3_500_000;
const MAX_JOURNAL_ENTRIES = 300;

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function safeSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Strip re-renderable review detail from attempts older than each path's
    latest, to shrink the blob under storage pressure. The most recent attempt
    keeps full perQuestion data; older attempts keep minimal perQuestion (just
    the chosen answer) so review mode can still display user responses.
    questionTimes are removed from older attempts as they can be re-derived.
    The score history (which drives stats/streaks) is untouched. */
function trimForQuota(db: AetherDB): void {
  Object.values(db.attempts).forEach((arr) => {
    if (!arr) return;
    arr.forEach((a, i) => {
      if (i < arr.length - 1) {
        // For older attempts: trim perQuestion to minimal data (just chosen answer)
        // and remove questionTimes to save space
        if (Array.isArray(a.perQuestion)) {
          a.perQuestion = a.perQuestion.map((pq) => ({
            idx: pq.idx,
            chosen: pq.chosen,
            correctOption: pq.correctOption,
            isCorrect: pq.isCorrect,
            isIncorrect: pq.isIncorrect,
            isSkipped: pq.isSkipped,
            flagged: pq.flagged,
            timeSec: pq.timeSec || 0,
          }));
        }
        delete a.questionTimes;
      }
    });
  });
}

/** Durably persist `serialized`. Two-slot commit: write the staging slot,
    read it back to confirm it landed byte-for-byte, then copy it over the
    primary. Returns false when even the trim fallback couldn't be written
    (quota / private mode) — the in-memory copy stays authoritative. */
function writeDurably(serialized: string): boolean {
  if (!safeSet(STAGING_KEY(), serialized)) return false;
  // Verify the staged write actually landed (some engines accept setItem but
  // silently truncate/evict under pressure).
  if (safeGet(STAGING_KEY()) !== serialized) return false;
  if (!safeSet(DB_KEY(), serialized)) return false;
  safeRemove(STAGING_KEY()); // committed — staging no longer needed
  // Record the verified blob as the known-good fallback.
  safeSet(BACKUP_KEY(), serialized);
  return true;
}

/** save() with a quota escape hatch. On a quota failure we recompute stats,
    shed review detail from older attempts, and retry — so history survives a
    full storage bucket instead of dying with the setItem exception. */
function save(): void {
  try {
    recomputeStats(_db);
    if (writeDurably(JSON.stringify(_db))) {
      if (!_storageHealthy) _onStorageHealthChange?.(true); // recovered
      _storageHealthy = true;
    } else {
      throw new Error('quota'); // fall to the unhealthy branch below
    }
  } catch (e) {
    // First failure: try to shrink under the quota and retry once.
    let recovered = false;
    try {
      const current = JSON.stringify(_db);
      if (current.length > QUOTA_TRIM_THRESHOLD) {
        trimForQuota(_db);
        recomputeStats(_db);
        recovered = writeDurably(JSON.stringify(_db));
      }
    } catch {
      recovered = false;
    }
    if (recovered) {
      if (!_storageHealthy) _onStorageHealthChange?.(true);
      _storageHealthy = true;
    } else {
      // Quota exceeded or storage blocked: keep serving the in-memory copy so
      // the session stays usable, but flag it so a caller can surface a warning.
      if (_storageHealthy) _onStorageHealthChange?.(false); // fire once per failure streak
      _storageHealthy = false;
      console.error('[attemptStore] save failed — data will not survive reload', e);
    }
  }
  // Notify same-tab subscribers so memoized stats/scores re-derive. The
  // `storage` event only fires in OTHER tabs, so without this an in-tab
  // submit leaves Dashboard/Analytics showing stale numbers until reload.
  notify();
}

/** Whether the last persistence attempt succeeded. False ⇒ anything saved
    this session lives only in memory and will vanish on reload. */
export function storageHealthy(): boolean {
  return _storageHealthy;
}

/* Attempt journal (append-only durability log) */
interface JournalEntry {
  path: string;
  attempt: Attempt;
}

function readJournal(): JournalEntry[] {
  const raw = safeGet(JOURNAL_KEY());
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is JournalEntry =>
        isPlainObject(e) && typeof e.path === 'string' && isPlainObject(e.attempt),
    );
  } catch {
    return [];
  }
}

/** Append a committed attempt to the journal. Best-effort: a journal failure
    never breaks the submit — it's a recovery net, not the primary store. */
function appendToJournal(path: string, attempt: Attempt): void {
  const entries = readJournal();
  entries.push({ path, attempt });
  const trimmed = entries.slice(-MAX_JOURNAL_ENTRIES);
  if (!safeSet(JOURNAL_KEY(), JSON.stringify(trimmed))) {
    // Journal itself is too big — drop the oldest half and retry once.
    safeSet(JOURNAL_KEY(), JSON.stringify(trimmed.slice(-Math.ceil(MAX_JOURNAL_ENTRIES / 2))));
  }
}

/** Merge journaled attempts into `db.attempts` where the snapshot is missing
    them. Identity is (submittedAt + attemptNumber) so a replay never creates
    a duplicate of an attempt the snapshot already has. Trims to MAX_HISTORY
    and renumbers, matching saveAttempt's normal shape. Returns true on change. */
function recoverFromJournal(db: AetherDB): boolean {
  const entries = readJournal();
  if (!entries.length) return false;
  let changed = false;
  entries.forEach(({ path, attempt }) => {
    const key = canonicalizePath(path);
    if (!key) return;
    const arr = db.attempts[key] || (db.attempts[key] = []);
    const exists = arr.some(
      (a) => a.submittedAt === attempt.submittedAt && a.attemptNumber === attempt.attemptNumber,
    );
    if (!exists) {
      arr.push(attempt);
      changed = true;
    }
  });
  if (changed) {
    Object.keys(db.attempts).forEach((key) => {
      db.attempts[key] = db.attempts[key]
        .sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''))
        .slice(-MAX_HISTORY)
        .map((a, i) => ({ ...a, attemptNumber: i + 1 }));
    });
  }
  return changed;
}

/* Same-tab change notification */
const _listeners = new Set<() => void>();

/** Subscribe to ANY aether-db change (same-tab saves + cross-tab writes). */
export function subscribe(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function notify(): void {
  _listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* a broken listener shouldn't break persistence */
    }
  });
}

/* Initialize the singleton. Only persist when load() actually changed the
   data (migration or dropped garbage) — previously a top-level save() ran on
   EVERY page load, rewriting storage and broadcasting a notify() storm even
   when nothing had moved. */
{
  const loaded = load();
  _db = loaded.db;
  if (loaded.shouldPersist) save();
}

/** Re-read the DB for the CURRENT active profile into the singleton and
    notify every subscriber. Called (from main.tsx) after a profile switch: the
    storage keys are namespaced by profile, so the in-memory copy from the
    previous profile must be discarded and the new profile's blob loaded. The
    notify() drives the dbTick pattern in Dashboard/Analytics/ProviderPage so
    the whole UI re-derives against the new profile's data. */
export function reloadForProfile(): void {
  const loaded = load();
  _db = loaded.db;
  if (loaded.shouldPersist) save();
  notify();
}

/* ── Public API ──────────────────────────────────────────────── */
export function saveAttempt(rawPath: string, data: Omit<Attempt, 'attemptNumber' | 'submittedAt'> & { submittedAt?: string }): void {
  const path = canonicalizePath(rawPath);
  if (!path) return;
  const existing = _db.attempts[path] || [];
  const attempt: Attempt = {
    ...data,
    attemptNumber: existing.length + 1,
    submittedAt: data.submittedAt || new Date().toISOString(),
  };
  // Tamper-evident seal: casual localStorage score edits are detectable on read.
  attempt.integrity = computeAttemptHash(attempt);
  existing.push(attempt);
  _db.attempts[path] = existing.slice(-MAX_HISTORY);
  _db.completed[path] = true;
  save();
  // Append-only journal: an independent copy of this attempt that load() can
  // replay if the snapshot blob is ever lost/corrupt. Runs after save() and
  // is best-effort, so it can never break the submit path.
  appendToJournal(path, attempt);
}

export function getLatestAttempt(rawPath: string): Attempt | null {
  const arr = _db.attempts[canonicalizePath(rawPath)];
  return arr && arr.length ? arr[arr.length - 1] : null;
}

export function getAllAttempts(rawPath: string): Attempt[] {
  return _db.attempts[canonicalizePath(rawPath)] || [];
}

export function getLatestScoresMap(): Record<string, Attempt> {
  const m: Record<string, Attempt> = {};
  Object.keys(_db.attempts).forEach((p) => {
    const a = _db.attempts[p];
    if (a && a.length) m[p] = a[a.length - 1];
  });
  return m;
}

export function isComplete(rawPath: string): boolean {
  return !!_db.completed[canonicalizePath(rawPath)];
}

export function toggleComplete(rawPath: string): boolean {
  const p = canonicalizePath(rawPath);
  if (!p) return false;
  if (_db.completed[p]) delete _db.completed[p];
  else _db.completed[p] = true;
  save();
  return !!_db.completed[p];
}

export function getMyList(): string[] {
  return [..._db.myList];
}

export function isInMyList(rawPath: string): boolean {
  return _db.myList.includes(canonicalizePath(rawPath));
}

export function toggleMyList(rawPath: string): boolean {
  const path = canonicalizePath(rawPath);
  if (!path) return false;
  if (_db.myList.includes(path)) _db.myList = _db.myList.filter((item) => item !== path);
  else _db.myList.push(path);
  save();
  return _db.myList.includes(path);
}

export function getStats(): Stats {
  return JSON.parse(JSON.stringify(_db.stats));
}

/* ── Study planner (daily goal + streak) ─────────────────────── */

export function getDailyGoal(): number {
  return goalOf(_db);
}

export function setDailyGoal(n: number): void {
  if (!Number.isFinite(n) || n <= 0) return;
  _db.settings.dailyGoalQuestions = Math.min(1000, Math.round(n));
  save();
}

/** Live per-day activity (YYYY-MM-DD → questions answered). Recomputed from
    attempts on every call so it's never stale, even before the next save. */
export function getDayActivity(): Record<string, number> {
  return computeDayActivity(_db);
}

export interface TodayProgress {
  done: number;
  goal: number;
  met: boolean;
}

export function getTodayProgress(): TodayProgress {
  const goal = goalOf(_db);
  const done = computeDayActivity(_db)[localDayKey()] || 0;
  return { done, goal, met: done >= goal };
}

export function getDb(): AetherDB {
  return _db;
}

/** Persist the theme atomically: mutate + save in one step so the preference
     survives reload and isn't wiped by a cross-tab storage sync. */
export function setTheme(theme: 'dark' | 'light' | 'netflix' | 'onepiece'): void {
  _db.settings.theme = theme;
  save();
}

export function getSectionalTimerPreference(): string {
  return _db.settings.sectionalTimer || 'auto';
}

export function setSectionalTimerPreference(val: 'auto' | 'always' | 'never' | string): void {
  _db.settings.sectionalTimer = val;
  save();
}

export function onExternalChange(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== DB_KEY()) return;
    // Key removed in another tab (clearAll / storage wipe): reset here too,
    // otherwise this tab keeps serving stale data indefinitely.
    if (e.newValue === null) {
      _db = defaultDb();
      cb();
      return;
    }
    // Ignore no-op echoes: another tab re-saved an identical blob (e.g. its own
    // migration rewrote storage). Without this guard, two tabs can ping-pong
    // writes forever, and each replace discards this tab's unsaved mutations.
    if (e.newValue === JSON.stringify(_db)) return;
    const parsed = parseDbBlob(e.newValue);
    if (parsed) {
      _db = parsed.db;
      cb();
    }
    /* unparseable external blob: ignore — this tab's copy stays authoritative */
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Subscribe to aether-db changes from BOTH this tab and other tabs. This is
    the subscription pages should use so memoized stats never go stale. */
export function onDbChange(cb: () => void): () => void {
  const offLocal = subscribe(cb);
  const offExternal = onExternalChange(cb);
  return () => {
    offLocal();
    offExternal();
  };
}

export function exportJSON(): string {
  return JSON.stringify(_db, null, 2);
}

export function importJSON(s: string): boolean {
  let p: unknown;
  try {
    p = JSON.parse(s);
  } catch {
    return false;
  }
  // Reject outright garbage: arrays, primitives, null. Previously these were
  // accepted and detonated inside recomputeStats on the next save.
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  const { db, report } = validateDb(p, defaultDb());
  // If the input claimed to have attempts but every single one was garbage,
  // this isn't an aether-db export — refuse rather than wipe the user's data.
  const claimedAttempts = Object.keys((p as Record<string, unknown>).attempts || {}).length > 0;
  if (claimedAttempts && report.droppedAttempts > 0 && Object.keys(db.attempts).length === 0) {
    return false;
  }
  _db = migrate(db);
  save();
  return true;
}

export function clearAll(): void {
  _db = defaultDb();
  save();
  // A full reset must also clear the recovery nets, otherwise the wiped
  // history would be resurrected from the journal/backup on the next load.
  safeRemove(JOURNAL_KEY());
  safeRemove(BACKUP_KEY());
  safeRemove(STAGING_KEY());
}

/* ── Subject tracking (rolled up from per-question data) ──────── */
/** Called from examStore.submit so bySubject stats become accurate. */
export function recordSubjectAttempt(subjectLabel: string, accuracy: number): void {
  subjectLabel = (subjectLabel || 'General').trim() || 'General';
  const s = _db.stats;
  const prev = s.bySubject[subjectLabel] || { attempted: 0, totalAcc: 0, avgAccuracy: 0 };
  prev.attempted += 1;
  prev.totalAcc += accuracy;
  prev.avgAccuracy = Math.round(prev.totalAcc / prev.attempted);
  s.bySubject[subjectLabel] = prev;
  save();
}

/* ── Saved Questions ─────────────────────────────────────────── */

/** Stable id for a question inside an attempt: examPath#qIdx. */
function savedQId(examPath: string, questionIdx: number): string {
  return `${examPath}::${questionIdx}`;
}

/** Toggle a question's "saved" status. Returns the new state. */
export function toggleSaveQuestion(
  examPath: string,
  examName: string,
  provider: string | undefined,
  q: {
    questionIdx: number;
    question: string;
    comp?: string;
    options: string[];
    correct_option_id: number;
    solution?: string;
    marks?: number;
  },
): boolean {
  const path = canonicalizePath(examPath);
  if (!path) return false;
  const list = _db.savedQuestions[path] || [];
  const id = savedQId(path, q.questionIdx);
  const existing = list.findIndex((r) => r.id === id);
  if (existing >= 0) {
    list.splice(existing, 1);
    _db.savedQuestions[path] = list;
    save();
    return false;
  }
  const rec: SavedQuestionRecord = {
    id,
    examPath: path,
    examName,
    provider,
    questionIdx: q.questionIdx,
    savedAt: new Date().toISOString(),
    question: q.question,
    comp: q.comp,
    options: [...q.options],
    correct_option_id: q.correct_option_id,
    solution: q.solution,
    marks: q.marks,
    timesReviewed: 0,
  };
  list.push(rec);
  _db.savedQuestions[path] = list;
  save();
  return true;
}

export function isSavedQuestion(examPath: string, questionIdx: number): boolean {
  const list = _db.savedQuestions[canonicalizePath(examPath)] || [];
  return list.some((r) => r.questionIdx === questionIdx);
}

export function getSavedQuestionsForExam(examPath: string): SavedQuestionRecord[] {
  return [...(_db.savedQuestions[canonicalizePath(examPath)] || [])];
}

/** All saved questions flattened — useful for a "Bookmarked" page. */
export function getAllSavedQuestions(): SavedQuestionRecord[] {
  const out: SavedQuestionRecord[] = [];
  Object.values(_db.savedQuestions).forEach((arr) => out.push(...arr));
  return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Track a "revisit" of a saved question (post-submit review). */
export function markSavedQuestionReviewed(examPath: string, questionIdx: number): void {
  const list = _db.savedQuestions[canonicalizePath(examPath)];
  if (!list) return;
  const rec = list.find((r) => r.questionIdx === questionIdx);
  if (!rec) return;
  rec.timesReviewed = (rec.timesReviewed || 0) + 1;
  save();
}

/** Update the lastOutcome fields after submit so the saved snapshot knows
    whether the user got the question right or wrong. */
export function attachAttemptToSaved(
  examPath: string,
  perQuestion: Array<{
    idx: number;
    chosen?: number;
    isCorrect: boolean;
    isIncorrect: boolean;
    isSkipped: boolean;
    flagged: boolean;
  }>,
): void {
  const path = canonicalizePath(examPath);

  // For bookmark mocks, decode question IDs and update records across all source mocks
  if (path.startsWith(BOOKMARK_MOCK_PATH_PREFIX)) {
    let dirty = false;
    const prefix = `${BOOKMARK_MOCK_PATH_PREFIX}cfg:`;
    if (path.startsWith(prefix)) {
      try {
        const b64 = path.slice(prefix.length).replace(/-/g, '+').replace(/_/g, '/');
        const cfg = JSON.parse(decodeURIComponent(atob(b64)));
        if (Array.isArray(cfg.questionIds)) {
          perQuestion.forEach((p) => {
            const targetId = cfg.questionIds[p.idx];
            if (!targetId) return;
            for (const list of Object.values(_db.savedQuestions)) {
              const rec = list.find((r) => r.id === targetId);
              if (rec) {
                rec.lastChosen = p.chosen;
                rec.lastOutcome = p.isCorrect ? 'correct' : p.isIncorrect ? 'incorrect' : 'skipped';
                rec.lastFlagged = p.flagged;
                rec.timesReviewed = (rec.timesReviewed || 0) + 1;
                dirty = true;
                break;
              }
            }
          });
        }
      } catch {
        /* fallback */
      }
    }
    if (dirty) save();
    return;
  }

  const list = _db.savedQuestions[path];
  if (!list || !list.length) return;
  let dirty = false;
  perQuestion.forEach((p) => {
    const rec = list.find((r) => r.questionIdx === p.idx);
    if (!rec) return;
    rec.lastChosen = p.chosen;
    rec.lastOutcome = p.isCorrect ? 'correct' : p.isIncorrect ? 'incorrect' : 'skipped';
    rec.lastFlagged = p.flagged;
    dirty = true;
  });
  if (dirty) save();
}
