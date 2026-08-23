/* GAMIFICATION SERVICE — Aether Mock Hub
   Computes Triple Activity Rings (Practice, Focus, Mastery),
   Level & XP progression, Streak Freeze protection, and
   Aspirant Mastery Badges evaluated dynamically from aether-db. */

import type { AetherDB } from '@/types';
import { localDayKey } from '@/services/attemptStore';

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export interface BadgeDefinition {
  id: string;
  title: string;
  onePieceTitle?: string;
  description: string;
  category: 'speed' | 'accuracy' | 'streak' | 'volume' | 'mastery';
  tier: BadgeTier;
  icon: string;
  xpReward: number;
  evaluate: (db: AetherDB) => { unlocked: boolean; progress: number; maxProgress: number; detail?: string };
}

export interface UnlockedBadge {
  id: string;
  title: string;
  description: string;
  tier: BadgeTier;
  icon: string;
  unlockedAt: string;
  progress: number;
  maxProgress: number;
  detail?: string;
}

export interface TripleRingsData {
  practice: { current: number; target: number; pct: number }; // questions
  focus: { current: number; target: number; pct: number };    // minutes
  mastery: { current: number; target: number; pct: number };  // accuracy %
  closedAll: boolean;
}

export interface AspirantLevelInfo {
  level: number;
  xp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressPct: number;
  rankTitle: string;
  onePieceRankTitle: string;
}

/* ── XP & Level Progression ───────────────────────────────────── */
const LEVEL_TITLES = [
  { level: 1, title: 'Novice Aspirant', onePiece: 'Cabin Boy' },
  { level: 5, title: 'Junior Candidate', onePiece: 'Rookie Pirate' },
  { level: 10, title: 'Sectional Specialist', onePiece: 'Supernova' },
  { level: 20, title: 'Mock Veteran', onePiece: 'Grand Line Commander' },
  { level: 30, title: 'Tier-2 Contender', onePiece: 'Warlord Tier' },
  { level: 40, title: 'Rank Predictor Elite', onePiece: 'Yonko Commander' },
  { level: 50, title: 'SSC CGL Pinnacle Topper', onePiece: 'Pirate King Pinnacle' },
];

export function calculateAspirantLevel(totalXp: number): AspirantLevelInfo {
  const level = Math.min(50, Math.max(1, Math.floor(Math.sqrt(totalXp / 80)) + 1));
  const xpForCurrentLevel = Math.round(80 * Math.pow(level - 1, 2));
  const xpForNextLevel = Math.round(80 * Math.pow(level, 2));
  const span = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  const currentInLevel = Math.max(0, totalXp - xpForCurrentLevel);
  const progressPct = Math.min(100, Math.round((currentInLevel / span) * 100));

  let rankTitle = LEVEL_TITLES[0].title;
  let onePieceRankTitle = LEVEL_TITLES[0].onePiece;
  for (const t of LEVEL_TITLES) {
    if (level >= t.level) {
      rankTitle = t.title;
      onePieceRankTitle = t.onePiece;
    }
  }

  return {
    level,
    xp: totalXp,
    xpForCurrentLevel,
    xpForNextLevel,
    progressPct,
    rankTitle,
    onePieceRankTitle,
  };
}

/* ── Triple Activity Rings ────────────────────────────────────── */
export function computeTripleRings(
  db: AetherDB,
  targets: { practiceTarget: number; focusTargetMinutes: number; masteryTargetAccuracy: number },
  dayKey: string = localDayKey(),
): TripleRingsData {
  let todayQuestions = 0;
  let todaySeconds = 0;
  let todayCorrect = 0;

  Object.values(db.attempts).forEach((attemptsList) => {
    if (!attemptsList) return;
    attemptsList.forEach((a) => {
      const aDay = localDayKey(new Date(a.submittedAt));
      if (aDay === dayKey) {
        const answered = (a.correct || 0) + (a.incorrect || 0);
        todayQuestions += answered;
        todayCorrect += a.correct || 0;

        if (a.questionTimes) {
          const totalSec = Object.values(a.questionTimes).reduce((acc, t) => acc + (typeof t === 'number' ? t : 0), 0);
          todaySeconds += totalSec;
        } else if (a.perQuestion) {
          const totalSec = a.perQuestion.reduce((acc, pq) => acc + (pq.timeSec || 0), 0);
          todaySeconds += totalSec;
        } else {
          todaySeconds += answered * 45;
        }
      }
    });
  });

  const todayMinutes = Math.round(todaySeconds / 60);
  const practicePct = targets.practiceTarget > 0 ? Math.min(100, Math.round((todayQuestions / targets.practiceTarget) * 100)) : 0;
  const focusPct = targets.focusTargetMinutes > 0 ? Math.min(100, Math.round((todayMinutes / targets.focusTargetMinutes) * 100)) : 0;
  
  const todayAccuracy = todayQuestions > 0 ? Math.round((todayCorrect / todayQuestions) * 100) : 0;
  const masteryPct = targets.masteryTargetAccuracy > 0 ? Math.min(100, Math.round((todayAccuracy / targets.masteryTargetAccuracy) * 100)) : 0;

  return {
    practice: { current: todayQuestions, target: targets.practiceTarget, pct: practicePct },
    focus: { current: todayMinutes, target: targets.focusTargetMinutes, pct: focusPct },
    mastery: { current: todayAccuracy, target: targets.masteryTargetAccuracy, pct: masteryPct },
    closedAll: practicePct >= 100 && focusPct >= 100 && masteryPct >= 100,
  };
}

/* ── Aspirant Mastery Badges Definitions ───────────────────────── */
export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'first_blood',
    title: 'First Blood',
    onePieceTitle: 'Setting Sail',
    description: 'Complete your first full mock test in Aether Hub.',
    category: 'volume',
    tier: 'bronze',
    icon: '🎯',
    xpReward: 150,
    evaluate: (db) => {
      const count = Object.values(db.attempts).reduce((acc, list) => acc + (list?.length || 0), 0);
      return {
        unlocked: count >= 1,
        progress: Math.min(1, count),
        maxProgress: 1,
        detail: count >= 1 ? '1 mock completed' : '0/1 mock completed',
      };
    },
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    onePieceTitle: 'Gear Second Speed',
    description: 'Solve 25 questions in under 15 minutes with at least 80% accuracy.',
    category: 'speed',
    tier: 'silver',
    icon: '⚡',
    xpReward: 350,
    evaluate: (db) => {
      let speedCount = 0;
      Object.values(db.attempts).forEach((list) => {
        if (!list) return;
        list.forEach((a) => {
          const totalQ = (a.correct || 0) + (a.incorrect || 0);
          if (totalQ >= 25 && (a.accuracy || 0) >= 80) {
            let totalSec = 0;
            if (a.questionTimes) {
              totalSec = Object.values(a.questionTimes).reduce((acc, t) => acc + (t || 0), 0);
            } else if (a.perQuestion) {
              totalSec = a.perQuestion.reduce((acc, pq) => acc + (pq.timeSec || 0), 0);
            }
            if (totalSec > 0 && totalSec <= 900) {
              speedCount++;
            }
          }
        });
      });
      return {
        unlocked: speedCount >= 1,
        progress: Math.min(1, speedCount),
        maxProgress: 1,
        detail: speedCount >= 1 ? 'Lightning fast 25Q completed' : 'Complete 25Q in <15m with >80% accuracy',
      };
    },
  },
  {
    id: 'streak_7',
    title: 'Momentum 7',
    onePieceTitle: 'Log Pose 7 Days',
    description: 'Maintain a 7-day active study streak.',
    category: 'streak',
    tier: 'silver',
    icon: '🔥',
    xpReward: 400,
    evaluate: (db) => {
      const streak = db.stats?.streakDays || 0;
      return {
        unlocked: streak >= 7,
        progress: Math.min(7, streak),
        maxProgress: 7,
        detail: `${streak}/7 days`,
      };
    },
  },
  {
    id: 'streak_30',
    title: 'Iron Will 30',
    onePieceTitle: 'Conqueror\'s Discipline',
    description: 'Maintain a relentless 30-day active study streak.',
    category: 'streak',
    tier: 'diamond',
    icon: '🛡️',
    xpReward: 1200,
    evaluate: (db) => {
      const streak = db.stats?.streakDays || 0;
      return {
        unlocked: streak >= 30,
        progress: Math.min(30, streak),
        maxProgress: 30,
        detail: `${streak}/30 days`,
      };
    },
  },
  {
    id: 'quant_wizard',
    title: 'Quant Wizard',
    onePieceTitle: 'Observation Calculation',
    description: 'Score 95%+ accuracy in Quantitative Aptitude across 3 distinct mocks.',
    category: 'accuracy',
    tier: 'gold',
    icon: '🧠',
    xpReward: 600,
    evaluate: (db) => {
      let count = 0;
      Object.entries(db.attempts).forEach(([path, list]) => {
        if (!list || path.includes('smart-revision')) return;
        const last = list[list.length - 1];
        if (last && (last.accuracy || 0) >= 95) {
          count++;
        }
      });
      return {
        unlocked: count >= 3,
        progress: Math.min(3, count),
        maxProgress: 3,
        detail: `${count}/3 95%+ accuracy mocks`,
      };
    },
  },
  {
    id: 'clean_sheet',
    title: 'Clean Sheet',
    onePieceTitle: 'Untouchable Haki',
    description: 'Complete a full mock with zero negative marking (0 incorrect answers).',
    category: 'accuracy',
    tier: 'gold',
    icon: '✨',
    xpReward: 500,
    evaluate: (db) => {
      let found = false;
      Object.values(db.attempts).forEach((list) => {
        if (!list) return;
        list.forEach((a) => {
          const answered = (a.correct || 0) + (a.incorrect || 0);
          if (answered >= 25 && a.incorrect === 0) {
            found = true;
          }
        });
      });
      return {
        unlocked: found,
        progress: found ? 1 : 0,
        maxProgress: 1,
        detail: found ? 'Flawless 0 incorrect run' : 'Attempt ≥25 Qs with 0 incorrect',
      };
    },
  },
  {
    id: 'centurion_mock',
    title: 'Centurion',
    onePieceTitle: '100 Battles Master',
    description: 'Complete 100 mock exams in total.',
    category: 'volume',
    tier: 'diamond',
    icon: '👑',
    xpReward: 1500,
    evaluate: (db) => {
      const count = Object.values(db.attempts).reduce((acc, list) => acc + (list?.length || 0), 0);
      return {
        unlocked: count >= 100,
        progress: Math.min(100, count),
        maxProgress: 100,
        detail: `${count}/100 mocks`,
      };
    },
  },
  {
    id: 'tcs_conqueror',
    title: 'TCS Grandmaster',
    onePieceTitle: 'Pirate King Tier',
    description: 'Score 330+ marks on a 390-mark CGL Tier 2 full mock test.',
    category: 'mastery',
    tier: 'diamond',
    icon: '🏆',
    xpReward: 2000,
    evaluate: (db) => {
      let topScore = 0;
      Object.values(db.attempts).forEach((list) => {
        if (!list) return;
        list.forEach((a) => {
          if (a.maxScore >= 380 && (a.score || 0) > topScore) {
            topScore = a.score;
          }
        });
      });
      return {
        unlocked: topScore >= 330,
        progress: Math.min(330, topScore),
        maxProgress: 330,
        detail: topScore > 0 ? `${topScore.toFixed(0)}/330 marks (Tier-2)` : 'Score 330+ in Tier-2',
      };
    },
  },
  {
    id: 'bookmark_scholar',
    title: 'Mistake Scholar',
    onePieceTitle: 'Poneglyph Collector',
    description: 'Curate 25+ challenging questions in your Saved Mistakes Notebook.',
    category: 'mastery',
    tier: 'silver',
    icon: '📚',
    xpReward: 300,
    evaluate: (db) => {
      const totalSaved = Object.values(db.savedQuestions || {}).reduce((acc, arr) => acc + (arr?.length || 0), 0);
      return {
        unlocked: totalSaved >= 25,
        progress: Math.min(25, totalSaved),
        maxProgress: 25,
        detail: `${totalSaved}/25 saved questions`,
      };
    },
  },
  {
    id: 'triple_ring_closer',
    title: 'Trinity Master',
    onePieceTitle: 'Three Sword Style',
    description: 'Close all 3 Activity Rings (Practice, Focus, Mastery) in a single day.',
    category: 'mastery',
    tier: 'silver',
    icon: '⭕',
    xpReward: 350,
    evaluate: (db) => {
      const rings = computeTripleRings(db, { practiceTarget: 20, focusTargetMinutes: 30, masteryTargetAccuracy: 70 });
      return {
        unlocked: rings.closedAll,
        progress: (rings.practice.pct >= 100 ? 1 : 0) + (rings.focus.pct >= 100 ? 1 : 0) + (rings.mastery.pct >= 100 ? 1 : 0),
        maxProgress: 3,
        detail: rings.closedAll ? 'All 3 rings closed today' : `${(rings.practice.pct >= 100 ? 1 : 0) + (rings.focus.pct >= 100 ? 1 : 0) + (rings.mastery.pct >= 100 ? 1 : 0)}/3 rings closed`,
      };
    },
  },
];

/* ── Evaluate All Badges ───────────────────────────────────────── */
export function evaluateAllBadges(db: AetherDB): {
  unlocked: UnlockedBadge[];
  inProgress: UnlockedBadge[];
  totalXp: number;
} {
  const unlocked: UnlockedBadge[] = [];
  const inProgress: UnlockedBadge[] = [];
  let totalXp = 0;

  const totalQuestionsAnswered = Object.values(db.attempts).reduce((acc, list) => {
    return acc + (list?.reduce((s, a) => s + ((a.correct || 0) + (a.incorrect || 0)), 0) || 0);
  }, 0);
  totalXp += totalQuestionsAnswered * 5;

  BADGE_DEFINITIONS.forEach((b) => {
    const result = b.evaluate(db);
    const badgeItem: UnlockedBadge = {
      id: b.id,
      title: b.title,
      description: b.description,
      tier: b.tier,
      icon: b.icon,
      unlockedAt: result.unlocked ? (db.stats?.lastActiveDate || new Date().toISOString()) : '',
      progress: result.progress,
      maxProgress: result.maxProgress,
      detail: result.detail,
    };

    if (result.unlocked) {
      unlocked.push(badgeItem);
      totalXp += b.xpReward;
    } else {
      inProgress.push(badgeItem);
    }
  });

  return { unlocked, inProgress, totalXp };
}
