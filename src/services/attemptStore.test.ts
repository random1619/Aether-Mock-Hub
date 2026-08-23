/* attemptStore keeps a module-level singleton, so every test resets modules
   AND localStorage, then dynamically re-imports to force a fresh load(). */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const DB_KEY = 'aether-db';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

const load = () => import('@/services/attemptStore');

function validAttempt(overrides: Record<string, unknown> = {}) {
  return {
    score: 10,
    maxScore: 20,
    correct: 5,
    incorrect: 0,
    unattempted: 5,
    accuracy: 100,
    sections: [],
    submittedAt: new Date().toISOString(),
    attemptNumber: 1,
    ...overrides,
  };
}

function seedDb(overrides: Record<string, unknown> = {}) {
  const db = {
    version: 3,
    settings: { theme: 'dark' },
    attempts: {},
    completed: {},
    savedQuestions: {},
    stats: {},
    ...overrides,
  };
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

describe('load resilience', () => {
  it('starts from defaults when storage is empty', async () => {
    const s = await load();
    expect(s.getDb().attempts).toEqual({});
    expect(s.getStats().totalAttempted).toBe(0);
  });

  it('does NOT write to storage on a fresh import (no top-level save storm)', async () => {
    await load();
    expect(localStorage.getItem(DB_KEY)).toBeNull();
  });

  it('recovers from corrupt JSON and preserves a backup copy', async () => {
    localStorage.setItem(DB_KEY, '{garbage not json');
    const s = await load();
    expect(s.getDb().attempts).toEqual({});
    const backups = Object.keys(localStorage).filter((k) => k.startsWith(`${DB_KEY}.corrupt.`));
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0])).toBe('{garbage not json');
  });

  it('keeps at most 2 corruption backups', async () => {
    for (let i = 0; i < 4; i++) {
      vi.resetModules();
      localStorage.setItem(DB_KEY, `{bad${i}`);
      await load();
    }
    const backups = Object.keys(localStorage).filter((k) => k.startsWith(`${DB_KEY}.corrupt.`));
    expect(backups.length).toBeLessThanOrEqual(2);
  });

  it('drops malformed attempts but keeps the good ones — no NaN in stats', async () => {
    seedDb({
      attempts: {
        'providers/X/a.html': [
          validAttempt({ accuracy: 80 }),
          { score: 'not-a-number', accuracy: 'high' }, // garbage — dropped
          'a string is not an attempt',
          validAttempt({ accuracy: 60 }),
        ],
        'providers/X/b.html': 'not-an-array', // garbage bucket — dropped
      },
    });
    const s = await load();
    expect(s.getAllAttempts('providers/X/a.html')).toHaveLength(2);
    expect(s.getAllAttempts('providers/X/b.html')).toHaveLength(0);
    const stats = s.getStats();
    expect(stats.totalAttempted).toBe(1); // one path with attempts
    expect(Number.isFinite(stats.avgAccuracy)).toBe(true);
    expect(stats.avgAccuracy).toBe(60); // latest attempt on the path
  });

  it('coerces a bad submittedAt instead of dropping the attempt', async () => {
    seedDb({
      attempts: { 'providers/X/a.html': [validAttempt({ submittedAt: 'not-a-date' })] },
    });
    const s = await load();
    const a = s.getLatestAttempt('providers/X/a.html');
    expect(a).not.toBeNull();
    expect(Number.isFinite(Date.parse(a!.submittedAt))).toBe(true);
  });
});

describe('saveAttempt', () => {
  it('appends, marks complete, and trims history to MAX_HISTORY=5', async () => {
    const s = await load();
    for (let i = 1; i <= 7; i++) {
      s.saveAttempt('providers/X/a.html', validAttempt({ score: i }));
    }
    const all = s.getAllAttempts('providers/X/a.html');
    expect(all).toHaveLength(5);
    expect(all[all.length - 1].score).toBe(7);
    expect(s.isComplete('providers/X/a.html')).toBe(true);
    // attemptNumber continues from history length, not trimmed length
    expect(all[all.length - 1].attemptNumber).toBe(6);
  });

  it('canonicalizes paths (backslashes, leading slash, query string)', async () => {
    const s = await load();
    s.saveAttempt('\\providers\\X\\a.html?utm=1#top', validAttempt());
    expect(s.getAllAttempts('providers/X/a.html')).toHaveLength(1);
  });

  it('ignores empty paths', async () => {
    const s = await load();
    s.saveAttempt('', validAttempt());
    expect(s.getDb().attempts).toEqual({});
  });
});

describe('import/export', () => {
  it('roundtrips a valid export', async () => {
    const s = await load();
    s.saveAttempt('providers/X/a.html', validAttempt({ accuracy: 70 }));
    const exported = s.exportJSON();
    localStorage.clear();
    vi.resetModules();
    const s2 = await load();
    expect(s2.importJSON(exported)).toBe(true);
    expect(s2.exportJSON()).toBe(exported);
  });

  it('rejects arrays, primitives, and invalid JSON without touching the db', async () => {
    const s = await load();
    s.saveAttempt('providers/X/a.html', validAttempt());
    expect(s.importJSON('[1,2,3]')).toBe(false);
    expect(s.importJSON('"hello"')).toBe(false);
    expect(s.importJSON('null')).toBe(false);
    expect(s.importJSON('{not json')).toBe(false);
    expect(s.getAllAttempts('providers/X/a.html')).toHaveLength(1);
  });

  it('rejects an import whose attempts are 100% garbage', async () => {
    const s = await load();
    s.saveAttempt('providers/X/a.html', validAttempt());
    const junk = JSON.stringify({
      attempts: { 'providers/X/b.html': [{ score: 'NaN-ish', accuracy: 'high' }] },
    });
    expect(s.importJSON(junk)).toBe(false);
    expect(s.getAllAttempts('providers/X/a.html')).toHaveLength(1);
  });

  it('accepts an import with partially bad data, dropping the bad entries', async () => {
    const s = await load();
    const mixed = JSON.stringify({
      attempts: {
        'providers/X/b.html': [validAttempt({ accuracy: 55 }), { score: 'bad' }],
      },
      completed: { 'providers/X/b.html': true },
    });
    expect(s.importJSON(mixed)).toBe(true);
    expect(s.getAllAttempts('providers/X/b.html')).toHaveLength(1);
  });
});

describe('cross-tab sync', () => {
  function fireStorage(newValue: string | null) {
    window.dispatchEvent(new StorageEvent('storage', { key: DB_KEY, newValue }));
  }

  it('resets to defaults when the key is removed in another tab', async () => {
    const s = await load();
    s.saveAttempt('providers/X/a.html', validAttempt());
    const cb = vi.fn();
    s.onExternalChange(cb);
    fireStorage(null);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(s.getDb().attempts).toEqual({});
  });

  it('applies a valid external write', async () => {
    const s = await load();
    const cb = vi.fn();
    s.onExternalChange(cb);
    fireStorage(
      JSON.stringify({ attempts: { 'providers/X/c.html': [validAttempt()] }, completed: {} }),
    );
    expect(cb).toHaveBeenCalledTimes(1);
    expect(s.getAllAttempts('providers/X/c.html')).toHaveLength(1);
  });

  it('ignores an unparseable external blob and ignores unrelated keys', async () => {
    const s = await load();
    s.saveAttempt('providers/X/a.html', validAttempt());
    const cb = vi.fn();
    s.onExternalChange(cb);
    fireStorage('{broken');
    window.dispatchEvent(new StorageEvent('storage', { key: 'other-key', newValue: 'x' }));
    expect(cb).not.toHaveBeenCalled();
    expect(s.getAllAttempts('providers/X/a.html')).toHaveLength(1);
  });

  it('onDbChange fires for same-tab saves too', async () => {
    const s = await load();
    const cb = vi.fn();
    s.onDbChange(cb);
    s.saveAttempt('providers/X/a.html', validAttempt());
    expect(cb).toHaveBeenCalled();
  });
});

describe('saved questions', () => {
  const q = {
    questionIdx: 3,
    question: 'What is 2+2?',
    options: ['3', '4', '5', '6'],
    correct_option_id: 1,
  };

  it('toggles save on/off and persists', async () => {
    const s = await load();
    expect(s.toggleSaveQuestion('providers/X/a.html', 'Mock A', 'X', q)).toBe(true);
    expect(s.isSavedQuestion('providers/X/a.html', 3)).toBe(true);
    expect(s.toggleSaveQuestion('providers/X/a.html', 'Mock A', 'X', q)).toBe(false);
    expect(s.isSavedQuestion('providers/X/a.html', 3)).toBe(false);
  });

  it('marks reviewed and attaches outcomes', async () => {
    const s = await load();
    s.toggleSaveQuestion('providers/X/a.html', 'Mock A', 'X', q);
    s.markSavedQuestionReviewed('providers/X/a.html', 3);
    s.markSavedQuestionReviewed('providers/X/a.html', 3);
    s.attachAttemptToSaved('providers/X/a.html', [
      { idx: 3, chosen: 0, isCorrect: false, isIncorrect: true, isSkipped: false, flagged: true },
    ]);
    const rec = s.getSavedQuestionsForExam('providers/X/a.html')[0];
    expect(rec.timesReviewed).toBe(2);
    expect(rec.lastOutcome).toBe('incorrect');
    expect(rec.lastChosen).toBe(0);
    expect(rec.lastFlagged).toBe(true);
  });

  it('survives a savedQuestions array containing malformed records', async () => {
    seedDb({
      savedQuestions: {
        'providers/X/a.html': [
          { id: 'ok', examPath: 'providers/X/a.html', examName: 'A', question: 'Q?', questionIdx: 0, options: ['a'], correct_option_id: 0 },
          { bogus: true },
          null,
        ],
      },
    });
    const s = await load();
    const list = s.getSavedQuestionsForExam('providers/X/a.html');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('ok');
  });

  it('manages bookmark folders CRUD and question notes/tags/priority', async () => {
    const s = await load();
    const folders = s.getBookmarkFolders();
    expect(folders.length).toBeGreaterThanOrEqual(4);
    expect(folders.some((f) => f.id === 'default')).toBe(true);

    // Create custom folder
    const created = s.createBookmarkFolder('Math Shortcuts', 'emerald', 'zap', 'High speed quant formulas');
    expect(created.name).toBe('Math Shortcuts');
    expect(created.color).toBe('emerald');

    // Update custom folder
    s.updateBookmarkFolder(created.id, { name: 'Quant Mastery', color: 'purple' });
    const updatedFolders = s.getBookmarkFolders();
    const found = updatedFolders.find((f) => f.id === created.id);
    expect(found?.name).toBe('Quant Mastery');
    expect(found?.color).toBe('purple');

    // Save a question and assign to this folder
    s.toggleSaveQuestion('providers/X/a.html', 'Mock A', 'X', q);
    const allSaved = s.getAllSavedQuestions();
    const qRecord = allSaved.find((r) => r.examPath === 'providers/X/a.html');
    expect(qRecord).toBeDefined();

    // Set folder, notes, priority, tags, star
    s.setQuestionFolder(qRecord!.id, created.id);
    s.setQuestionNotes(qRecord!.id, 'Use compound interest shortcut formula');
    s.setQuestionPriority(qRecord!.id, 'high');
    s.addQuestionTag(qRecord!.id, 'tricky-quant');
    s.toggleStarQuestion(qRecord!.id);

    const reloaded = s.getAllSavedQuestions().find((r) => r.id === qRecord!.id);
    expect(reloaded?.folderId).toBe(created.id);
    expect(reloaded?.notes).toBe('Use compound interest shortcut formula');
    expect(reloaded?.priority).toBe('high');
    expect(reloaded?.tags).toContain('tricky-quant');
    expect(reloaded?.isStarred).toBe(true);

    // Batch operations
    s.batchUpdateSavedQuestions([qRecord!.id], { priority: 'low' });
    expect(s.getAllSavedQuestions().find((r) => r.id === qRecord!.id)?.priority).toBe('low');

    // Delete custom folder (reassigns question to 'default')
    s.deleteBookmarkFolder(created.id);
    const afterDelete = s.getAllSavedQuestions().find((r) => r.id === qRecord!.id);
    expect(afterDelete?.folderId).toBe('default');
  });
});

describe('path migration (applyPathMap)', () => {
  it('moves attempts, completed, saved, and bestScore onto new paths', async () => {
    seedDb({
      attempts: { 'providers/X/old.html': [validAttempt({ accuracy: 80 })] },
      completed: { 'providers/X/old.html': true },
      savedQuestions: {
        'providers/X/old.html': [
          { id: 'providers/X/old.html::3', examPath: 'providers/X/old.html', examName: 'Old', question: 'Q?', questionIdx: 3, options: ['a'], correct_option_id: 0 },
        ],
      },
      stats: { bestScore: { path: 'providers/X/old.html', score: 18, maxScore: 20, accuracy: 90 } },
    });
    const s = await load();
    s.applyPathMap({ 'providers/X/old.html': 'providers/X/new.html' });

    expect(s.getAllAttempts('providers/X/new.html')).toHaveLength(1);
    expect(s.getAllAttempts('providers/X/old.html')).toHaveLength(0);
    expect(s.isComplete('providers/X/new.html')).toBe(true);
    const saved = s.getSavedQuestionsForExam('providers/X/new.html');
    expect(saved).toHaveLength(1);
    expect(saved[0].examPath).toBe('providers/X/new.html');
    expect(saved[0].id).toBe('providers/X/new.html::3');
    expect(s.getStats().bestScore?.path).toBe('providers/X/new.html');
  });

  it('merges attempt histories when both old and new paths have attempts', async () => {
    seedDb({
      attempts: {
        'providers/X/old.html': [validAttempt({ submittedAt: '2026-01-01T00:00:00Z' })],
        'providers/X/new.html': [validAttempt({ submittedAt: '2026-02-01T00:00:00Z' })],
      },
    });
    const s = await load();
    s.applyPathMap({ 'providers/X/old.html': 'providers/X/new.html' });
    const arr = s.getAllAttempts('providers/X/new.html');
    expect(arr).toHaveLength(2);
    // Sorted by submittedAt, renumbered 1..2.
    expect(arr[0].attemptNumber).toBe(1);
    expect(arr[1].attemptNumber).toBe(2);
    expect(arr[0].submittedAt < arr[1].submittedAt).toBe(true);
  });

  it('is a no-op with an empty/absent map and idempotent on repeat', async () => {
    seedDb({ attempts: { 'providers/X/a.html': [validAttempt()] } });
    const s = await load();
    s.applyPathMap(null);
    s.applyPathMap({});
    expect(s.getAllAttempts('providers/X/a.html')).toHaveLength(1);
    s.applyPathMap({ 'providers/X/a.html': 'providers/X/b.html' });
    expect(s.getAllAttempts('providers/X/b.html')).toHaveLength(1);
    // Second application with the same map does nothing further.
    s.applyPathMap({ 'providers/X/a.html': 'providers/X/b.html' });
    expect(s.getAllAttempts('providers/X/b.html')).toHaveLength(1);
  });
});

describe('durability: crash/wipe recovery', () => {
  /** Seed a valid primary blob directly (independent of the save path, so a
      mocked-throwing setItem from another suite can't pollute the setup),
      plus its journal/backup mirrors. */
  function seedDurable(paths: Array<{ path: string; score: number }>) {
    const attempts: Record<string, unknown[]> = {};
    const journal: unknown[] = [];
    paths.forEach(({ path, score }, i) => {
      const a = validAttempt({ score, attemptNumber: 1 });
      attempts[path] = [a];
      journal.push({ path, attempt: a });
      void i;
    });
    const db = {
      version: 3,
      settings: { theme: 'dark' },
      attempts,
      completed: {},
      savedQuestions: {},
      stats: {},
    };
    const blob = JSON.stringify(db);
    localStorage.setItem(DB_KEY, blob);
    localStorage.setItem(`${DB_KEY}.backup`, blob);
    localStorage.setItem(`${DB_KEY}.journal`, JSON.stringify(journal));
  }

  it('resurrects attempts from the journal when every snapshot is wiped', async () => {
    seedDurable([
      { path: 'providers/X/a.html', score: 12 },
      { path: 'providers/X/b.html', score: 18 },
    ]);
    // Simulate eviction / total wipe of the snapshot keys, leaving the journal.
    [DB_KEY, `${DB_KEY}.backup`, `${DB_KEY}.next`].forEach((k) => localStorage.removeItem(k));
    vi.resetModules();
    const s2 = await load();
    expect(s2.getLatestAttempt('providers/X/a.html')?.score).toBe(12);
    expect(s2.getLatestAttempt('providers/X/b.html')?.score).toBe(18);
    expect(s2.getStats().totalAttempted).toBe(2);
  });

  it('restores from the known-good backup when the primary blob is corrupt', async () => {
    seedDurable([{ path: 'providers/X/a.html', score: 15 }]);
    // Simulate a crash mid-write leaving the primary truncated.
    localStorage.setItem(DB_KEY, '{truncated');
    vi.resetModules();
    const s2 = await load();
    expect(s2.getLatestAttempt('providers/X/a.html')?.score).toBe(15);
  });

  it('does not duplicate attempts the snapshot already has when replaying the journal', async () => {
    const s = await load();
    s.saveAttempt('providers/X/a.html', validAttempt({ score: 9 }));
    // Primary intact — journal replay must be a no-op (no double-count).
    vi.resetModules();
    const s2 = await load();
    expect(s2.getAllAttempts('providers/X/a.html')).toHaveLength(1);
    expect(s2.getStats().totalAttempted).toBe(1);
  });

  it('clearAll wipes the journal and backup so history is not resurrected', async () => {
    const s = await load();
    s.saveAttempt('providers/X/a.html', validAttempt({ score: 9 }));
    s.clearAll();
    vi.resetModules();
    const s2 = await load();
    expect(s2.getDb().attempts).toEqual({});
    expect(s2.getStats().totalAttempted).toBe(0);
  });
});

describe('storage health', () => {
  it('reports healthy under normal jsdom storage', async () => {
    const s = await load();
    expect(s.storageHealthy()).toBe(true);
  });

  it('flips to unhealthy when setItem throws, and notify still fires', async () => {
    const s = await load();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const cb = vi.fn();
    s.subscribe(cb);
    s.saveAttempt('providers/X/a.html', validAttempt());
    expect(s.storageHealthy()).toBe(false);
    expect(cb).toHaveBeenCalled(); // in-memory copy still drives the UI
    spy.mockRestore();
  });
});

/* Study planner: daily goal + goal-tied streak */

function dayKey(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoOnDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString();
}

describe('computeStreak (pure)', () => {
  it('counts consecutive goal-met days ending today', async () => {
    const { computeStreak } = await load();
    const activity = { [dayKey(0)]: 30, [dayKey(1)]: 25, [dayKey(2)]: 20 };
    expect(computeStreak(activity, 20)).toBe(3);
  });

  it('forgives an unfinished today and starts from yesterday', async () => {
    const { computeStreak } = await load();
    const activity = { [dayKey(0)]: 5, [dayKey(1)]: 40, [dayKey(2)]: 30 };
    expect(computeStreak(activity, 20)).toBe(2);
  });

  it('breaks on a missed day (not today)', async () => {
    const { computeStreak } = await load();
    const activity = { [dayKey(0)]: 30, [dayKey(1)]: 0, [dayKey(2)]: 50 };
    expect(computeStreak(activity, 20)).toBe(1);
  });

  it('returns 0 for a non-positive goal or no activity', async () => {
    const { computeStreak } = await load();
    expect(computeStreak({ [dayKey(0)]: 100 }, 0)).toBe(0);
    expect(computeStreak({}, 20)).toBe(0);
  });
});

describe('daily goal + today progress', () => {
  it('defaults to the standard goal and counts only answered questions', async () => {
    const s = await load();
    // 5 correct + 3 incorrect = 8 answered; 12 skipped do not count.
    s.saveAttempt('providers/X/a.html', validAttempt({ correct: 5, incorrect: 3, unattempted: 12 }));
    const t = s.getTodayProgress();
    expect(t.done).toBe(8);
    expect(t.goal).toBe(20); // DEFAULT_DAILY_GOAL
    expect(t.met).toBe(false);
  });

  it('marks the goal met and streak starts at 1 once enough questions are answered', async () => {
    const s = await load();
    s.setDailyGoal(10);
    s.saveAttempt('providers/X/a.html', validAttempt({ correct: 8, incorrect: 4 }));
    const t = s.getTodayProgress();
    expect(t.met).toBe(true);
    expect(s.getStats().streakDays).toBe(1);
  });

  it('persists the goal and rejects garbage values', async () => {
    const s = await load();
    s.setDailyGoal(50);
    expect(s.getDailyGoal()).toBe(50);
    s.setDailyGoal(-5);
    expect(s.getDailyGoal()).toBe(50);
  });

  it('rebuilds streak across consecutive days from attempt timestamps', async () => {
    const s = await load();
    s.setDailyGoal(10);
    s.saveAttempt('providers/X/a.html', validAttempt({ correct: 10, incorrect: 0, submittedAt: isoOnDay(2), attemptNumber: 1 }));
    s.saveAttempt('providers/X/a.html', validAttempt({ correct: 10, incorrect: 0, submittedAt: isoOnDay(1), attemptNumber: 2 }));
    s.saveAttempt('providers/X/a.html', validAttempt({ correct: 6, incorrect: 4, submittedAt: isoOnDay(0), attemptNumber: 3 }));
    expect(s.getStats().streakDays).toBe(3);
  });

  it('revision attempts count toward the goal but are excluded from provider stats', async () => {
    const s = await load();
    s.setDailyGoal(10);
    s.saveAttempt('smart-revision/all', validAttempt({ correct: 15, incorrect: 0, accuracy: 100 }));
    const t = s.getTodayProgress();
    expect(t.done).toBe(15);
    expect(t.met).toBe(true);
    // Not a real provider — must not pollute scoring stats.
    expect(s.getStats().byProvider['smart-revision']).toBeUndefined();
    expect(s.getStats().totalAttempted).toBe(0);
  });
});
