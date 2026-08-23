/**
 * Local-only account layer
 * ========================
 * This build has NO cloud: there is no Render backend, no remote account
 * registry, no bearer-token sessions. All identities are local profiles
 * (see profileStore) with PBKDF2 credentials stored in localStorage.
 *
 * This module keeps the previous cloud-auth surface as explicit no-op stubs
 * so any remaining import compiles and clearly signals "local only" instead
 * of silently attempting a network call. The app never references these in
 * the UI path after the local-first refactor.
 */

export interface CloudUser {
  id: string;
  loginId: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CloudSession {
  token: string;
  user: CloudUser;
}

/** Reserved for a future self-hosted backend; always null in local mode. */
export function cloudApiUrl(_path: string): string {
  return '';
}

export function getCloudSession(): CloudSession | null {
  return null;
}

export function getCloudToken(): string | null {
  return null;
}

export function getCloudUser(): CloudUser | null {
  return null;
}

export function isCloudAuthenticated(): boolean {
  return false;
}

export function onCloudSessionChange(_listener: () => void): () => void {
  return () => {};
}

export function normalizeLoginId(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

/** Local mode: creating a cloud account is not supported. Throws clearly. */
export async function registerCloudAccount(): Promise<CloudSession> {
  throw new Error('Accounts are local-only in this build');
}

/** Local mode: cloud login is not supported. Throws clearly. */
export async function loginCloudAccount(): Promise<CloudSession> {
  throw new Error('Accounts are local-only in this build');
}

/** Local mode: no session to validate. */
export async function validateCloudSession(): Promise<CloudUser | null> {
  return null;
}

/** Local mode: nothing to sign out from. */
export async function logoutCloudAccount(): Promise<void> {
  /* no-op */
}