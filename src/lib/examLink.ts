/** Build the router path for a mock, base64url-encoding its canonical path. */
export function examPath(mockPath: string, opts?: { mode?: 'review'; attempt?: number }): string {
  const b64 = btoa(encodeURIComponent(mockPath)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const params = new URLSearchParams();
  if (opts?.mode) params.set('mode', opts.mode);
  if (opts?.attempt) params.set('attempt', String(opts.attempt));
  const query = params.toString() ? `?${params.toString()}` : '';
  return `/exam/${b64}${query}`;
}

/** Decode the :encoded route param back to a canonical mock path. */
export function decodeExamParam(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  const decoded = atob(padded);
  try {
    return decodeURIComponent(decoded);
  } catch {
    try {
      const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return decoded;
    }
  }
}
