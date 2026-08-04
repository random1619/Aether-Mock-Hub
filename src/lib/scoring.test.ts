import { describe, it, expect } from 'vitest';
import { scoreAttempt, activeStatus, reviewStatus, fmtClock } from '@/lib/scoring';
import type { Question } from '@/types';

function q(overrides: Partial<Question> = {}): Question {
  return {
    question: 'Q?',
    options: ['A', 'B', 'C', 'D'],
    correct_option_id: 1,
    marks: 2,
    ...overrides,
  };
}

describe('scoreAttempt', () => {
  it('awards +marks for correct answers', () => {
    const r = scoreAttempt([q(), q()], { 0: 1, 1: 1 });
    expect(r.score).toBe(4);
    expect(r.maxScore).toBe(4);
    expect(r.correct).toBe(2);
    expect(r.incorrect).toBe(0);
    expect(r.unattempted).toBe(0);
    expect(r.accuracy).toBe(100);
  });

  it('applies −0.25×marks for incorrect answers', () => {
    const r = scoreAttempt([q(), q()], { 0: 0, 1: 0 }); // both wrong
    expect(r.score).toBe(-1); // -0.5 × 2
    expect(r.incorrect).toBe(2);
    expect(r.accuracy).toBe(0);
  });

  it('gives 0 for unattempted questions', () => {
    const r = scoreAttempt([q(), q(), q()], { 0: 1 });
    expect(r.unattempted).toBe(2);
    expect(r.score).toBe(2);
  });

  it('rounds score to 2 decimals (0.5-mark questions)', () => {
    const r = scoreAttempt([q({ marks: 0.5 }), q({ marks: 0.5 })], { 0: 0 });
    // -0.125 rounds to -0.13 or -0.12 depending on float path — just verify 2dp
    expect(r.score).toBe(Math.round(r.score * 100) / 100);
  });

  it('computes integer accuracy; 0 attempted → 0', () => {
    expect(scoreAttempt([q(), q(), q()], { 0: 1, 1: 0 }).accuracy).toBe(50);
    expect(scoreAttempt([q(), q(), q()], { 0: 1, 1: 1, 2: 0 }).accuracy).toBe(67);
    expect(scoreAttempt([q()], {}).accuracy).toBe(0);
  });

  it('preserves negative totals (no artificial floor)', () => {
    const r = scoreAttempt([q(), q(), q(), q()], { 0: 0, 1: 0, 2: 0, 3: 0 });
    expect(r.score).toBeLessThan(0);
  });

  it('never throws on out-of-range correct_option_id — question is simply unanswerable', () => {
    const r = scoreAttempt([q({ correct_option_id: 9 })], { 0: 3 });
    expect(r.incorrect).toBe(1);
    expect(r.correct).toBe(0);
    expect(r.maxScore).toBe(2); // still counted in the denominator
  });

  it('defaults marks to 2 when undefined', () => {
    const qs: Question[] = [
      { question: 'A', options: ['1', '2'], correct_option_id: 0 },
    ];
    const r = scoreAttempt(qs, { 0: 0 });
    expect(r.maxScore).toBe(2);
    expect(r.score).toBe(2);
  });

  it('defaults marks to 2 when the value is non-numeric (string, object, NaN)', () => {
    const qs: Question[] = [
      { question: 'A', options: ['X', 'Y'], correct_option_id: 0, marks: '3' as any },
      { question: 'B', options: ['X', 'Y'], correct_option_id: 0, marks: NaN as any },
      { question: 'C', options: ['X', 'Y'], correct_option_id: 0, marks: {} as any },
    ];
    const r = scoreAttempt(qs, { 0: 0, 1: 0, 2: 0 });
    // All three should fall back to default 2 → maxScore = 6, score = 6
    expect(r.maxScore).toBe(6);
    expect(r.score).toBe(6);
    expect(r.correct).toBe(3);
  });

  it('scores sections; out-of-bounds section end is tolerated', () => {
    const questions = [q(), q(), q()];
    const sections = [
      { name: 'A', start: 0, end: 1 },
      { name: 'B', start: 2, end: 99 }, // beyond array — guarded by `if (!q) continue`
    ];
    const r = scoreAttempt(questions, { 0: 1, 1: 0, 2: 1 }, sections);
    expect(r.sections).toHaveLength(2);
    expect(r.sections[0]).toMatchObject({ name: 'A', correct: 1, incorrect: 1 });
    expect(r.sections[1]).toMatchObject({ name: 'B', correct: 1, incorrect: 0 });
    // Headline = sum of sections
    const sectionTotal = r.sections.reduce((s, x) => s + x.score, 0);
    expect(Math.abs(sectionTotal - r.score)).toBeLessThan(0.01);
  });

  it('handles an empty questions array without throwing', () => {
    const r = scoreAttempt([], {});
    expect(r).toMatchObject({ score: 0, maxScore: 0, accuracy: 0 });
  });
});

describe('activeStatus', () => {
  const answers = { 1: 0 };
  const flags = new Set([2]);
  const visited = new Set([0, 1, 3]);

  it('precedence: marked > answered > notvisited > notanswered', () => {
    expect(activeStatus(2, answers, flags, visited)).toBe('marked');
    expect(activeStatus(1, answers, flags, visited)).toBe('answered');
    expect(activeStatus(5, answers, flags, visited)).toBe('notvisited');
    expect(activeStatus(0, answers, flags, visited)).toBe('notanswered');
    expect(activeStatus(3, answers, flags, visited)).toBe('notanswered');
  });
});

describe('reviewStatus', () => {
  const questions = [q(), q(), q()];
  it('classifies correct / incorrect / unattempted', () => {
    const answers = { 0: 1, 1: 0 };
    expect(reviewStatus(0, questions, answers)).toBe('correct');
    expect(reviewStatus(1, questions, answers)).toBe('incorrect');
    expect(reviewStatus(2, questions, answers)).toBe('unattempted');
  });
});

describe('fmtClock', () => {
  it('formats mm:ss with zero-padding and clamps negatives/NaN', () => {
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(65)).toBe('01:05');
    expect(fmtClock(600)).toBe('10:00');
    expect(fmtClock(-5)).toBe('00:00');
    expect(fmtClock(NaN)).toBe('00:00');
  });
});
