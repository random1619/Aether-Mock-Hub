import { describe, it, expect, beforeEach, vi } from 'vitest';

const DB_KEY = 'aether-db';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

function savedQuestion(id: string, examPath: string, questionIdx: number, subject = 'English', provider = 'Oliveboard') {
  return {
    id,
    examPath,
    examName: `Mock ${examPath}`,
    provider,
    subject,
    questionIdx,
    savedAt: new Date().toISOString(),
    question: `<p>Question ${questionIdx} in ${subject}</p>`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_option_id: 1,
    solution: `<p>Solution for ${questionIdx}</p>`,
    marks: 2,
    timesReviewed: 0,
  };
}

async function loadServices(savedQuestionsMap: Record<string, any[]>) {
  localStorage.setItem(
    DB_KEY,
    JSON.stringify({
      version: 3,
      settings: { theme: 'light' },
      attempts: {},
      completed: {},
      savedQuestions: savedQuestionsMap,
      stats: { totalAttempted: 0, avgAccuracy: 0, bestScore: null, streakDays: 0, lastActiveDate: null, byProvider: {}, bySubject: {} },
    }),
  );
  const bm = await import('@/services/bookmarkMock');
  return bm;
}

describe('bookmarkMock', () => {
  describe('isBookmarkMockPath', () => {
    it('identifies bookmark mock synthetic paths correctly', async () => {
      const bm = await loadServices({});
      expect(bm.isBookmarkMockPath('bookmark-mock/all')).toBe(true);
      expect(bm.isBookmarkMockPath('bookmark-mock/cfg:xyz')).toBe(true);
      expect(bm.isBookmarkMockPath('smart-revision/all')).toBe(false);
      expect(bm.isBookmarkMockPath('providers/Oliveboard/test.html')).toBe(false);
      expect(bm.isBookmarkMockPath(null)).toBe(false);
      expect(bm.isBookmarkMockPath(undefined)).toBe(false);
    });
  });

  describe('encodeBookmarkMockPath & decodeBookmarkMockConfig', () => {
    it('round-trips full configuration accurately', async () => {
      const bm = await loadServices({});
      const config: import('@/services/bookmarkMock').BookmarkMockConfig = {
        scope: 'filtered',
        questionIds: ['test::0', 'test::1', 'test::2'],
        questionCount: 3,
        minutesPerQuestion: 0.8,
        shuffle: true,
        groupBySubject: true,
        title: 'My Custom Drill',
      };
      const path = bm.encodeBookmarkMockPath(config);
      expect(bm.isBookmarkMockPath(path)).toBe(true);

      const decoded = bm.decodeBookmarkMockConfig(path);
      expect(decoded.scope).toBe('filtered');
      expect(decoded.questionIds).toEqual(['test::0', 'test::1', 'test::2']);
      expect(decoded.questionCount).toBe(3);
      expect(decoded.minutesPerQuestion).toBe(0.8);
      expect(decoded.shuffle).toBe(true);
      expect(decoded.groupBySubject).toBe(true);
      expect(decoded.title).toBe('My Custom Drill');
    });

    it('falls back gracefully on malformed path', async () => {
      const bm = await loadServices({});
      const decoded = bm.decodeBookmarkMockConfig('bookmark-mock/cfg:invalid-base64');
      expect(decoded.scope).toBe('all');
    });
  });

  describe('calculateBookmarkMockDuration (Variable Timing)', () => {
    it('calculates standard pacing (~1.2 min/q)', async () => {
      const bm = await loadServices({});
      expect(bm.calculateBookmarkMockDuration(10, 1.2)).toBe(12);
      expect(bm.calculateBookmarkMockDuration(25, 1.2)).toBe(30);
      expect(bm.calculateBookmarkMockDuration(50, 1.2)).toBe(60);
    });

    it('calculates speed drill pacing (~0.8 min/q)', async () => {
      const bm = await loadServices({});
      expect(bm.calculateBookmarkMockDuration(10, 0.8)).toBe(8);
      expect(bm.calculateBookmarkMockDuration(25, 0.8)).toBe(20);
    });

    it('calculates in-depth pacing (~2.0 min/q)', async () => {
      const bm = await loadServices({});
      expect(bm.calculateBookmarkMockDuration(10, 2.0)).toBe(20);
      expect(bm.calculateBookmarkMockDuration(25, 2.0)).toBe(50);
    });

    it('honors custom duration minutes override', async () => {
      const bm = await loadServices({});
      expect(bm.calculateBookmarkMockDuration(25, 1.2, 45)).toBe(45);
      expect(bm.calculateBookmarkMockDuration(10, 0.8, 15)).toBe(15);
    });

    it('enforces a minimum duration of at least 1 minute', async () => {
      const bm = await loadServices({});
      expect(bm.calculateBookmarkMockDuration(1, 0.1)).toBe(1);
    });
  });

  describe('buildBookmarkMockExam', () => {
    it('throws error when no saved questions are found', async () => {
      const bm = await loadServices({});
      await expect(bm.buildBookmarkMockExam({ scope: 'all' })).rejects.toThrow(
        /No bookmarked questions available/,
      );
    });

    it('builds a parsed exam from all bookmarked questions with variable timing', async () => {
      const bm = await loadServices({
        'mock-1': [
          savedQuestion('mock-1::0', 'mock-1', 0, 'English', 'Oliveboard'),
          savedQuestion('mock-1::1', 'mock-1', 1, 'English', 'Oliveboard'),
        ],
        'mock-2': [
          savedQuestion('mock-2::0', 'mock-2', 0, 'Reasoning', 'Pundits'),
          savedQuestion('mock-2::1', 'mock-2', 1, 'Reasoning', 'Pundits'),
        ],
      });

      const parsed = await bm.buildBookmarkMockExam({
        scope: 'all',
        minutesPerQuestion: 1.2,
      });

      expect(parsed.questions).toHaveLength(4);
      expect(parsed.meta.durationMinutes).toBe(5); // 4 * 1.2 = 4.8 -> ceil 5
      expect(parsed.meta.provider).toBe('Bookmarks');
      expect(bm.isBookmarkMockPath(parsed.meta.path)).toBe(true);
      expect(parsed.questions.some((q) => q.question.includes('Question 0'))).toBe(true);
      expect(parsed.questions.some((q) => q.question.includes('Question 1'))).toBe(true);
    });

    it('scopes by specific question IDs', async () => {
      const bm = await loadServices({
        'mock-1': [
          savedQuestion('mock-1::0', 'mock-1', 0, 'English', 'Oliveboard'),
          savedQuestion('mock-1::1', 'mock-1', 1, 'English', 'Oliveboard'),
          savedQuestion('mock-1::2', 'mock-1', 2, 'English', 'Oliveboard'),
        ],
      });

      const parsed = await bm.buildBookmarkMockExam({
        scope: 'filtered',
        questionIds: ['mock-1::1'],
      });

      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].question).toContain('Question 1');
      expect(parsed.meta.durationMinutes).toBe(2); // 1 * 1.2 = 1.2 -> ceil 2
    });

    it('subsets to questionCount', async () => {
      const bm = await loadServices({
        'mock-1': [
          savedQuestion('mock-1::0', 'mock-1', 0),
          savedQuestion('mock-1::1', 'mock-1', 1),
          savedQuestion('mock-1::2', 'mock-1', 2),
          savedQuestion('mock-1::3', 'mock-1', 3),
        ],
      });

      const parsed = await bm.buildBookmarkMockExam({
        scope: 'all',
        questionCount: 2,
        minutesPerQuestion: 1.0,
      });

      expect(parsed.questions).toHaveLength(2);
      expect(parsed.meta.durationMinutes).toBe(2);
    });

    it('groups multi-subject questions into sections when requested', async () => {
      const bm = await loadServices({
        'mock-1': [
          savedQuestion('mock-1::0', 'mock-1', 0, 'English'),
          savedQuestion('mock-1::1', 'mock-1', 1, 'Quantitative Aptitude'),
        ],
      });

      const parsed = await bm.buildBookmarkMockExam({
        scope: 'all',
        groupBySubject: true,
        minutesPerQuestion: 2.0,
      });

      expect(parsed.questions).toHaveLength(2);
      expect(parsed.meta.sections.length).toBeGreaterThanOrEqual(2);
      expect(parsed.meta.sections.map((s) => s.name)).toContain('English');
      expect(parsed.meta.sections.map((s) => s.name)).toContain('Quantitative Aptitude');
    });

    it('scopes by category / folderId', async () => {
      const bm = await loadServices({
        'mock-1': [
          { ...savedQuestion('mock-1::0', 'mock-1', 0, 'English'), folderId: 'f_quant' },
          { ...savedQuestion('mock-1::1', 'mock-1', 1, 'Reasoning'), folderId: 'f_reasoning' },
          { ...savedQuestion('mock-1::2', 'mock-1', 2, 'English'), folderId: 'f_quant' },
        ],
      });

      const parsed = await bm.buildBookmarkMockExam({
        scope: 'category',
        folderId: 'f_quant',
      });

      expect(parsed.questions).toHaveLength(2);
      expect(parsed.questions.every((q) => q.question.includes('Question 0') || q.question.includes('Question 2'))).toBe(true);
    });

    it('scopes by mistakes drill (only incorrect outcomes)', async () => {
      const bm = await loadServices({
        'mock-1': [
          { ...savedQuestion('mock-1::0', 'mock-1', 0), lastOutcome: 'correct' },
          { ...savedQuestion('mock-1::1', 'mock-1', 1), lastOutcome: 'incorrect' },
          { ...savedQuestion('mock-1::2', 'mock-1', 2), lastOutcome: 'skipped' },
        ],
      });

      const parsed = await bm.buildBookmarkMockExam({
        scope: 'mistakes',
      });

      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].question).toContain('Question 1');
    });
  });
});
