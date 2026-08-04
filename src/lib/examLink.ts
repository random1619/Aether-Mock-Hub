/** Build the router path for a mock, base64url-encoding its canonical path. */
export function examPath(mockPath: string): string {
  const b64 = btoa(encodeURIComponent(mockPath)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `/exam/${b64}`;
}

/** Decode the :encoded route param back to a canonical mock path. */
export function decodeExamParam(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(atob(b64));
}
