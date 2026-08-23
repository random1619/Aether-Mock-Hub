/**
 * Local-only sync shim
 * ====================
 * Previous builds synchronized the whole study state to a Render backend.
 * This build is fully local: every mutation already persists durably to the
 * profile-namespaced localStorage journal, so "cloud sync" is a no-op.
 *
 * The module keeps the previous public surface (queueCloudStateSync,
 * bootstrapCloudData, flushCloudSync, getCloudSyncStatus) so existing imports
 * compile, but the queue never reaches a network and auth is never available.
 * The behavior is: nothing is queued, status stays idle, bootstrap resolves
 * false (nothing to restore) — local data is authoritative and untouched.
 */

import type { AetherDB, Attempt, BookmarkFolder, SavedQuestionRecord } from '@/types';
import { useAlarmStore, type PracticeAlarm } from '@/services/alarmStore';
import { useGamificationStore, type GamificationState } from '@/stores/gamificationStore';

const STATUS_KEY = 'aether-cloud-sync-status';

type CloudState = {
  attempts: Record<string, Attempt[]>;
  bookmarks: SavedQuestionRecord[];
  bookmarkFolders: BookmarkFolder[];
  completed: Record<string, boolean>;
  myList: string[];
  settings: AetherDB['settings'];
  alarms: PracticeAlarm[];
  gamification: Partial<GamificationState>;
  examProgress?: unknown;
};

export interface CloudSyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  pending: number;
  lastSyncedAt: string | null;
  message: string | null;
}

const statusListeners = new Set<() => void>();
let status: CloudSyncStatus = { state: 'idle', pending: 0, lastSyncedAt: null, message: null };

function updateStatus(next: Partial<CloudSyncStatus>): void {
  status = { ...status, ...next };
  try { localStorage.setItem(STATUS_KEY, JSON.stringify(status)); } catch { /* non-fatal */ }
  statusListeners.forEach((listener) => listener());
}

export function getCloudSyncStatus(): CloudSyncStatus {
  return status;
}

export function onCloudSyncStatusChange(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

function currentLocalState(): CloudState {
  const alarmState = useAlarmStore.getState();
  const game = useGamificationStore.getState();
  return {
    attempts: {},
    bookmarks: [],
    bookmarkFolders: [],
    completed: {},
    myList: [],
    settings: { theme: 'light' } as AetherDB['settings'],
    alarms: alarmState.alarms,
    gamification: {
      practiceTarget: game.practiceTarget,
      focusTargetMinutes: game.focusTargetMinutes,
      masteryTargetAccuracy: game.masteryTargetAccuracy,
    },
  };
}

/** No-op — everything is already saved locally. */
export function queueCloudStateSync(): void {
  // Intentionally does nothing: persistence is local-only.
}

/** No-op — never queues an outbox. */
export function flushCloudSync(): Promise<boolean> {
  return Promise.resolve(true);
}

/** Restore bootstrap always reports false in local mode: there is nothing to
    restore, and local data must never be overwritten by an empty snapshot. */
export async function bootstrapCloudData(_options: { migrateLocal?: boolean } = {}): Promise<boolean> {
  return false;
}

/** Installs the (empty) local sync hook; keeps the status key deterministic. */
export function initializeCloudSync(): void {
  // Rebuild local-only state in case outbox remnants from an older build exist.
  updateStatus({ state: 'idle', pending: 0, lastSyncedAt: null, message: null });
}

/* Keep a tree-shaken reference so local-only state shape stays valid. */
void currentLocalState;