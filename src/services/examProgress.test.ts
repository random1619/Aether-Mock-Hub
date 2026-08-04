import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveProgress,
  loadProgress,
  loadProgressFor,
  clearProgress,
  type ExamProgressSnapshot,
} from '@/services/examProgress';

const KEY = 'aether-exam-progress';

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

function snap(overrides: Partial<ExamProgressSnapshot> = {}): ExamProgressSnapshot {
  return {
    version: 1,
    path: 'providers/X/a.html',
    savedAt: new Date().toISOString(),
    answers: { 0: 1, 2: 3 },
    flags: [1],
    visited: [0, 1, 2],
    currentIdx: 2,
    currentSectionIdx: 0,
    endsAt: Date.now() + 30 * 60 * 1000,
    questionTimes: { 0: 12, 1: 40 },
    fsExits: 0,
    ...overrides,
  };
}

describe('save/load roundtrip', () => {
  it('restores exactly what was saved', () => {
    const s = snap();
    saveProgress(s);
    expect(loadProgress()).toEqual(s);
  });

  it('returns null when nothing is stored', () => {
    expect(loadProgress()).toBeNull();
  });
});

describe('corruption handling', () => {
  it('returns null AND clears the key on invalid JSON', () => {
    localStorage.setItem(KEY, '{nope');
    expect(loadProgress()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('returns null AND clears the key on a shape violation', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 99, path: 42 }));
    expect(loadProgress()).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('rejects snapshots with non-numeric answers or negative indices', () => {
    localStorage.setItem(KEY, JSON.stringify(snap({ answers: { 0: 'a' } as never })));
    expect(loadProgress()).toBeNull();
    localStorage.setItem(KEY, JSON.stringify(snap({ flags: [-1] })));
    expect(loadProgress()).toBeNull();
  });
});

describe('loadProgressFor', () => {
  it('returns the snapshot when path matches and the clock is still running', () => {
    const s = snap();
    saveProgress(s);
    expect(loadProgressFor('providers/X/a.html')).toEqual(s);
  });

  it('returns null for a different path', () => {
    saveProgress(snap());
    expect(loadProgressFor('providers/X/other.html')).toBeNull();
  });

  it('returns null and clears when the deadline already passed (no resume into auto-submit)', () => {
    saveProgress(snap({ endsAt: Date.now() - 1000 }));
    expect(loadProgressFor('providers/X/a.html')).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('respects fake system time for expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:00:00'));
    saveProgress(snap({ endsAt: Date.now() + 60_000 }));
    vi.setSystemTime(new Date('2026-08-01T10:02:00')); // 1 min past deadline
    expect(loadProgressFor('providers/X/a.html')).toBeNull();
    vi.useRealTimers();
  });
});

describe('clearProgress', () => {
  it('removes the key', () => {
    saveProgress(snap());
    clearProgress();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('is safe to call when nothing exists', () => {
    expect(() => clearProgress()).not.toThrow();
  });
});
