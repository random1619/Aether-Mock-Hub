/* GAMIFICATION STORE — Aether Mock Hub
   Zustand store with persistence for user-set ring goals,
   streak freeze inventory, badge showcase, and celebration modal. */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnlockedBadge } from '@/services/gamificationService';

export interface GamificationState {
  // Ring Targets
  practiceTarget: number;        // Questions per day
  focusTargetMinutes: number;    // Active study minutes per day
  masteryTargetAccuracy: number; // Target accuracy % (e.g. 80%)

  // Streak Freeze Tokens
  streakFreezes: number;
  usedFreezeDates: string[]; // YYYY-MM-DD

  // Inspection & Notification
  selectedBadge: UnlockedBadge | null;
  newlyUnlockedQueue: string[]; // IDs of badges to celebrate

  // Focus Audio State
  ambientSoundType: 'off' | 'binaural_alpha' | 'brown_noise' | 'rain_library';
  ambientVolume: number; // 0..1

  // Actions
  setPracticeTarget: (target: number) => void;
  setFocusTargetMinutes: (minutes: number) => void;
  setMasteryTargetAccuracy: (accuracy: number) => void;
  useStreakFreeze: (dateKey: string) => boolean;
  addStreakFreeze: (count?: number) => void;
  setSelectedBadge: (badge: UnlockedBadge | null) => void;
  enqueueNewUnlock: (badgeId: string) => void;
  dequeueNewUnlock: () => string | undefined;
  setAmbientSoundType: (type: 'off' | 'binaural_alpha' | 'brown_noise' | 'rain_library') => void;
  setAmbientVolume: (vol: number) => void;
  /** Hydrates portable account preferences after authenticated cloud bootstrap. */
  replaceCloudState: (state: Partial<GamificationState>) => void;
}

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      practiceTarget: 50,
      focusTargetMinutes: 45,
      masteryTargetAccuracy: 80,

      streakFreezes: 1,
      usedFreezeDates: [],

      selectedBadge: null,
      newlyUnlockedQueue: [],

      ambientSoundType: 'off',
      ambientVolume: 0.35,

      setPracticeTarget: (target) => set({ practiceTarget: Math.max(5, Math.min(500, target)) }),
      setFocusTargetMinutes: (minutes) => set({ focusTargetMinutes: Math.max(5, Math.min(300, minutes)) }),
      setMasteryTargetAccuracy: (accuracy) => set({ masteryTargetAccuracy: Math.max(50, Math.min(100, accuracy)) }),

      useStreakFreeze: (dateKey) => {
        const { streakFreezes, usedFreezeDates } = get();
        if (streakFreezes <= 0 || usedFreezeDates.includes(dateKey)) return false;
        set({
          streakFreezes: streakFreezes - 1,
          usedFreezeDates: [...usedFreezeDates, dateKey],
        });
        return true;
      },

      addStreakFreeze: (count = 1) => {
        set((state) => ({ streakFreezes: Math.min(5, state.streakFreezes + count) }));
      },

      setSelectedBadge: (badge) => set({ selectedBadge: badge }),

      enqueueNewUnlock: (badgeId) => {
        const { newlyUnlockedQueue } = get();
        if (!newlyUnlockedQueue.includes(badgeId)) {
          set({ newlyUnlockedQueue: [...newlyUnlockedQueue, badgeId] });
        }
      },

      dequeueNewUnlock: () => {
        const { newlyUnlockedQueue } = get();
        if (!newlyUnlockedQueue.length) return undefined;
        const [first, ...rest] = newlyUnlockedQueue;
        set({ newlyUnlockedQueue: rest });
        return first;
      },

      setAmbientSoundType: (type) => set({ ambientSoundType: type }),
      setAmbientVolume: (vol) => set({ ambientVolume: Math.max(0, Math.min(1, vol)) }),
      replaceCloudState: (state) => set({
        practiceTarget: typeof state.practiceTarget === 'number' ? Math.max(5, Math.min(500, state.practiceTarget)) : get().practiceTarget,
        focusTargetMinutes: typeof state.focusTargetMinutes === 'number' ? Math.max(5, Math.min(300, state.focusTargetMinutes)) : get().focusTargetMinutes,
        masteryTargetAccuracy: typeof state.masteryTargetAccuracy === 'number' ? Math.max(50, Math.min(100, state.masteryTargetAccuracy)) : get().masteryTargetAccuracy,
        streakFreezes: typeof state.streakFreezes === 'number' ? Math.max(0, Math.min(5, state.streakFreezes)) : get().streakFreezes,
        usedFreezeDates: Array.isArray(state.usedFreezeDates) ? state.usedFreezeDates : get().usedFreezeDates,
        ambientSoundType: state.ambientSoundType || get().ambientSoundType,
        ambientVolume: typeof state.ambientVolume === 'number' ? Math.max(0, Math.min(1, state.ambientVolume)) : get().ambientVolume,
      }),
    }),
    {
      name: 'aether-gamification-storage',
    }
  )
);
