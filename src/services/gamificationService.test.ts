import { describe, it, expect } from 'vitest';
import {
  calculateAspirantLevel,
  computeTripleRings,
  evaluateAllBadges,
  BADGE_DEFINITIONS,
} from './gamificationService';
import type { AetherDB, Attempt } from '@/types';

function mockDb(attempts: Record<string, Attempt[]> = {}, statsPartial = {}): AetherDB {
  return {
    version: 3,
    settings: {
      theme: 'light',
      portalTheme: 'light',
      sectionalTimer: 'auto',
      dailyGoalQuestions: 20,
    },
    attempts,
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
      ...statsPartial,
    },
  };
}

describe('gamificationService', () => {
  describe('calculateAspirantLevel', () => {
    it('returns level 1 for 0 XP', () => {
      const level = calculateAspirantLevel(0);
      expect(level.level).toBe(1);
      expect(level.xp).toBe(0);
      expect(level.progressPct).toBe(0);
      expect(level.rankTitle).toBe('Novice Aspirant');
      expect(level.onePieceRankTitle).toBe('Cabin Boy');
    });

    it('advances levels as XP increases', () => {
      const level10 = calculateAspirantLevel(6500);
      expect(level10.level).toBeGreaterThanOrEqual(9);
      expect(level10.progressPct).toBeGreaterThanOrEqual(0);
      expect(level10.progressPct).toBeLessThanOrEqual(100);
    });

    it('caps at level 50 for max XP', () => {
      const level50 = calculateAspirantLevel(500000);
      expect(level50.level).toBe(50);
      expect(level50.rankTitle).toBe('SSC CGL Pinnacle Topper');
    });

    it('has at least 10 predefined badges', () => {
      expect(BADGE_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('computeTripleRings', () => {
    it('computes 0% when no attempts exist for today', () => {
      const db = mockDb();
      const rings = computeTripleRings(db, { practiceTarget: 20, focusTargetMinutes: 30, masteryTargetAccuracy: 80 });
      expect(rings.practice.current).toBe(0);
      expect(rings.practice.pct).toBe(0);
      expect(rings.focus.pct).toBe(0);
      expect(rings.mastery.pct).toBe(0);
      expect(rings.closedAll).toBe(false);
    });

    it('accurately computes practice and focus from today attempts', () => {
      const todayISO = new Date().toISOString();
      const attempt: Attempt = {
        score: 40,
        maxScore: 50,
        correct: 20,
        incorrect: 5,
        unattempted: 0,
        accuracy: 80,
        sections: [],
        submittedAt: todayISO,
        attemptNumber: 1,
        questionTimes: { 0: 60, 1: 60, 2: 60 }, // 180s = 3 mins
      };

      const db = mockDb({ 'mock-1': [attempt] });
      const rings = computeTripleRings(db, { practiceTarget: 25, focusTargetMinutes: 3, masteryTargetAccuracy: 80 });
      expect(rings.practice.current).toBe(25);
      expect(rings.practice.pct).toBe(100);
      expect(rings.focus.current).toBe(3);
      expect(rings.focus.pct).toBe(100);
      expect(rings.mastery.current).toBe(80);
      expect(rings.mastery.pct).toBe(100);
      expect(rings.closedAll).toBe(true);
    });
  });

  describe('evaluateAllBadges', () => {
    it('evaluates First Blood badge on first attempt', () => {
      const dbEmpty = mockDb();
      const resEmpty = evaluateAllBadges(dbEmpty);
      const firstBloodEmpty = resEmpty.inProgress.find((b) => b.id === 'first_blood');
      expect(firstBloodEmpty).toBeDefined();

      const dbOne = mockDb({
        'mock-1': [
          {
            score: 100,
            maxScore: 200,
            correct: 50,
            incorrect: 10,
            unattempted: 40,
            accuracy: 83,
            sections: [],
            submittedAt: new Date().toISOString(),
            attemptNumber: 1,
          },
        ],
      });

      const resOne = evaluateAllBadges(dbOne);
      const firstBloodUnlocked = resOne.unlocked.find((b) => b.id === 'first_blood');
      expect(firstBloodUnlocked).toBeDefined();
      expect(resOne.totalXp).toBeGreaterThan(0);
    });

    it('evaluates Clean Sheet badge correctly', () => {
      const cleanAttempt: Attempt = {
        score: 50,
        maxScore: 50,
        correct: 25,
        incorrect: 0,
        unattempted: 0,
        accuracy: 100,
        sections: [],
        submittedAt: new Date().toISOString(),
        attemptNumber: 1,
      };

      const db = mockDb({ 'mock-clean': [cleanAttempt] });
      const res = evaluateAllBadges(db);
      const cleanBadge = res.unlocked.find((b) => b.id === 'clean_sheet');
      expect(cleanBadge).toBeDefined();
    });

    it('evaluates Streak 7 badge correctly', () => {
      const db = mockDb({}, { streakDays: 7 });
      const res = evaluateAllBadges(db);
      const streakBadge = res.unlocked.find((b) => b.id === 'streak_7');
      expect(streakBadge).toBeDefined();
    });
  });
});
