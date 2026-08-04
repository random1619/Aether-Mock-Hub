import { describe, it, expect } from 'vitest';
import { computeSectionStats } from '@/services/sectionAnalytics';
import type { AetherDB, Attempt, PerQuestionRecord } from '@/types';

function pq(idx: number, over: Partial<PerQuestionRecord> = {}): PerQuestionRecord {
  return {
    idx,
    chosen: undefined,
    correctOption: 0,
    isCorrect: false,
    isIncorrect: false,
    isSkipped: true,
    flagged: false,
    timeSec: 0,
    ...over,
  };
}

function attempt(over: Partial<Attempt> = {}): Attempt {
  return {
    score: 0,
    maxScore: 100,
    correct: 0,
    incorrect: 0,
    unattempted: 0,
    accuracy: 0,
    sections: [],
    submittedAt: '2026-08-01T10:00:00.000Z',
    attemptNumber: 1,
    ...over,
  };
}

function db(attempts: Record<string, Attempt[]>): AetherDB {
  return {
    version: 2,
    settings: { theme: 'dark' },
    attempts,
    completed: {},
    myList: [],
    savedQuestions: {},
    stats: {} as AetherDB['stats'],
  };
}

describe('computeSectionStats', () => {
  it('returns empty when there are no attempts', () => {
    expect(computeSectionStats(db({}))).toEqual([]);
  });

  it('aggregates accuracy per section from a single attempt', () => {
    const a = attempt({
      sections: [
        { name: 'Quant', start: 0, end: 1 },
        { name: 'English', start: 2, end: 3 },
      ],
      // Quant: 1 correct + 1 wrong = 50%; English: 2 correct = 100%
      perQuestion: [
        pq(0, { isCorrect: true, isSkipped: false, chosen: 0 }),
        pq(1, { isIncorrect: true, isSkipped: false, chosen: 1 }),
        pq(2, { isCorrect: true, isSkipped: false, chosen: 0 }),
        pq(3, { isCorrect: true, isSkipped: false, chosen: 0 }),
      ],
    });
    const stats = computeSectionStats(db({ 'providers/X/m.html': [a] }));
    expect(stats).toHaveLength(2);
    const quant = stats.find((s) => s.name === 'Quant')!;
    const eng = stats.find((s) => s.name === 'English')!;
    expect(quant.accuracy).toBe(50);
    expect(eng.accuracy).toBe(100);
    // weakest first
    expect(stats[0].name).toBe('Quant');
  });

  it('excludes skipped questions from accuracy but counts them', () => {
    const a = attempt({
      sections: [{ name: 'GK', start: 0, end: 2 }],
      perQuestion: [
        pq(0, { isCorrect: true, isSkipped: false, chosen: 0 }),
        pq(1), // skipped
        pq(2), // skipped
      ],
    });
    const [gk] = computeSectionStats(db({ 'p/m.html': [a] }));
    expect(gk.accuracy).toBe(100); // 1/1 answered
    expect(gk.answered).toBe(1);
    expect(gk.skipped).toBe(2);
  });

  it('uses only the latest attempt per exam (re-attempts supersede)', () => {
    const old = attempt({
      sections: [{ name: 'Quant', start: 0, end: 0 }],
      perQuestion: [pq(0, { isCorrect: true, isSkipped: false, chosen: 0 })],
    });
    const latest = attempt({
      attemptNumber: 2,
      sections: [{ name: 'Quant', start: 0, end: 0 }],
      perQuestion: [pq(0, { isIncorrect: true, isSkipped: false, chosen: 1 })],
    });
    const [q] = computeSectionStats(db({ 'p/m.html': [old, latest] }));
    expect(q.accuracy).toBe(0); // only latest (incorrect) counts
    expect(q.exams).toBe(1);
  });

  it('computes mean time per section when timing is captured', () => {
    const a = attempt({
      sections: [{ name: 'Reasoning', start: 0, end: 1 }],
      perQuestion: [
        pq(0, { isCorrect: true, isSkipped: false, chosen: 0, timeSec: 30 }),
        pq(1, { isCorrect: true, isSkipped: false, chosen: 0, timeSec: 60 }),
      ],
    });
    const [r] = computeSectionStats(db({ 'p/m.html': [a] }));
    expect(r.avgTimeSec).toBe(45);
  });

  it('falls back to "General" for questions outside section ranges', () => {
    const a = attempt({
      sections: [{ name: 'Quant', start: 0, end: 0 }],
      // idx 5 is outside [0,0] → General
      perQuestion: [pq(5, { isCorrect: true, isSkipped: false, chosen: 0 })],
    });
    const stats = computeSectionStats(db({ 'p/m.html': [a] }));
    expect(stats).toHaveLength(1);
    expect(stats[0].name).toBe('General');
  });

  it('ignores attempts without a perQuestion snapshot', () => {
    const legacy = attempt({ perQuestion: undefined });
    expect(computeSectionStats(db({ 'p/m.html': [legacy] }))).toEqual([]);
  });

  it('sinks sections with no answered questions to the bottom', () => {
    const a = attempt({
      sections: [
        { name: 'Attempted', start: 0, end: 0 },
        { name: 'AllSkipped', start: 1, end: 1 },
      ],
      perQuestion: [
        pq(0, { isCorrect: true, isSkipped: false, chosen: 0 }),
        pq(1), // skipped → accuracy null
      ],
    });
    const stats = computeSectionStats(db({ 'p/m.html': [a] }));
    expect(stats[stats.length - 1].name).toBe('AllSkipped');
    expect(stats[stats.length - 1].accuracy).toBeNull();
  });
});
