/* Credentials are PBKDF2-hashed in localStorage; tests reset storage between
   runs. Web Crypto (subtle/getRandomValues) is provided by the jsdom env. */
import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

const load = () => import('@/services/credentials');

const QA = [
  { q: 'Q1?', a: 'answer one' },
  { q: 'Q2?', a: 'answer two' },
  { q: 'Q3?', a: 'answer three' },
  { q: 'Q4?', a: 'answer four' },
];

describe('credentials — password auth', () => {
  it('creates credentials and verifies the right password', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'secret123', QA);
    expect(c.hasCredentials('gagan')).toBe(true);
    expect(await c.verifyPassword('gagan', 'secret123')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'secret123', QA);
    expect(await c.verifyPassword('gagan', 'wrong')).toBe(false);
  });

  it('returns false for an unknown id', async () => {
    const c = await load();
    expect(await c.verifyPassword('nobody', 'x')).toBe(false);
    expect(c.hasCredentials('nobody')).toBe(false);
  });

  it('never stores the plaintext password', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'secret123', QA);
    const raw = localStorage.getItem('aether-credentials')!;
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('secret123');
    const parsed = JSON.parse(raw);
    expect(parsed.gagan.hash).toBeTruthy();
    expect(parsed.gagan.salt).toBeTruthy();
    expect(parsed.gagan.iterations).toBeGreaterThan(0);
  });

  it('requires a password and exactly 4 security answers', async () => {
    const c = await load();
    await expect(c.createCredentials('a', '', QA)).rejects.toThrow();
    await expect(c.createCredentials('b', 'pw123456', QA.slice(0, 3))).rejects.toThrow();
    await expect(
      c.createCredentials('c', 'pw123456', [{ q: 'Q', a: '  ' }, ...QA.slice(1)]),
    ).rejects.toThrow();
  });

  it('changePassword only works with the current password', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'oldpass1', QA);
    expect(await c.changePassword('gagan', 'wrong', 'newpass12')).toBe(false);
    expect(await c.changePassword('gagan', 'oldpass1', 'newpass12')).toBe(true);
    expect(await c.verifyPassword('gagan', 'newpass12')).toBe(true);
    expect(await c.verifyPassword('gagan', 'oldpass1')).toBe(false);
  });

  it('deleteCredentials removes the record', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'secret123', QA);
    c.deleteCredentials('gagan');
    expect(c.hasCredentials('gagan')).toBe(false);
  });
});

describe('credentials — security-question recovery', () => {
  it('exposes the question text but not the answers', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'secret123', QA);
    const qs = c.getSecurityQuestions('gagan');
    expect(qs).toEqual(['Q1?', 'Q2?', 'Q3?', 'Q4?']);
    const raw = localStorage.getItem('aether-credentials')!;
    expect(raw).not.toContain('answer one');
  });

  it('verifies correct answers (case/spacing-insensitive)', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'secret123', QA);
    expect(await c.verifySecurityAnswers('gagan', ['answer one', 'answer two', 'answer three', 'answer four'])).toBe(true);
    // Normalization: different case + extra spaces still match.
    expect(await c.verifySecurityAnswers('gagan', ['  ANSWER ONE ', 'Answer Two', 'answer  three', 'answer four'])).toBe(true);
  });

  it('rejects when any answer is wrong', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'secret123', QA);
    expect(await c.verifySecurityAnswers('gagan', ['answer one', 'WRONG', 'answer three', 'answer four'])).toBe(false);
  });

  it('setPassword resets the password but keeps the questions', async () => {
    const c = await load();
    await c.createCredentials('gagan', 'oldpass1', QA);
    await c.setPassword('gagan', 'reset123');
    expect(await c.verifyPassword('gagan', 'reset123')).toBe(true);
    expect(await c.verifyPassword('gagan', 'oldpass1')).toBe(false);
    // Recovery still works with the ORIGINAL answers after a reset.
    expect(await c.verifySecurityAnswers('gagan', ['answer one', 'answer two', 'answer three', 'answer four'])).toBe(true);
  });
});
