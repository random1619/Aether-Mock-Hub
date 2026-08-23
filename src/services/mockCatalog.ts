/* MOCK CATALOG — load the browsable mock catalog.
   mocks-data.js is generated as `const MOCK_DATA = [<valid JSON>];`.
   We fetch it once, strip the assignment wrapper, JSON.parse it (never
   execute it), and expose a typed, cached catalog. */
import type { MockEntry } from '@/types';

let _cache: MockEntry[] | null = null;
/** Cached old→new path map from MOCK_PATH_MAP (empty object when absent). */
let _pathMap: Record<string, string> = {};
/** In-flight promise so concurrent callers share one network request. */
let _loading: Promise<MockEntry[]> | null = null;

/** Entries the React exam engine can't render: PDF-reader links and other
    app-shell/viewer pages swept into the legacy catalog. The engine only
    renders self-contained mock HTML files with an embedded `questions` array,
    so these are dropped here rather than crashing parseMock at Start time. */
function isRenderableMock(m: MockEntry): boolean {
  const p = (m.path || '').toLowerCase();
  if (!p) return false;
  if (p.startsWith('pdf-reader.html') || p.includes('pdf-reader.html?')) return false;
  if (p.includes('?') || p.includes('#')) return false; // query/fragment → not a static mock
  if (p.endsWith('.pdf')) return false;
  return p.endsWith('.html');
}

/** One malformed catalog row shouldn't sink the whole catalog. */
function hasEntryShape(m: unknown): m is MockEntry {
  if (typeof m !== 'object' || m === null) return false;
  const r = m as Record<string, unknown>;
  return typeof r.path === 'string' && typeof r.name === 'string';
}

/**
 * Extract one top-level `const NAME = <JSON>;` from the generated catalog
 * WITHOUT executing it. The generator (generate_mocks_data.py) emits two such
 * blocks — `MOCK_DATA` (the catalog) and `MOCK_PATH_MAP` (old→new path map for
 * progress migration) — each as pure JSON. We slice from `NAME =` to the
 * closing `;` at end of that declaration and JSON.parse the result. Previously
 * this used `new Function(text)()` — eval-equivalent execution of a fetched
 * file with full page privileges.
 */
function extractConst(text: string, name: string): unknown {
  // Locate `const NAME =`, then bracket-match the JSON value from its opening
  // `[`/`{` to the balanced close, skipping string contents so brackets inside
  // question/answer HTML can't unbalance the count. This mirrors the
  // generator's own extract_by_bracket_match and is robust to pretty-printed
  // multi-line JSON, CRLF endings, and `;`/brackets inside string values.
  const decl = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*`).exec(text);
  if (!decl) return undefined;
  let i = decl.index + decl[0].length;
  const open = text[i];
  if (open !== '[' && open !== '{') return undefined;
  const closeFor = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr: string | null = null;
  let escaped = false;
  for (; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
    else if (ch === open) depth++;
    else if (ch === closeFor) {
      depth--;
      if (depth === 0) {
        const raw = text.slice(decl.index + decl[0].length, i + 1);
        try {
          return JSON.parse(raw);
        } catch (e) {
          throw new Error(
            `mocks-data.js is malformed (${name}): ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }
  }
  return undefined;
}

export async function loadMockCatalog(): Promise<MockEntry[]> {
  if (_cache) return _cache;
  if (_loading) return _loading;
  _loading = fetchMockCatalog();
  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

async function fetchMockCatalog(): Promise<MockEntry[]> {
  // 1. In live browser runtime, try dynamic backend REST API first
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
  const isVitest = !!(proc && (proc.env?.VITEST || proc.env?.NODE_ENV === 'test'));
  if (!isVitest && typeof window !== 'undefined') {
    try {
      const apiRes = await fetch('/api/catalog', { signal: AbortSignal.timeout(2500) });
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (Array.isArray(json) && json.length > 0) {
          _cache = json.filter(hasEntryShape).filter(isRenderableMock);
          if (_cache.length > 0) return _cache;
        }
      }
    } catch {
      // fallback to static mocks-data.js
    }
  }

  // 2. Fallback to static catalog (mocks-data.js)
  const res = await fetch('/mocks-data.js');
  if (!res.ok) throw new Error(`Failed to load mocks catalog (HTTP ${res.status})`);
  const text = await res.text();
  // A 200 HTML page here means the server fell back to an error/index page —
  // say so instead of surfacing a confusing JSON parse error.
  if (/^\s*(?:<!DOCTYPE|<html)/i.test(text)) {
    throw new Error(
      'Server returned an HTML page instead of the mocks catalog — mocks-data.js may be missing or not deployed.',
    );
  }
  const data = extractConst(text, 'MOCK_DATA');
  if (!Array.isArray(data)) {
    throw new Error('mocks-data.js did not contain a MOCK_DATA array.');
  }
  // Old→new path map emitted alongside the catalog when the generator renamed
  // files. Absent on older catalogs — treat as empty (nothing to migrate).
  const map = extractConst(text, 'MOCK_PATH_MAP');
  _pathMap =
    map && typeof map === 'object' && !Array.isArray(map)
      ? (map as Record<string, string>)
      : {};
  _cache = (data as unknown[]).filter(hasEntryShape).filter(isRenderableMock);
  return _cache;
}

/** Old → new launch-path map produced when the generator renamed mock files.
    Shares the cached /mocks-data.js fetch — no extra request. Resolves to {}
    when the catalog has no map (nothing to migrate). */
export async function loadPathMap(): Promise<Record<string, string>> {
  await loadMockCatalog(); // ensures the file was fetched + parsed
  return _pathMap;
}

export function providersOf(mocks: MockEntry[]): string[] {
  return [...new Set(mocks.map((m) => m.provider))].sort();
}

export function subjectsOf(mocks: MockEntry[]): string[] {
  return [...new Set(mocks.map((m) => m.subject))].sort();
}

export function topicsOf(mocks: MockEntry[]): string[] {
  return [...new Set(mocks.map((m) => m.topic).filter(Boolean) as string[])].sort();
}

export function subtopicsOf(mocks: MockEntry[]): string[] {
  return [...new Set(mocks.map((m) => m.subtopic).filter(Boolean) as string[])].sort();
}

export function categoriesOf(mocks: MockEntry[]): string[] {
  return [...new Set(mocks.map((m) => m.category))].sort();
}

export function groupBySubjectTopic(mocks: MockEntry[]): Map<string, Map<string, MockEntry[]>> {
  const bySubject = new Map<string, Map<string, MockEntry[]>>();
  mocks.forEach(m=>{
    const subj = m.subject || 'General';
    const topic = m.topic || m.category || 'General';
    let byTopic = bySubject.get(subj);
    if(!byTopic) bySubject.set(subj, byTopic = new Map());
    const list = byTopic.get(topic) || [];
    list.push(m);
    byTopic.set(topic, list);
  });
  return bySubject;
}

/** Resolve the friendly provider name for a mock path by consulting the
    cached catalog. Returns undefined when the catalog hasn't loaded yet
    or the path isn't in it. */
export async function getProviderForPath(path: string): Promise<string | undefined> {
  const catalog = await loadMockCatalog();
  const entry = catalog.find((m) => m.path === path);
  return entry?.provider;
}
