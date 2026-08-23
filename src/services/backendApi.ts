/**
 * Local-only persistence client
 * =============================
 * No cloud. All study data lives in localStorage under the active profile's
 * namespace via attemptStore. These helpers are intentionally local-first:
 * they never hit network endpoints (Render or otherwise); production-built
 * apps simply operate in standalone offline mode.
 *
 * A thin Electron IPC bridge is still honored for desktop builds so a local
 * desktop helper can persist to disk; when unavailable everything falls back
 * to the durable localStorage journal in attemptStore.
 */

import type { Attempt, MockEntry, SavedQuestionRecord } from '@/types';
import { getDb, saveAttempt } from '@/services/attemptStore';

/** Get the active user's persistent unique identifier */
export function getCurrentUserId(): string {
  if (typeof window === 'undefined') return 'default_user';
  try {
    const rawProfile = localStorage.getItem('aether-profile');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      if (parsed?.id) return String(parsed.id);
    }
    let clientId = localStorage.getItem('aether-client-uuid');
    if (!clientId) {
      clientId = `usr_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem('aether-client-uuid', clientId);
    }
    return clientId;
  } catch {
    return 'default_user';
  }
}

/** Constantly false — this build is fully local and never talks to a remote
    REST backend. Kept as a function so the Settings UI can render the
    local-only status truthfully. */
export function isBackendMode(): boolean {
  return false;
}

export interface BackendSystemInfo {
  status: 'online' | 'offline';
  serverTime: string;
  uptimeSeconds: number;
  totalMocks: number;
  totalRegisteredUsers: number;
  totalGlobalAttempts: number;
  currentUser: {
    id: string;
    name: string;
    totalAttempts: number;
    totalBookmarks: number;
  };
  storageHealthy: boolean;
  version: string;
}

export interface BackendAnalyticsSummary {
  userId: string;
  totalAttempts: number;
  uniqueMocksAttempted: number;
  overallAccuracy: number;
  avgScore: number;
  bestScore: number;
  recentScores: { date: string; score: number; maxScore: number; accuracy: number; provider: string }[];
}

/** Local-only: report the offline/standby state derived entirely from local
    storage health — no network request is ever made. */
export async function getSystemInfo(): Promise<BackendSystemInfo | null> {
  try {
    const db = getDb();
    const savedCount = Object.values(db.savedQuestions || {}).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0);
    return {
      status: 'offline',
      serverTime: new Date().toISOString(),
      uptimeSeconds: 0,
      totalMocks: 0,
      totalRegisteredUsers: 1,
      totalGlobalAttempts: db.stats?.totalAttempted || 0,
      currentUser: {
        id: getCurrentUserId(),
        name: 'Local profile',
        totalAttempts: db.stats?.totalAttempted || 0,
        totalBookmarks: savedCount,
      },
      storageHealthy: true,
      version: 'local',
    };
  } catch {
    return null;
  }
}

/** Dynamic catalog is sourced locally in this build. Kept as a no-op guard so
    any future callers can safely rely on the local mock catalog fallback. */
export async function fetchDynamicCatalog(): Promise<MockEntry[] | null> {
  return null;
}

/** Fetch all stored attempts for the active user (local only). */
export async function fetchBackendAttempts(): Promise<Record<string, Attempt[]> | null> {
  return Promise.resolve(getDb().attempts);
}

/** Save an attempt locally. Desktop builds may ALSO mirror to disk via the
    Electron IPC bridge; this never touches a remote server. */
export async function persistAttemptToBackend(mockPath: string, attempt: Attempt): Promise<boolean> {
  try {
    const desktopApi = (window as unknown as { electronAPI?: { saveAttempt?: (d: any) => Promise<any> } }).electronAPI;
    if (desktopApi?.saveAttempt) {
      const userId = getCurrentUserId();
      desktopApi.saveAttempt({ userId, mockPath, attempt }).catch(() => {});
    }
    saveAttempt(mockPath, attempt);
    return true;
  } catch {
    return false;
  }
}

/** Local analytics summary. */
export async function fetchBackendAnalytics(): Promise<BackendAnalyticsSummary | null> {
  try {
    const db = getDb();
    const attempts = Object.values(db.attempts || {}).flat();
    return {
      userId: getCurrentUserId(),
      totalAttempts: attempts.length,
      uniqueMocksAttempted: Object.keys(db.attempts || {}).length,
      overallAccuracy: db.stats?.avgAccuracy || 0,
      avgScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + (a.score || 0), 0) / attempts.length) : 0,
      bestScore: db.stats?.bestScore?.score ?? 0,
      recentScores: attempts.slice(-20).map((a) => ({
        date: a.submittedAt,
        score: a.score,
        maxScore: a.maxScore,
        accuracy: a.accuracy,
        provider: (a as unknown as { provider?: string }).provider || 'Unknown',
      })),
    };
  } catch {
    return null;
  }
}

/** All bookmarks, local only. */
export async function fetchBackendBookmarks(): Promise<SavedQuestionRecord[] | null> {
  try {
    return Object.values(getDb().savedQuestions || {}).flat();
  } catch {
    return null;
  }
}

export async function saveBookmarkToBackend(bookmark: SavedQuestionRecord): Promise<boolean> {
  try {
    const list = getDb().savedQuestions[bookmark.examPath] || [];
    if (!list.some((r) => r.id === bookmark.id)) {
      list.push(bookmark);
      getDb().savedQuestions[bookmark.examPath] = list;
    }
    return true;
  } catch {
    return false;
  }
}

export async function deleteBookmarkFromBackend(id: string): Promise<boolean> {
  try {
    const db = getDb();
    for (const path of Object.keys(db.savedQuestions || {})) {
      const orig = db.savedQuestions[path];
      const filtered = orig.filter((r) => r.id !== id);
      if (filtered.length !== orig.length) db.savedQuestions[path] = filtered;
    }
    return true;
  } catch {
    return false;
  }
}

/** Local sync — a no-op acknowledgment so Settings' sync flow reports "already
    up to date" without any network. */
export async function syncDatabaseWithBackend(): Promise<{ synced: boolean; totalAttempts: number }> {
  return Promise.resolve({ synced: true, totalAttempts: 0 });
}