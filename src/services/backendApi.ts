/**
 * Aether Backend API Client
 * ========================
 * Provides dynamic, robust communication with the Aether Backend Server & Electron IPC.
 * Supports complete per-user isolation, offline-first fallbacks, and automatic background synchronization.
 */

import { isNativeMobile } from '@/services/nativeMobile';
import type { Attempt, MockEntry, SavedQuestionRecord } from '@/types';
import { getDb, saveAttempt } from '@/services/attemptStore';

const RENDER_BACKEND_URL = 'https://aether-mock-hub.onrender.com';

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

function getApiUrl(endpoint: string): string {
  const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL;
  if (envUrl) {
    return `${envUrl.replace(/\/+$/, '')}/api${endpoint}`;
  }
  // Native mobile APK container connects directly to Render
  if (isNativeMobile()) {
    return `${RENDER_BACKEND_URL}/api${endpoint}`;
  }
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    if (
      window.location.origin.includes('onrender.com') ||
      window.location.origin.includes('localhost:5173') ||
      window.location.origin.includes('localhost:8080') ||
      window.location.origin.includes('127.0.0.1')
    ) {
      return `${window.location.origin}/api${endpoint}`;
    }
  }
  return `${RENDER_BACKEND_URL}/api${endpoint}`;
}

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': getCurrentUserId(),
  };
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

/** Check if the backend API is live */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl('/health'), {
      headers: getHeaders(),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get system information and stats from backend */
export async function getSystemInfo(): Promise<BackendSystemInfo | null> {
  try {
    const res = await fetch(getApiUrl('/system'), {
      headers: getHeaders(),
      signal: AbortSignal.timeout(3000),
    });
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

    const res = await fetch(url.toString(), {
      headers: getHeaders(),
      signal: AbortSignal.timeout(4000),
    });
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

/** Fetch all stored attempts for the active user */
export async function fetchBackendAttempts(): Promise<Record<string, Attempt[]> | null> {
  try {
    const res = await fetch(getApiUrl('/attempts'), {
      headers: getHeaders(),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug('[backendApi] fetchBackendAttempts failed:', err);
  }
  return null;
}

/** Save an attempt to backend database for the active user */
export async function persistAttemptToBackend(mockPath: string, attempt: Attempt): Promise<boolean> {
  try {
    const userId = getCurrentUserId();

    // 1. If Electron IPC available, also persist via desktop API
    const desktopApi = (window as unknown as { electronAPI?: { saveAttempt?: (d: any) => Promise<any> } }).electronAPI;
    if (desktopApi?.saveAttempt) {
      desktopApi.saveAttempt({ userId, mockPath, attempt }).catch(() => {});
    }

    // 2. Persist to REST API
    const res = await fetch(getApiUrl('/attempts'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, mockPath, attempt }),
      signal: AbortSignal.timeout(3500),
    });
    return res.ok;
  } catch {
    console.debug('[backendApi] persistAttemptToBackend offline or failed');
    return false;
  }
}

/** Fetch dynamic analytics calculated on backend for the active user */
export async function fetchBackendAnalytics(): Promise<BackendAnalyticsSummary | null> {
  try {
    const res = await fetch(getApiUrl('/analytics'), {
      headers: getHeaders(),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug('[backendApi] fetchBackendAnalytics failed:', err);
  }
  return null;
}

/** Sync bookmarks with backend for the active user */
export async function fetchBackendBookmarks(): Promise<SavedQuestionRecord[] | null> {
  try {
    const res = await fetch(getApiUrl('/bookmarks'), {
      headers: getHeaders(),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug('[backendApi] fetchBackendBookmarks failed:', err);
  }
  return null;
}

export async function saveBookmarkToBackend(bookmark: SavedQuestionRecord): Promise<boolean> {
  try {
    const userId = getCurrentUserId();
    const res = await fetch(getApiUrl('/bookmarks'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId, bookmark }),
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
      headers: getHeaders(),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Perform seamless two-way merge synchronization between local DB and backend for the active user */
export async function syncDatabaseWithBackend(): Promise<{ synced: boolean; totalAttempts: number }> {
  try {
    const userId = getCurrentUserId();
    const localDb = getDb();
    const res = await fetch(getApiUrl('/sync'), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        userId,
        attempts: localDb.attempts,
        bookmarks: Object.values(localDb.savedQuestions || {}),
      }),
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
