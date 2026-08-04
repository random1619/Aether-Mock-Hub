/* collectWrongQuestionRefs reads the attemptStore singleton, so each test
   seeds localStorage, resets modules, and re-imports both services. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const DB_KEY = 'aether-db';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

function perQuestion(records: Array<{ idx: number; outcome: 'correct' | 'incorrect' | 'skipped' }>) {
  return records.map((r) => ({
    idx: r.idx,
    chosen: r.outcome === 'skipped' ? undefined : 0,
    correctOption: r.outcome === 'correct' ? 0 : 1,
    isCorrect: r.outcome === 'correct',
    isIncorrect: r.outcome === 'incorrect',
    isSkipped: r.outcome === 'skipped',
    flagged: false,
    timeSec: 10,
  }));
}

function attempt(submittedAt: string, attemptNumber: number, perQ: ReturnType<typeof perQuestion>) {
  return {
    score: 10,
    maxScore: 20,
    correct: perQ.filter((r) => r.isCorrect).length,
    incorrect: perQ.filter((r) => r.isIncorrect).length,
    unattempted: perQ.filter((r) => r.isSkipped).length,
    accuracy: 50,
    sections: [],
    submittedAt,
    attemptNumber,
    perQuestion: perQ,
  };
}

async function loadServices(attempts: Record<string, unknown[]>) {
  localStorage.setItem(
    DB_KEY,
    JSON.stringify({ version: 3, settings: { theme: 'dark' }, attempts, completed: {}, savedQuestions: {}, stats: {} }),
  );
  const sr = await import('@/services/smartRevision');
  return sr;
}

describe('collectWrongQuestionRefs', () => {
  it('collects incorrect questions from the latest attempt history', async () => {
    const sr = await loadServices({
      'providers/X/a.html': [attempt(new Date().toISOString(), 1, perQuestion([
        { idx: 0, outcome: 'correct' },
        { idx: 1, outcome: 'incorrect' },
        { idx: 2, outcome: 'incorrect' },
        { idx: 3, outcome: 'skipped' }, // skipped is NOT "wrong"
      ]))],
    });
    const refs = sr.collectWrongQuestionRefs();
    expect(refs).toEqual([
      { examPath: 'providers/X/a.html', idx: 1 },
      { examPath: 'providers/X/a.html', idx: 2 },
    ]);
  });

  it('graduates a question once a LATER attempt gets it right', async () => {
    const sr = await loadServices({
      'providers/X/a.html': [
        attempt('2026-07-01T10:00:00.000Z', 1, perQuestion([{ idx: 4, outcome: 'incorrect' }])),
        attempt('2026-07-02T10:00:00.000Z', 2, perQuestion([{ idx: 4, outcome: 'correct' }])),
      ],
    });
    expect(sr.collectWrongQuestionRefs()).toEqual([]);
  });

  it('scopes to a single mock and ignores revision-exam pseudo paths', async () => {
    const sr = await loadServices({
      'providers/X/a.html': [attempt(new Date().toISOString(), 1, perQuestion([{ idx: 0, outcome: 'incorrect' }]))],
      'providers/Y/b.html': [attempt(new Date().toISOString(), 1, perQuestion([{ idx: 7, outcome: 'incorrect' }]))],
      'smart-revision/all': [attempt(new Date().toISOString(), 1, perQuestion([{ idx: 0, outcome: 'incorrect' }]))],
    });
    expect(sr.collectWrongQuestionRefs('providers/X/a.html')).toEqual([
      { examPath: 'providers/X/a.html', idx: 0 },
    ]);
    // Unscoped: both real mocks, never the revision pseudo-path.
    expect(sr.collectWrongQuestionRefs()).toHaveLength(2);
    expect(sr.isRevisionPath('smart-revision/all')).toBe(true);
    expect(sr.isRevisionPath('providers/X/a.html')).toBe(false);
  });

  it('revision path helpers round-trip the scope', async () => {
    const sr = await loadServices({});
    const p = sr.revisionPathFor('providers/X/a.html');
    expect(sr.revisionScope(p)).toBe('providers/X/a.html');
    expect(sr.revisionScope(sr.REVISION_ALL_PATH)).toBeUndefined();
  });

  it('buildRevisionExam throws a helpful error when the pool is empty', async () => {
    const sr = await loadServices({});
    await expect(sr.buildRevisionExam()).rejects.toThrow(/No wrong questions/);
  });
});
