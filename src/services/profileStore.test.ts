/* Profiles namespace every aether storage key; a login id REQUIRES a password
   (hashed, never plaintext). Stores keep module-level singletons, so tests
   reset modules + localStorage and re-import to observe a fresh load(). */
import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

const loadProfiles = () => import('@/services/profileStore');

const QA = [
  { q: 'Q1?', a: 'a1' },
  { q: 'Q2?', a: 'a2' },
  { q: 'Q3?', a: 'a3' },
  { q: 'Q4?', a: 'a4' },
];

function validAttempt(overrides: Record<string, unknown> = {}) {
  return {
    score: 10,
    maxScore: 20,
    correct: 5,
    incorrect: 0,
    unattempted: 5,
    accuracy: 100,
    sections: [],
    submittedAt: new Date().toISOString(),
    attemptNumber: 1,
    ...overrides,
  };
}

function seedLegacyDb() {
  const db = {
    version: 3,
    settings: { theme: 'dark' },
    attempts: { 'providers/legacy/mock.html': [validAttempt({ score: 99 })] },
    completed: { 'providers/legacy/mock.html': true },
    savedQuestions: {},
    stats: {},
  };
  localStorage.setItem('aether-db', JSON.stringify(db));
}

describe('profileStore — login required (no guest)', () => {
  it('starts logged out (null active profile) and reports not logged in', async () => {
    const p = await loadProfiles();
    expect(p.getActiveProfile()).toBeNull();
    expect(p.isLoggedIn()).toBe(false);
    expect(p.keySuffix()).toBe('');
  });

  it('creates a login id with a password and namespaces the suffix after login', async () => {
    const p = await loadProfiles();
    const prof = await p.createProfile('Gagan Sharma', 'pw1234567', QA);
    expect(prof.profile.id).toBe('gagan-sharma');
    p.setActiveProfile(prof.profile.id);
    expect(p.getActiveProfile()?.id).toBe('gagan-sharma');
    expect(p.isLoggedIn()).toBe(true);
    expect(p.keySuffix()).toBe('::gagan-sharma');
  });

  it('rejects empty names and missing passwords', async () => {
    const p = await loadProfiles();
    await expect(p.createProfile('   ', 'pw1234567', QA)).rejects.toThrow();
    await expect(p.createProfile('Valid Name', '', QA)).rejects.toThrow();
  });

  it('creating the same name twice is idempotent (returns existing)', async () => {
    const p = await loadProfiles();
    const a = await p.createProfile('Ravi', 'pw1234567', QA);
    const b = await p.createProfile('Ravi', 'pw1234567', QA);
    expect(a.profile.id).toBe(b.profile.id);
    expect(p.listProfiles().filter((x) => x.id === 'ravi')).toHaveLength(1);
  });

  it('persists the active profile across module reloads', async () => {
    let p = await loadProfiles();
    const prof = await p.createProfile('Priya', 'pw1234567', QA);
    p.setActiveProfile(prof.profile.id);
    vi.resetModules();
    p = await loadProfiles();
    expect(p.getActiveProfile()?.id).toBe('priya');
    expect(p.keySuffix()).toBe('::priya');
  });

  it('password check gates login', async () => {
    const p = await loadProfiles();
    const prof = await p.createProfile('Asha', 'rightpass9', QA);
    expect(await p.checkPassword(prof.profile.id, 'wrong')).toBe(false);
    expect(await p.checkPassword(prof.profile.id, 'rightpass9')).toBe(true);
  });

  it('security answers verify and allow a password reset', async () => {
    const p = await loadProfiles();
    const prof = await p.createProfile('Karan', 'oldpass99', QA);
    expect(p.securityQuestionsFor(prof.profile.id)).toEqual(['Q1?', 'Q2?', 'Q3?', 'Q4?']);
    expect(await p.checkSecurityAnswers(prof.profile.id, ['a1', 'a2', 'a3', 'a4'])).toBe(true);
    expect(await p.checkSecurityAnswers(prof.profile.id, ['a1', 'nope', 'a3', 'a4'])).toBe(false);
    await p.resetPassword(prof.profile.id, 'newpass99');
    expect(await p.checkPassword(prof.profile.id, 'newpass99')).toBe(true);
    expect(await p.checkPassword(prof.profile.id, 'oldpass99')).toBe(false);
  });

  it('signOut returns to the logged-out state and clears the suffix', async () => {
    const p = await loadProfiles();
    const prof = await p.createProfile('Asha', 'pw1234567', QA);
    p.setActiveProfile(prof.profile.id);
    expect(p.isLoggedIn()).toBe(true);
    p.signOut();
    expect(p.getActiveProfile()).toBeNull();
    expect(p.keySuffix()).toBe('');
  });

  it('deleteProfile removes the profile, its credentials, and its key family', async () => {
    const p = await loadProfiles();
    const prof = await p.createProfile('Temp User', 'pw1234567', QA);
    p.setActiveProfile(prof.profile.id);
    localStorage.setItem('aether-db::temp-user', '{}');
    localStorage.setItem('aether-exam-progress::temp-user', '{}');
    expect(p.profileHasPassword(prof.profile.id)).toBe(true);
    p.deleteProfile('temp-user');
    expect(p.listProfiles().find((x) => x.id === 'temp-user')).toBeUndefined();
    expect(localStorage.getItem('aether-db::temp-user')).toBeNull();
    expect(localStorage.getItem('aether-exam-progress::temp-user')).toBeNull();
    expect(p.profileHasPassword(prof.profile.id)).toBe(false);
    expect(p.getActiveProfile()).toBeNull();
  });
});

describe('legacy data adoption (first login)', () => {
  it('adopts pre-login aether-db into the FIRST profile created', async () => {
    seedLegacyDb();
    const p = await loadProfiles();
    const prof = await p.createProfile('First User', 'pw1234567', QA);
    expect(localStorage.getItem('aether-db')).toBeNull();
    const adopted = localStorage.getItem(`aether-db::${prof.profile.id}`);
    const raw = JSON.parse(adopted!);
    expect(raw.attempts['providers/legacy/mock.html'][0].score).toBe(99);
  });

  it('does NOT adopt into a SECOND profile', async () => {
    const p = await loadProfiles();
    await p.createProfile('One', 'pw1234567', QA);
    seedLegacyDb();
    await p.createProfile('Two', 'pw1234567', QA);
    expect(localStorage.getItem('aether-db::two')).toBeNull();
  });
});

describe('per-profile data isolation', () => {
  it('an attempt saved in one profile is invisible to another', async () => {
    const profiles = await loadProfiles();
    const a = await profiles.createProfile('Alice A', 'pw1234567', QA);
    profiles.setActiveProfile(a.profile.id);
    const storeA = await import('@/services/attemptStore');
    storeA.saveAttempt('providers/x/mock-1.html', validAttempt({ score: 42 }));
    expect(storeA.getLatestAttempt('providers/x/mock-1.html')?.score).toBe(42);

    const b = await profiles.createProfile('Bob B', 'pw1234567', QA);
    profiles.setActiveProfile(b.profile.id);
    vi.resetModules();
    const pb = await loadProfiles();
    pb.setActiveProfile(b.profile.id);
    const storeB = await import('@/services/attemptStore');
    storeB.reloadForProfile();
    expect(storeB.getLatestAttempt('providers/x/mock-1.html')).toBeNull();

    const p2 = await loadProfiles();
    p2.setActiveProfile(a.profile.id);
    vi.resetModules();
    const p3 = await loadProfiles();
    p3.setActiveProfile(a.profile.id);
    const storeA2 = await import('@/services/attemptStore');
    storeA2.reloadForProfile();
    expect(storeA2.getLatestAttempt('providers/x/mock-1.html')?.score).toBe(42);
  });

  it('a logged-in profile writes to its own namespaced aether-db key', async () => {
    const profiles = await loadProfiles();
    const prof = await profiles.createProfile('Meera', 'pw1234567', QA);
    profiles.setActiveProfile(prof.profile.id);
    const store = await import('@/services/attemptStore');
    store.saveAttempt('providers/y/mock.html', validAttempt({ score: 7 }));
    const raw = JSON.parse(localStorage.getItem(`aether-db::${prof.profile.id}`)!);
    expect(Object.keys(raw.attempts)).toContain('providers/y/mock.html');
    expect(localStorage.getItem('aether-db')).toBeNull();
  });
});
