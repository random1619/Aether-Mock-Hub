/**
 * Aether Backend API Client
 * ========================
 * Provides dynamic, robust communication with the Aether Backend Server & Electron IPC.
 * Supports offline-first fallbacks, automatic background synchronization, and dynamic queries.
 */

import type { Attempt, MockEntry, SavedQuestionRecord } from '@/types';
import { getDb, saveAttempt } from '@/services/attemptStore';

function getApiUrl(endpoint: string): string {
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    return `${window.location.origin}/api${endpoint}`;
  }
  return `http://127.0.0.1:8080/api${endpoint}`;
}

export interface BackendSystemInfo {
  status: 'online' | 'offline';
  serverTime: string;
  uptimeSeconds: number;
  totalMocks: number;
  totalAttempts: number;
  totalBookmarks: number;
  storageHealthy: boolean;
  version: string;
}

export interface BackendAnalyticsSummary {
  totalAttempts: number;
  uniqueMocksAttempted: number;
  overallAccuracy: number;
  avgScore: number;
  bestScore: number;
  subjectMastery: Record<string, { attempted: number; accuracy: number; avgScore: number }>;
  recentScores: { date: string; score: number; accuracy: number; mockName: string }[];
}

/** Check if the backend API is live */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/health'), { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get system information and stats from backend */
export async function getSystemInfo(): Promise<BackendSystemInfo | null> {
  try {
    const res = await fetch(getApiUrl('/system'), { signal: AbortSignal.timeout(3000) });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug('[backendApi] getSystemInfo offline or failed:', err);
  }
  return null;
}

/** Dynamically fetch mock catalog with optional backend search/filtering */
export async function fetchDynamicCatalog(params?: {
  q?: string;
  provider?: string;
  subject?: string;
  category?: string;
}): Promise<MockEntry[] | null> {
  try {
    const url = new URL(getApiUrl('/catalog'));
    if (params?.q) url.searchParams.set('q', params.q);
    if (params?.provider) url.searchParams.set('provider', params.provider);
    if (params?.subject) url.searchParams.set('subject', params.subject);
    if (params?.category) url.searchParams.set('category', params.category);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.mocks)) return data.mocks;
    }
  } catch (err) {
    console.debug('[backendApi] Dynamic catalog fetch fallback:', err);
  }
  return null;
}

/** Fetch all stored attempts from the backend server */
export async function fetchBackendAttempts(): Promise<Record<string, Attempt[]> | null> {
  try {
    const res = await fetch(getApiUrl('/attempts'), { signal: AbortSignal.timeout(3000) });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug('[backendApi] fetchBackendAttempts failed:', err);
  }
  return null;
}

/** Save an attempt to backend database */
export async function persistAttemptToBackend(mockPath: string, attempt: Attempt): Promise<boolean> {
  try {
    // 1. If Electron IPC available, also persist via desktop API
    const desktopApi = (window as unknown as { electronAPI?: { saveAttempt?: (d: any) => Promise<any> } }).electronAPI;
    if (desktopApi?.saveAttempt) {
      desktopApi.saveAttempt({ mockPath, attempt }).catch(() => {});
    }

    // 2. Persist to REST API
    const res = await fetch(getApiUrl('/attempts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mockPath, attempt }),
      signal: AbortSignal.timeout(3500),
    });
    return res.ok;
  } catch (err) {
    console.debug('[backendApi] persistAttemptToBackend offline or failed');
    return false;
  }
}

/** Fetch dynamic analytics calculated on backend */
export async function fetchBackendAnalytics(): Promise<BackendAnalyticsSummary | null> {
  try {
    const res = await fetch(getApiUrl('/analytics'), { signal: AbortSignal.timeout(3000) });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug('[backendApi] fetchBackendAnalytics failed:', err);
  }
  return null;
}

/** Sync bookmarks with backend */
export async function fetchBackendBookmarks(): Promise<SavedQuestionRecord[] | null> {
  try {
    const res = await fetch(getApiUrl('/bookmarks'), { signal: AbortSignal.timeout(3000) });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug('[backendApi] fetchBackendBookmarks failed:', err);
  }
  return null;
}

export async function saveBookmarkToBackend(bookmark: SavedQuestionRecord): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/bookmarks'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookmark),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteBookmarkFromBackend(id: string): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl(`/bookmarks/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Perform seamless two-way merge synchronization between local DB and backend */
export async function syncDatabaseWithBackend(): Promise<{ synced: boolean; totalAttempts: number }> {
  try {
    const localDb = getDb();
    const res = await fetch(getApiUrl('/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attempts: localDb.attempts }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const serverData = await res.json();
      if (serverData && serverData.attempts) {
        // Merge server attempts into local store
        let addedCount = 0;
        Object.entries(serverData.attempts as Record<string, Attempt[]>).forEach(([path, attList]) => {
          if (Array.isArray(attList)) {
            const localList = localDb.attempts[path] || [];
            attList.forEach((serverAtt) => {
              const alreadyHas = localList.some((l) => l.submittedAt === serverAtt.submittedAt);
              if (!alreadyHas) {
                saveAttempt(path, serverAtt);
                addedCount++;
              }
            });
          }
        });
        return { synced: true, totalAttempts: addedCount };
      }
    }
  } catch (err) {
    console.debug('[backendApi] Sync failed (operating in standalone offline mode):', err);
  }
  return { synced: false, totalAttempts: 0 };
}
