/* CREDENTIALS — password + security-question auth for login ids.

   SECURITY MODEL
   • Passwords and security answers are NEVER stored or compared in
     plaintext. Each is PBKDF2-SHA256 hashed with its own random salt
     (100k iterations) via Web Crypto. Verification recomputes the hash
     and constant-time compares.
   • On DESKTOP (Electron), the credential map is additionally mirrored to
     an OS-encrypted file in the userData dir (survives reinstall/update)
     via the aetherDesktop bridge — main.js encrypts with safeStorage.
   • Honesty: this is strong LOCAL protection (no plaintext anywhere,
     OS-encrypted at rest on desktop). Like any pure-client credential it
     can be bypassed by someone with full control of their own machine —
     it is not server-grade auth.

   STORAGE (global, not namespaced — identity is global):
     aether-credentials → { [profileId]: CredentialRecord } */

const CREDS_KEY = 'aether-credentials';
const ITERATIONS = 100_000;
const KEY_LEN_BITS = 256;
const SALT_BYTES = 16;

/** One security question + its hashed answer. */
export interface SecurityQA {
  /** The question text (shown verbatim at recovery). */
  q: string;
  salt: string; // base64
  hash: string; // base64 PBKDF2
  /** PBKDF2 iterations THIS answer was hashed with. Stored per-answer so the
      recovery check never depends on the password record's iteration count —
      the two must be free to diverge. */
  iterations: number;
}

/** Per-profile credential record (no plaintext anywhere). */
export interface CredentialRecord {
  salt: string; // base64
  hash: string; // base64 PBKDF2
  iterations: number;
  /** Exactly 4 security Q&A used for password recovery. */
  secqa: SecurityQA[];
}

type CredMap = Record<string, CredentialRecord>;

/* Fixed bank of security questions (user picks 4) */
export const SECURITY_QUESTIONS: readonly string[] = [
  'What was the name of your first school?',
  'What is your childhood nickname?',
  'In which city were you born?',
  "What is your mother's maiden name?",
  'What was the name of your first pet?',
  'What is your favorite teacher’s name?',
  'What was your first mobile phone number?',
  'What is the name of your best friend from school?',
];

/* Web Crypto helpers */
function bytesToB64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const arr = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function randomSalt(): string {
  const arr = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(arr);
  return bytesToB64(arr);
}

/** True when Web Crypto's subtle API is usable. It exists ONLY in secure
    contexts (HTTPS, or http://localhost / 127.0.0.1). Over plain HTTP on a LAN
    IP or non-localhost host, `crypto.subtle` is undefined — every auth op
    would otherwise die with an opaque TypeError and lock users out of the
    gated app entirely. */
export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

async function pbkdf2(secret: string, saltB64: string, iterations: number): Promise<string> {
  if (!cryptoAvailable()) {
    throw new Error(
      'Secure context required: sign-in needs HTTPS or http://localhost. ' +
        'Open the app via localhost (or enable HTTPS) and try again.',
    );
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LEN_BITS,
  );
  return bytesToB64(bits);
}

/** Constant-time string compare. Does NOT early-return on length mismatch:
    the length difference is folded into the accumulator and the loop runs over
    the longer input, so timing can't reveal whether lengths even matched. Both
    inputs are internally-generated base64, but this hardens against a
    corrupted/tampered stored hash. */
function constantTimeEqual(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length; // non-zero if lengths differ
  for (let i = 0; i < maxLen; i++) {
    const ca = i < a.length ? a.charCodeAt(i) : 0;
    const cb = i < b.length ? b.charCodeAt(i) : 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/** Normalize a security answer so case/spacing don't matter. */
function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

/* Brute-force throttling
   Unlimited login/recovery attempts make short passwords and the recovery
   path brute-forceable. Track consecutive failures per id and enforce an
   escalating cooldown. Persisted (so closing the tab doesn't reset it) but
   best-effort: an attacker with devtools can clear it — this raises the cost
   for casual/curious attackers and scripted online guessing, which is the
   threat a local-only app can realistically address. */
const ATTEMPTS_KEY = 'aether-auth-attempts';
const FREE_ATTEMPTS = 5; // failures allowed before cooldowns kick in
const BASE_COOLDOWN_MS = 5_000; // 5s, doubling per extra failure
const MAX_COOLDOWN_MS = 5 * 60_000; // cap at 5 minutes

interface AttemptRec {
  fails: number;
  lockedUntil: number; // ms epoch; 0 = not locked
}
type AttemptMap = Record<string, AttemptRec>;

function readAttempts(): AttemptMap {
  const raw = safeGet(ATTEMPTS_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as AttemptMap;
  } catch {
    return {};
  }
}
function writeAttempts(map: AttemptMap): void {
  safeSet(ATTEMPTS_KEY, JSON.stringify(map));
}

/** Milliseconds the given id must wait before another attempt (0 if clear). */
export function throttleWaitMs(id: string): number {
  const rec = readAttempts()[id];
  if (!rec || !rec.lockedUntil) return 0;
  return Math.max(0, rec.lockedUntil - Date.now());
}

/** Record a failed attempt; returns the cooldown now in effect (ms). */
function recordFailure(id: string): number {
  const map = readAttempts();
  const rec = map[id] || { fails: 0, lockedUntil: 0 };
  rec.fails += 1;
  let wait = 0;
  if (rec.fails > FREE_ATTEMPTS) {
    const over = rec.fails - FREE_ATTEMPTS;
    wait = Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * 2 ** (over - 1));
    rec.lockedUntil = Date.now() + wait;
  }
  map[id] = rec;
  writeAttempts(map);
  return wait;
}

/** Clear the failure counter on a successful attempt. */
function recordSuccess(id: string): void {
  const map = readAttempts();
  if (!(id in map)) return;
  delete map[id];
  writeAttempts(map);
}

/* Safe storage helpers */
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

function isSecQA(x: unknown): x is SecurityQA {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as SecurityQA).q === 'string' &&
    typeof (x as SecurityQA).salt === 'string' &&
    typeof (x as SecurityQA).hash === 'string'
    // `iterations` is optional in STORED data: records written before it was
    // added lack it. Verification falls back to the record-level count for
    // those (see verifySecurityAnswers).
  );
}
function isCredRecord(x: unknown): x is CredentialRecord {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as CredentialRecord).salt === 'string' &&
    typeof (x as CredentialRecord).hash === 'string' &&
    typeof (x as CredentialRecord).iterations === 'number' &&
    Array.isArray((x as CredentialRecord).secqa) &&
    (x as CredentialRecord).secqa.every(isSecQA)
  );
}

/* Desktop (Electron) bridge */
function desktop(): any {
  return typeof window !== 'undefined' ? (window as any).aetherDesktop : undefined;
}

/* ── Credential map read/write (web store + desktop mirror) ──── */
function readMap(): CredMap {
  const raw = safeGet(CREDS_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: CredMap = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([id, rec]) => {
      if (isCredRecord(rec)) out[id] = rec;
    });
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: CredMap): void {
  safeSet(CREDS_KEY, JSON.stringify(map));
  // Mirror to disk on desktop (encrypted in main.js) so credentials survive a
  // reinstall. Fire-and-forget — never blocks the login flow.
  try {
    desktop()?.credsSave?.(map);
  } catch {
    /* non-Electron */
  }
}

/** Pull credentials from the desktop disk mirror and MERGE into localStorage.
    Disk wins on conflict (it's the durable copy that survives reinstall).
    Called once at boot on desktop. Returns the merged map. */
export async function syncFromDisk(): Promise<void> {
  const d = desktop();
  if (!d?.credsLoad) return;
  try {
    const disk: unknown = await d.credsLoad();
    if (typeof disk !== 'object' || disk === null) return;
    const map = readMap();
    let changed = false;
    Object.entries(disk as Record<string, unknown>).forEach(([id, rec]) => {
      if (isCredRecord(rec) && JSON.stringify(map[id]) !== JSON.stringify(rec)) {
        map[id] = rec;
        changed = true;
      }
    });
    if (changed) safeSet(CREDS_KEY, JSON.stringify(map));
  } catch {
    /* disk unavailable — keep web copy */
  }
}

/* ── Public API ──────────────────────────────────────────────── */

/** Minimum password strength. Returns an error string when too weak, else
    null. Enforced on create / change / reset. A 4-char floor invited trivial
    brute force; this demands length + a little variety. */
export const MIN_PASSWORD_LEN = 8;
export function passwordStrengthError(pw: string): string | null {
  if (!pw || pw.length < MIN_PASSWORD_LEN) return `Password must be at least ${MIN_PASSWORD_LEN} characters`;
  if (/^(.)\1+$/.test(pw)) return 'Password can’t be all the same character';
  if (/^\d+$/.test(pw)) return 'Password can’t be only numbers';
  const common = ['password', '12345678', 'qwertyui', 'iloveyou', 'abcd1234'];
  if (common.includes(pw.toLowerCase())) return 'That password is too common';
  return null;
}

export function hasCredentials(id: string): boolean {
  return id in readMap();
}

/** The recovery questions for a profile (text only — answers stay hashed). */
export function getSecurityQuestions(id: string): string[] {
  return (readMap()[id]?.secqa || []).map((s) => s.q);
}

/** Create credentials for a NEW profile: password + exactly 4 security Q&A. */
export async function createCredentials(
  id: string,
  password: string,
  secqa: Array<{ q: string; a: string }>,
): Promise<void> {
  const weak = passwordStrengthError(password);
  if (weak) throw new Error(weak);
  if (!Array.isArray(secqa) || secqa.length !== 4) throw new Error('4 security answers are required');
  const salt = randomSalt();
  const hash = await pbkdf2(password, salt, ITERATIONS);
  const hashedQA: SecurityQA[] = [];
  for (const { q, a } of secqa) {
    const norm = normalizeAnswer(a);
    if (!norm) throw new Error('Every security answer must be filled in');
    const asalt = randomSalt();
    // Each answer carries its OWN iteration count so verification never has to
    // borrow the password record's (the two are free to diverge over time).
    hashedQA.push({ q, salt: asalt, hash: await pbkdf2(norm, asalt, ITERATIONS), iterations: ITERATIONS });
  }
  const map = readMap();
  map[id] = { salt, hash, iterations: ITERATIONS, secqa: hashedQA };
  writeMap(map);
}

/** Error thrown when an id is rate-limited. `waitMs` is how long to wait. */
export class ThrottleError extends Error {
  waitMs: number;
  constructor(waitMs: number) {
    super(`Too many attempts. Try again in ${Math.ceil(waitMs / 1000)}s.`);
    this.name = 'ThrottleError';
    this.waitMs = waitMs;
  }
}

/** Verify a login password. Throws ThrottleError when the id is rate-limited. */
export async function verifyPassword(id: string, password: string): Promise<boolean> {
  const wait = throttleWaitMs(id);
  if (wait > 0) throw new ThrottleError(wait);
  const rec = readMap()[id];
  if (!rec) return false;
  const hash = await pbkdf2(password, rec.salt, rec.iterations);
  const ok = constantTimeEqual(hash, rec.hash);
  if (ok) recordSuccess(id);
  else {
    const newWait = recordFailure(id);
    if (newWait > 0) throw new ThrottleError(newWait);
  }
  return ok;
}

/** Verify the 4 recovery answers (in order). All must match. Evaluates EVERY
    answer and ANDs the results WITHOUT early return: because PBKDF2 is slow,
    bailing on the first mismatch would leak — via timing — exactly how many
    answers were right, turning one 4-part secret into four 1-part secrets. */
export async function verifySecurityAnswers(id: string, answers: string[]): Promise<boolean> {
  const wait = throttleWaitMs(`${id}:recovery`);
  if (wait > 0) throw new ThrottleError(wait);
  const rec = readMap()[id];
  if (!rec || !Array.isArray(answers) || answers.length !== rec.secqa.length) return false;
  let ok = true;
  for (let i = 0; i < rec.secqa.length; i++) {
    const norm = normalizeAnswer(answers[i] || '');
    // Per-answer iterations when present (new records); fall back to the
    // record-level count for credentials written before iterations was stored.
    const iters = rec.secqa[i].iterations ?? rec.iterations;
    const hash = await pbkdf2(norm, rec.secqa[i].salt, iters);
    ok = constantTimeEqual(hash, rec.secqa[i].hash) && ok;
  }
  if (ok) recordSuccess(`${id}:recovery`);
  else {
    const newWait = recordFailure(`${id}:recovery`);
    if (newWait > 0) throw new ThrottleError(newWait);
  }
  return ok;
}

/** Overwrite the password (keeps the existing security questions). Used by
    both change-password (after verifying current) and forgot-password reset
    (after verifying answers). */
export async function setPassword(id: string, newPassword: string): Promise<void> {
  const weak = passwordStrengthError(newPassword);
  if (weak) throw new Error(weak);
  const map = readMap();
  const rec = map[id];
  if (!rec) throw new Error('No credentials for this login id');
  const salt = randomSalt();
  rec.salt = salt;
  rec.hash = await pbkdf2(newPassword, salt, rec.iterations);
  map[id] = rec;
  writeMap(map);
}

/** Change password with the current one. Returns false if current is wrong. */
export async function changePassword(id: string, current: string, next: string): Promise<boolean> {
  if (!(await verifyPassword(id, current))) return false;
  await setPassword(id, next);
  return true;
}

/** Drop a profile's credentials (called when the profile is deleted). */
export function deleteCredentials(id: string): void {
  const map = readMap();
  if (!(id in map)) return;
  delete map[id];
  writeMap(map);
}
