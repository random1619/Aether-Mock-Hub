/* PROFILE STORE — local-only per-user identity (login required).
   Multiple people can share one device/browser, each with their own
   fully separate progress (attempts, bookmarks, streaks, settings,
   in-progress exam). No server: a profile is just a namespace suffix
   applied to every aether storage key.

   A LOGIN IS REQUIRED — there is no Guest/anonymous mode. When no
   profile is active the app renders only the login panel (LoginGate)
   and blocks all interaction, so the stores below are never exercised
   while logged out.

   Two GLOBAL keys (never namespaced) track identity itself:
     aether-profiles  → array of every profile ever created
     aether-profile   → the currently active profile {id,name}
   All progress data lives under keys suffixed with the active
   profile's id — see keySuffix(). When NO profile is active, keySuffix()
   returns the legacy unsuffixed form ('') so the module-load-time read
   touches the original keys harmlessly; the login gate prevents any
   writes in that state.

   First run: a user with existing legacy progress (unsuffixed aether-db
   from before profiles existed) has that data ADOPTED into the first
   profile they create, so nothing is lost. */
import { create } from 'zustand';
import {
  createCredentials,
  verifyPassword,
  verifySecurityAnswers,
  setPassword,
  changePassword as credChangePassword,
  deleteCredentials,
  hasCredentials,
  getSecurityQuestions,
} from '@/services/credentials';

export interface Profile {
  /** Slug used as the storage suffix (stable, derived from the name). */
  id: string;
  /** Display name shown in the UI. */
  name: string;
  /** ISO creation time. */
  createdAt: string;
}

const PROFILES_KEY = 'aether-profiles';
const ACTIVE_KEY = 'aether-profile';

/* ── Safe storage helpers (never throw — private mode / quota) ── */
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Slugify a display name into a stable storage-safe id. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'user'
  );
}

function isProfile(x: unknown): x is Profile {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as Profile).id === 'string' &&
    typeof (x as Profile).name === 'string'
  );
}

/** Read the full profile list. Corrupt data → []. */
export function listProfiles(): Profile[] {
  const raw = safeGet(PROFILES_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProfile);
  } catch {
    return [];
  }
}

function writeProfiles(profiles: Profile[]): void {
  safeSet(PROFILES_KEY, JSON.stringify(profiles));
}

/** All selectable profiles (every created login id). */
export function allProfiles(): Profile[] {
  return listProfiles();
}

/** The active profile, or null when LOGGED OUT. The app shows the login
    panel whenever this is null. */
export function getActiveProfile(): Profile | null {
  const raw = safeGet(ACTIVE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isProfile(parsed)) {
      const found = listProfiles().find((p) => p.id === parsed.id);
      if (found) return found;
    }
  } catch {
    /* fall through to logged-out */
  }
  return null;
}

/** Storage suffix for the active profile: '::<id>' when logged in, '' (the
    legacy unsuffixed keys) when logged out. This is THE single source of
    truth both attemptStore and examProgress use to namespace every key. Read
    lazily (never cached at module top) so a profile switch takes effect
    immediately and there's no import-order dependency on this module. */
export function keySuffix(): string {
  const active = getActiveProfile();
  return active ? `::${active.id}` : '';
}

/** Whether a login is currently active. The login gate keys off this. */
export function isLoggedIn(): boolean {
  return getActiveProfile() !== null;
}

/* Legacy data adoption
   Before profiles existed, progress lived in the UNSUFFIXED keys
   (aether-db, aether-exam-progress, and the aether-db.* durability slots).
   When the FIRST profile is created, move that whole family under the new
   profile's namespace so a returning user keeps their history. */

/** All localStorage keys belonging to the aether-db family for a given base
    ('aether-db' or 'aether-db::<id>') plus the matching exam-progress key. */
function familyKeys(base: string): string[] {
  const progressBase = base.replace('aether-db', 'aether-exam-progress');
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k === base || k.startsWith(base + '.')) out.push(k);
      else if (k === progressBase || k.startsWith(progressBase + '.')) out.push(k);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Move the unsuffixed (legacy) family under `::id`. Best-effort; a copy that
    fails to delete just leaves a harmless orphan. */
function adoptLegacyDataInto(id: string): void {
  const legacy = familyKeys('aether-db');
  if (!legacy.length) return;
  legacy.forEach((k) => {
    // 'aether-db' / 'aether-db.journal' → 'aether-db::<id>' / 'aether-db::<id>.journal'
    // 'aether-exam-progress' → 'aether-exam-progress::<id>'
    const base = k.startsWith('aether-exam-progress') ? 'aether-exam-progress' : 'aether-db';
    const suffixPart = k.slice(base.length); // '' or '.journal' etc.
    const newKey = `${base}::${id}${suffixPart}`;
    const val = safeGet(k);
    if (val !== null) safeSet(newKey, val);
    safeRemove(k);
  });
}

/** Result of createProfile. `created` is false when the id ALREADY existed —
    callers must NOT auto-login in that case (that would be an unauthenticated
    login into someone else's account; see the auth-bypass fix in addProfile). */
export interface CreateProfileResult {
  profile: Profile;
  created: boolean;
}

/** Create a new profile (login id) WITH a mandatory password + 4 security
    answers. The first profile created adopts any pre-existing legacy progress.
    If the id already exists, returns { created:false } WITHOUT touching the
    existing credentials — the caller decides what to do (require login). */
export async function createProfile(
  name: string,
  password: string,
  secqa: Array<{ q: string; a: string }>,
): Promise<CreateProfileResult> {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Profile name is required');
  const id = slugify(trimmed);
  const existing = listProfiles();
  const found = existing.find((p) => p.id === id);
  if (found) return { profile: found, created: false };
  // Create credentials FIRST — if this throws (weak/missing data) no orphaned
  // profile is left behind without a way to log into it.
  await createCredentials(id, password, secqa);
  const profile: Profile = { id, name: trimmed, createdAt: new Date().toISOString() };
  // Adopt legacy (pre-login) progress into the FIRST profile only — later
  // profiles start clean, and a second adoption would copy nothing anyway.
  if (existing.length === 0) adoptLegacyDataInto(id);
  writeProfiles([...existing, profile]);
  return { profile, created: true };
}

/** Verify a login password for a profile. */
export async function checkPassword(id: string, password: string): Promise<boolean> {
  return verifyPassword(id, password);
}

/** Verify the 4 recovery answers for a profile. */
export async function checkSecurityAnswers(id: string, answers: string[]): Promise<boolean> {
  return verifySecurityAnswers(id, answers);
}

/** Reset a password after successful security-answer verification. */
export async function resetPassword(id: string, newPassword: string): Promise<void> {
  return setPassword(id, newPassword);
}

/** Change password given the current one. */
export async function changePassword(id: string, current: string, next: string): Promise<boolean> {
  return credChangePassword(id, current, next);
}

/** Recovery questions for a profile (text only). */
export function securityQuestionsFor(id: string): string[] {
  return getSecurityQuestions(id);
}

/** Whether a profile has credentials on record (it always should). */
export function profileHasPassword(id: string): boolean {
  return hasCredentials(id);
}

/** Delete a profile, its credentials, and EVERY storage key that belongs to it
    (main DB, durability slots, corrupt backups, exam-progress snapshot). If
    it's the active profile, signs out to the logged-out state (login panel). */
export function deleteProfile(id: string): void {
  const active = getActiveProfile();
  if (active?.id === id) signOut();
  writeProfiles(listProfiles().filter((p) => p.id !== id));
  deleteCredentials(id);
  familyKeys(`aether-db::${id}`).forEach(safeRemove);
}

/** Point the app at a profile (log in). Persistence of the switch is this
    module's job; RELOADING the in-memory data stores is the caller's (wired in
    main.tsx via onProfileChange) so this module stays free of any dependency
    on attemptStore. */
export function setActiveProfile(id: string): void {
  const target = listProfiles().find((p) => p.id === id);
  if (!target) return;
  safeSet(ACTIVE_KEY, JSON.stringify(target));
  notifyProfileChange();
}

/** Log out: clear the active profile so the login panel gates the app again.
    The profile's data is left intact under its namespace for next login. */
export function signOut(): void {
  if (!getActiveProfile()) return;
  safeRemove(ACTIVE_KEY);
  notifyProfileChange();
}

/* Change notification (subscription, UI-free) */
const _listeners = new Set<() => void>();

/** Subscribe to active-profile changes (login, logout, switch). */
export function onProfileChange(cb: () => void): () => void {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function notifyProfileChange(): void {
  _listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* a broken listener shouldn't break the switch */
    }
  });
}

/* Zustand store for the UI */
interface ProfileState {
  /** The active profile, or null when logged out. */
  active: Profile | null;
  /** All created profiles. */
  profiles: Profile[];
  /** Create a profile (with password + 4 security answers) and log into it.
      Returns an error string on failure, null on success. If the id already
      exists, returns an error directing the user to sign in instead — it never
      auto-logs into an existing account. */
  addProfile: (name: string, password: string, secqa: Array<{ q: string; a: string }>) => Promise<string | null>;
  /** Log into an existing profile after verifying its password. Returns an
      error string on failure, null on success. */
  login: (id: string, password: string) => Promise<string | null>;
  /** Log into an already-verified profile (internal; password checked by caller). */
  switchTo: (id: string) => void;
  /** Log out back to the login panel. */
  logout: () => void;
  /** Remove a profile (and its data + credentials), refreshing the list. */
  remove: (id: string) => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  active: getActiveProfile(),
  profiles: allProfiles(),
  addProfile: async (name, password, secqa) => {
    try {
      const { profile, created } = await createProfile(name, password, secqa);
      if (!created) {
        // The id already exists. Do NOT log in — creating-with-an-existing-
        // name must never become an unauthenticated login into that account.
        return `The login id "${profile.name}" already exists. Sign in with its password instead.`;
      }
      setActiveProfile(profile.id);
      set({ active: profile, profiles: allProfiles() });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not create that login id';
    }
  },
  login: async (id, password) => {
    const profile = listProfiles().find((p) => p.id === id);
    if (!profile) return 'Login id not found';
    let ok: boolean;
    try {
      ok = await verifyPassword(id, password);
    } catch (e) {
      // Throttle (rate-limit) or crypto-availability errors surface as-is.
      return e instanceof Error ? e.message : 'Sign-in failed';
    }
    if (!ok) return 'Incorrect password';
    setActiveProfile(id);
    set({ active: getActiveProfile(), profiles: allProfiles() });
    return null;
  },
  switchTo: (id) => {
    if (id === get().active?.id) return;
    setActiveProfile(id);
    set({ active: getActiveProfile(), profiles: allProfiles() });
  },
  logout: () => {
    signOut();
    set({ active: null, profiles: allProfiles() });
  },
  remove: (id) => {
    deleteProfile(id);
    set({ active: getActiveProfile(), profiles: allProfiles() });
  },
}));

/* Keep the zustand store in sync when the profile changes from anywhere
   (this store's own actions, or a future programmatic switch). The data
   stores (attemptStore/examProgress) subscribe separately in main.tsx. */
onProfileChange(() => {
  useProfileStore.setState({ active: getActiveProfile(), profiles: allProfiles() });
});
