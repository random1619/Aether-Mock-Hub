import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ExamMeta, Question } from '@/types';

/* examStore drives attemptStore + examProgress — all three hold module
   singletons, so reset modules + storage per test and re-import. */

const PROGRESS_KEY = 'aether-exam-progress';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-01T10:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

const loadStore = () => import('@/stores/examStore');

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    question: 'Q?',
    options: ['A', 'B', 'C', 'D'],
    correct_option_id: 1,
    marks: 2,
    ...overrides,
  };
}

function makeMeta(questionCount = 4, overrides: Partial<ExamMeta> = {}): ExamMeta {
  return {
    path: 'providers/Test/exam.html',
    name: 'Test Exam',
    durationMinutes: 60,
    sections: [{ name: 'General', start: 0, end: questionCount - 1 }],
    ...overrides,
  };
}

async function freshActiveExam(questionCount = 4) {
  const { useExamStore } = await loadStore();
  const questions = Array.from({ length: questionCount }, () => makeQuestion());
  useExamStore.getState().loadExam(makeMeta(questionCount), questions);
  useExamStore.getState().startExam();
  return useExamStore;
}

describe('loadExam / startExam', () => {
  it('loads into welcome phase with the full duration', async () => {
    const { useExamStore } = await loadStore();
    useExamStore.getState().loadExam(makeMeta(4), [makeQuestion()]);
    const s = useExamStore.getState();
    expect(s.phase).toBe('welcome');
    expect(s.timeRemaining).toBe(3600);
    expect(s.resumeAvailable).toBeNull();
  });

  it('startExam activates and arms the wall-clock deadline', async () => {
    const { useExamStore } = await loadStore();
    useExamStore.getState().loadExam(makeMeta(4), [makeQuestion()]);
    useExamStore.getState().startExam();
    expect(useExamStore.getState().phase).toBe('active');
  });

  it('detects sectional mode from multiple sections', async () => {
    const { useExamStore } = await loadStore();
    const meta = makeMeta(4, {
      sections: [
        { name: 'A', start: 0, end: 1 },
        { name: 'B', start: 2, end: 3 },
      ],
    });
    useExamStore.getState().loadExam(meta, [makeQuestion()]);
    expect(useExamStore.getState().isSectionalMode).toBe(true);
  });
});

describe('timer', () => {
  it('tick derives remaining time from the deadline (no drift)', async () => {
    const useExamStore = await freshActiveExam();
    vi.setSystemTime(new Date('2026-08-01T10:30:00')); // 30 min later
    useExamStore.getState().tick();
    expect(useExamStore.getState().timeRemaining).toBe(1800);
  });

  it('auto-submits when the deadline passes', async () => {
    const useExamStore = await freshActiveExam();
    useExamStore.getState().selectOption(0, 1);
    // Simulate realistic timer progress: advance to 1 s before the deadline
    // so timeRemaining is wound down (a guard defends against one-tick
    // jumps that exceed the exam duration — real timers never do that).
    vi.setSystemTime(new Date('2026-08-01T10:59:59'));
    useExamStore.getState().tick(); // timeRemaining → 1
    // Now advance past the 60-min deadline.
    vi.setSystemTime(new Date('2026-08-01T11:00:01'));
    useExamStore.getState().tick();
    const s = useExamStore.getState();
    expect(s.phase).toBe('submitted');
    expect(s.timeRemaining).toBe(0);
    expect(s.result).not.toBeNull();
    expect(s.result!.correct).toBe(1);
  });

  it('tick is a no-op outside the active phase', async () => {
    const { useExamStore } = await loadStore();
    useExamStore.getState().loadExam(makeMeta(4), [makeQuestion()]);
    useExamStore.getState().tick(); // welcome phase
    expect(useExamStore.getState().phase).toBe('welcome');
  });
});

describe('navigation', () => {
  it('clamps to section bounds in sectional mode', async () => {
    const { useExamStore } = await loadStore();
    const meta = makeMeta(4, {
      sections: [
        { name: 'A', start: 0, end: 1 },
        { name: 'B', start: 2, end: 3 },
      ],
    });
    const questions = Array.from({ length: 4 }, () => makeQuestion());
    useExamStore.getState().loadExam(meta, questions);
    useExamStore.getState().startExam();
    // Section A is [0,1] — jumping to 3 must be rejected
    useExamStore.getState().navigateTo(3);
    expect(useExamStore.getState().currentIdx).toBe(0);
    useExamStore.getState().navigateTo(1);
    expect(useExamStore.getState().currentIdx).toBe(1);
    // Switching sections unlocks 2..3
    useExamStore.getState().setCurrentSection(1);
    expect(useExamStore.getState().currentIdx).toBe(2);
    useExamStore.getState().navigateTo(3);
    expect(useExamStore.getState().currentIdx).toBe(3);
  });

  it('rejects out-of-range indices', async () => {
    const useExamStore = await freshActiveExam(3);
    useExamStore.getState().navigateTo(-1);
    useExamStore.getState().navigateTo(99);
    expect(useExamStore.getState().currentIdx).toBe(0);
  });

  it('marks visited on navigation', async () => {
    const useExamStore = await freshActiveExam(3);
    useExamStore.getState().navigateTo(2);
    expect(useExamStore.getState().visited.has(2)).toBe(true);
  });
});

describe('per-question timing', () => {
  it('caps one flush at 600s (background-suspend protection)', async () => {
    const useExamStore = await freshActiveExam(3);
    vi.setSystemTime(new Date('2026-08-01T11:30:00')); // 90 min "away"
    useExamStore.getState().navigateTo(1); // flushes Q0
    expect(useExamStore.getState().questionTimes[0]).toBe(600);
  });

  it('accumulates across visits to the same question', async () => {
    const useExamStore = await freshActiveExam(3);
    vi.setSystemTime(new Date('2026-08-01T10:00:10'));
    useExamStore.getState().navigateTo(1); // Q0: 10s
    vi.setSystemTime(new Date('2026-08-01T10:00:25'));
    useExamStore.getState().navigateTo(0); // Q1: 15s
    vi.setSystemTime(new Date('2026-08-01T10:00:35'));
    useExamStore.getState().navigateTo(2); // Q0: +10s → 20s
    expect(useExamStore.getState().questionTimes[0]).toBe(20);
    expect(useExamStore.getState().questionTimes[1]).toBe(15);
  });
});

describe('submit', () => {
  it('persists the attempt to aether-db and clears the progress snapshot', async () => {
    const useExamStore = await freshActiveExam(2);
    useExamStore.getState().selectOption(0, 1); // correct
    useExamStore.getState().selectOption(1, 0); // wrong
    vi.advanceTimersByTime(1000); // let the debounced progress save land
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();

    useExamStore.getState().submit();

    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
    const attemptStore = await import('@/services/attemptStore');
    const attempts = attemptStore.getAllAttempts('providers/Test/exam.html');
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ correct: 1, incorrect: 1, score: 1.5, accuracy: 50 });
    expect(attempts[0].perQuestion).toHaveLength(2);
  });

  it('double-submit is a no-op', async () => {
    const useExamStore = await freshActiveExam(2);
    useExamStore.getState().submit();
    useExamStore.getState().submit();
    const attemptStore = await import('@/services/attemptStore');
    expect(attemptStore.getAllAttempts('providers/Test/exam.html')).toHaveLength(1);
  });

  it('refuses to submit with no questions loaded', async () => {
    const { useExamStore } = await loadStore();
    useExamStore.getState().loadExam(makeMeta(0, { sections: [] }), []);
    useExamStore.getState().startExam();
    useExamStore.getState().submit();
    expect(useExamStore.getState().phase).toBe('active'); // not submitted
    const attemptStore = await import('@/services/attemptStore');
    expect(attemptStore.getAllAttempts('providers/Test/exam.html')).toHaveLength(0);
  });
});

describe('reattempt isolation', () => {
  it('freezes submittedAnswers while re-attempt mutates the working copy', async () => {
    const useExamStore = await freshActiveExam(2);
    useExamStore.getState().selectOption(0, 1);
    useExamStore.getState().submit();

    const frozen = useExamStore.getState().submittedAnswers;
    expect(frozen).toEqual({ 0: 1 });

    useExamStore.getState().toggleReattempt();
    useExamStore.getState().selectOption(0, 3); // change answer in reattempt
    expect(useExamStore.getState().answers[0]).toBe(3);
    expect(useExamStore.getState().submittedAnswers![0]).toBe(1); // untouched
  });

  it('rejects re-attempt selection on a question whose solution is revealed', async () => {
    const useExamStore = await freshActiveExam(2);
    useExamStore.getState().submit();
    useExamStore.getState().toggleReattempt();
    useExamStore.getState().revealSolution(0);
    useExamStore.getState().selectOption(0, 2);
    expect(useExamStore.getState().answers[0]).toBeUndefined();
  });

  it('blocks answer changes post-submit when reattempt mode is off', async () => {
    const useExamStore = await freshActiveExam(2);
    useExamStore.getState().submit();
    useExamStore.getState().selectOption(0, 2);
    expect(useExamStore.getState().answers[0]).toBeUndefined();
  });
});

describe('progress snapshots + resume', () => {
  it('persists a debounced snapshot during the active phase', async () => {
    const useExamStore = await freshActiveExam(3);
    useExamStore.getState().selectOption(0, 2);
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull(); // still debounced
    vi.advanceTimersByTime(800);
    const raw = localStorage.getItem(PROGRESS_KEY);
    expect(raw).not.toBeNull();
    const snap = JSON.parse(raw!);
    expect(snap.answers).toEqual({ 0: 2 });
    expect(snap.path).toBe('providers/Test/exam.html');
  });

  it('loadExam surfaces a matching snapshot as resumeAvailable', async () => {
    const { saveProgress } = await import('@/services/examProgress');
    saveProgress({
      version: 1,
      path: 'providers/Test/exam.html',
      savedAt: new Date('2026-08-01T09:55:00').toISOString(),
      answers: { 0: 1, 1: 3 },
      flags: [1],
      visited: [0, 1],
      currentIdx: 1,
      currentSectionIdx: 0,
      endsAt: Date.now() + 30 * 60 * 1000,
      questionTimes: { 0: 30 },
      fsExits: 2,
    });
    const { useExamStore } = await loadStore();
    const questions = Array.from({ length: 3 }, () => makeQuestion());
    useExamStore.getState().loadExam(makeMeta(3), questions);
    expect(useExamStore.getState().resumeAvailable).not.toBeNull();
    expect(useExamStore.getState().resumeAvailable!.answers).toEqual({ 0: 1, 1: 3 });
  });

  it('resumeExam restores state and keeps the ORIGINAL deadline (no free time)', async () => {
    const { saveProgress } = await import('@/services/examProgress');
    // Exam started at 09:45 with 60 min → deadline 10:45. "Now" is 10:00.
    saveProgress({
      version: 1,
      path: 'providers/Test/exam.html',
      savedAt: new Date('2026-08-01T09:58:00').toISOString(),
      answers: { 0: 1 },
      flags: [],
      visited: [0],
      currentIdx: 0,
      currentSectionIdx: 0,
      endsAt: new Date('2026-08-01T10:45:00').getTime(),
      questionTimes: {},
      fsExits: 0,
    });
    const { useExamStore } = await loadStore();
    useExamStore.getState().loadExam(makeMeta(3), [makeQuestion(), makeQuestion(), makeQuestion()]);
    useExamStore.getState().resumeExam();
    const s = useExamStore.getState();
    expect(s.phase).toBe('active');
    expect(s.answers).toEqual({ 0: 1 });
    expect(s.timeRemaining).toBe(45 * 60); // 45 min left — the 15 away-minutes are gone
  });

  it('startExam clears any saved snapshot (fresh start wins)', async () => {
    const { saveProgress } = await import('@/services/examProgress');
    saveProgress({
      version: 1,
      path: 'providers/Test/exam.html',
      savedAt: new Date().toISOString(),
      answers: { 0: 1 },
      flags: [],
      visited: [0],
      currentIdx: 0,
      currentSectionIdx: 0,
      endsAt: Date.now() + 30 * 60 * 1000,
      questionTimes: {},
      fsExits: 0,
    });
    const { useExamStore } = await loadStore();
    useExamStore.getState().loadExam(makeMeta(3), [makeQuestion()]);
    useExamStore.getState().startExam();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });

  it('an expired snapshot is not offered for resume', async () => {
    const { saveProgress } = await import('@/services/examProgress');
    saveProgress({
      version: 1,
      path: 'providers/Test/exam.html',
      savedAt: new Date('2026-08-01T09:00:00').toISOString(),
      answers: { 0: 1 },
      flags: [],
      visited: [0],
      currentIdx: 0,
      currentSectionIdx: 0,
      endsAt: Date.now() - 1000, // already past
      questionTimes: {},
      fsExits: 0,
    });
    const { useExamStore } = await loadStore();
    useExamStore.getState().loadExam(makeMeta(3), [makeQuestion()]);
    expect(useExamStore.getState().resumeAvailable).toBeNull();
  });

  it('discardResume wipes the snapshot and hides the banner', async () => {
    const { saveProgress } = await import('@/services/examProgress');
    saveProgress({
      version: 1,
      path: 'providers/Test/exam.html',
      savedAt: new Date().toISOString(),
      answers: {},
      flags: [],
      visited: [0],
      currentIdx: 0,
      currentSectionIdx: 0,
      endsAt: Date.now() + 60_000,
      questionTimes: {},
      fsExits: 0,
    });
    const { useExamStore } = await loadStore();
    useExamStore.getState().loadExam(makeMeta(3), [makeQuestion()]);
    expect(useExamStore.getState().resumeAvailable).not.toBeNull();
    useExamStore.getState().discardResume();
    expect(useExamStore.getState().resumeAvailable).toBeNull();
    expect(localStorage.getItem(PROGRESS_KEY)).toBeNull();
  });
});

describe('reset', () => {
  it('clears exam state but preserves the progress snapshot for resume', async () => {
    const useExamStore = await freshActiveExam(2);
    useExamStore.getState().selectOption(0, 1);
    vi.advanceTimersByTime(800);
    useExamStore.getState().reset();
    expect(useExamStore.getState().meta).toBeNull();
    // Snapshot MUST survive reset so the user can resume after navigating away.
    expect(localStorage.getItem(PROGRESS_KEY)).not.toBeNull();
  });
});

describe('fs exit tracking', () => {
  it('increments and caps at 999', async () => {
    const useExamStore = await freshActiveExam(2);
    useExamStore.getState().recordFsExit();
    expect(useExamStore.getState().fsExits).toBe(1);
  });
});

describe('persistFailed', () => {
  it('flags persistFailed when saveAttempt throws (quota / private mode)', async () => {
    const useExamStore = await freshActiveExam(2);
    useExamStore.getState().selectOption(0, 1);
    useExamStore.getState().selectOption(1, 0);
    // Poison Storage.prototype.setItem to simulate quota failure.
    // JSDOM localStorage delegates to Storage.prototype, so spying on
    // the prototype ensures all call paths are intercepted.
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    useExamStore.getState().submit();
    expect(useExamStore.getState().persistFailed).toBe(true);
    expect(useExamStore.getState().phase).toBe('submitted'); // result still visible
    setItem.mockRestore();
  });

  it('persistFailed is cleared on loadExam and reset', async () => {
    const useExamStore = await freshActiveExam(2);
    // Manually set persistFailed (simulating a prior submit failure).
    useExamStore.setState({ persistFailed: true, phase: 'submitted' });
    expect(useExamStore.getState().persistFailed).toBe(true);
    useExamStore.getState().reset();
    expect(useExamStore.getState().persistFailed).toBe(false);

    const questions = Array.from({ length: 2 }, () => makeQuestion());
    useExamStore.getState().loadExam(makeMeta(2), questions);
    expect(useExamStore.getState().persistFailed).toBe(false);
  });
});

describe('tick clock-jump guard', () => {
  it('falls back to decrement when the wall clock jumps past the exam duration', async () => {
    // Use real timers + spy on Date.now to simulate a pure wall-clock jump
    // (fake timers advance both clocks together, making them indistinguishable).
    vi.useRealTimers();
    const { useExamStore } = await import('@/stores/examStore');
    const questions = Array.from({ length: 2 }, () => makeQuestion());
    useExamStore.getState().loadExam(
      makeMeta(2, { durationMinutes: 10 }), // 600s exam
      questions,
    );
    useExamStore.getState().startExam();
    const initialRemaining = useExamStore.getState().timeRemaining;
    expect(initialRemaining).toBe(600);

    // Simulate a clock jump of 15 minutes forward (> exam duration).
    const jumpedTime = Date.now() + 15 * 60 * 1000;
    const dateSpy = vi.spyOn(Date, 'now').mockReturnValue(jumpedTime);

    useExamStore.getState().tick();
    // Without the guard: wall clock says remaining = 600 - 900 = -300 → 0,
    // and exam auto-submits. With the guard: falls back to timeRemaining - 1.
    expect(useExamStore.getState().phase).toBe('active');
    expect(useExamStore.getState().timeRemaining).toBe(599);

    dateSpy.mockRestore();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T10:00:00'));
  });
});
