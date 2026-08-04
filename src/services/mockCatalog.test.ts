import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* mockCatalog keeps a module-level _cache — reset modules between tests. */
beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const load = () => import('@/services/mockCatalog');

function catalogResponse(entries: unknown): Response {
  return new Response(`const MOCK_DATA = ${JSON.stringify(entries)};`, { status: 200 });
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    path: 'providers/X/mock.html',
    name: 'Mock 1',
    provider: 'X',
    category: 'Full',
    subject: 'GK',
    ...overrides,
  };
}

function stubFetch(response: Response | Promise<Response>) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(response);
}

describe('JSON extraction (no eval)', () => {
  it('parses a generated catalog without executing it', async () => {
    stubFetch(catalogResponse([entry(), entry({ path: 'providers/Y/b.html', name: 'B' })]));
    const { loadMockCatalog } = await load();
    const mocks = await loadMockCatalog();
    expect(mocks).toHaveLength(2);
    expect(mocks[0].name).toBe('Mock 1');
  });

  it('does not execute side-effect code in the file', async () => {
    // A payload that would only take effect if actually executed as JS.
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response('const MOCK_DATA = [{"path":"a.html","name":"A"}]; globalThis.__pwned = true;', {
        status: 200,
      }),
    );
    const { loadMockCatalog } = await load();
    // Bracket-matching parses the valid array and ignores the trailing junk —
    // crucially WITHOUT executing it.
    await expect(loadMockCatalog()).resolves.toHaveLength(1);
    expect((globalThis as Record<string, unknown>).__pwned).toBeUndefined();
  });

  it('tolerates whitespace and let/var declarations', async () => {
    stubFetch(new Response('  let MOCK_DATA = [{"path":"a.html","name":"A"}] ;', { status: 200 }));
    const { loadMockCatalog } = await load();
    await expect(loadMockCatalog()).resolves.toHaveLength(1);
  });

  it('tolerates leading single-line and multi-line JS comments', async () => {
    stubFetch(
      new Response(
        '// Generated Mock Data\n/* Header comment */\nconst MOCK_DATA = [{"path":"a.html","name":"A"}];',
        { status: 200 },
      ),
    );
    const { loadMockCatalog } = await load();
    await expect(loadMockCatalog()).resolves.toHaveLength(1);
  });
});

describe('filtering', () => {
  it('drops non-renderable entries (pdf-reader, query strings, pdfs, non-html)', async () => {
    stubFetch(
      catalogResponse([
        entry(),
        entry({ path: 'pdf-reader.html?file=x.pdf', name: 'PDF' }),
        entry({ path: 'providers/X/y.html?foo=1', name: 'Query' }),
        entry({ path: 'providers/X/doc.pdf', name: 'PdfFile' }),
        entry({ path: 'providers/X/page.php', name: 'NotHtml' }),
      ]),
    );
    const { loadMockCatalog } = await load();
    const mocks = await loadMockCatalog();
    expect(mocks).toHaveLength(1);
    expect(mocks[0].name).toBe('Mock 1');
  });

  it('drops entries missing path/name instead of crashing', async () => {
    stubFetch(catalogResponse([entry(), { provider: 'X' }, null, 42, { path: 5, name: 'Bad' }]));
    const { loadMockCatalog } = await load();
    await expect(loadMockCatalog()).resolves.toHaveLength(1);
  });
});

describe('error handling', () => {
  it('throws with the HTTP status when the catalog request fails', async () => {
    stubFetch(new Response('nope', { status: 503 }));
    const { loadMockCatalog } = await load();
    await expect(loadMockCatalog()).rejects.toThrow(/503/);
  });

  it('detects an HTML error page returned with 200', async () => {
    stubFetch(new Response('<!DOCTYPE html><html><body>Oops</body></html>', { status: 200 }));
    const { loadMockCatalog } = await load();
    await expect(loadMockCatalog()).rejects.toThrow(/HTML page instead of the mocks catalog/);
  });

  it('throws when MOCK_DATA is not an array (never silently returns [])', async () => {
    stubFetch(new Response('const MOCK_DATA = {"oops": true};', { status: 200 }));
    const { loadMockCatalog } = await load();
    await expect(loadMockCatalog()).rejects.toThrow(/did not contain a MOCK_DATA array/);
  });

  it('throws a clear error for malformed JSON payloads', async () => {
    stubFetch(new Response('const MOCK_DATA = [{broken}];', { status: 200 }));
    const { loadMockCatalog } = await load();
    await expect(loadMockCatalog()).rejects.toThrow(/malformed/);
  });

  it('shares one network request across concurrent callers', async () => {
    // Delay the response so concurrent calls would overlap if not deduped.
    let resolveResponse: (v: Response) => void;
    const responsePromise = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    stubFetch(responsePromise);
    const { loadMockCatalog } = await load();
    // Fire two calls concurrently — they must share one fetch.
    const p1 = loadMockCatalog();
    const p2 = loadMockCatalog();
    resolveResponse!(catalogResponse([entry(), entry({ path: 'providers/Y/b.html', name: 'B' })]));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(r2); // same array reference — served from the same Promise
    expect(r1).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('MOCK_PATH_MAP extraction', () => {
  const withMap = (entries: unknown, map: unknown) =>
    new Response(
      `const MOCK_DATA = ${JSON.stringify(entries)};\n\nconst MOCK_PATH_MAP = ${JSON.stringify(map)};\n`,
      { status: 200 },
    );

  it('parses the old→new path map emitted alongside the catalog', async () => {
    stubFetch(withMap([entry()], { 'providers/X/old.html': 'providers/X/new.html' }));
    const { loadPathMap } = await load();
    const map = await loadPathMap();
    expect(map).toEqual({ 'providers/X/old.html': 'providers/X/new.html' });
  });

  it('returns {} when the catalog has no MOCK_PATH_MAP', async () => {
    stubFetch(catalogResponse([entry()]));
    const { loadPathMap } = await load();
    await expect(loadPathMap()).resolves.toEqual({});
  });

  it('handles pretty-printed multi-line JSON with CRLF and brackets inside strings', async () => {
    const body =
      '// Generated Mock Data\r\n' +
      'const MOCK_DATA = [\r\n  { "path": "a.html", "name": "A; [not a bracket]" }\r\n];\r\n\r\n' +
      '// comment\r\nconst MOCK_PATH_MAP = {\r\n  "a.html": "b.html"\r\n};\r\n';
    stubFetch(new Response(body, { status: 200 }));
    const { loadMockCatalog, loadPathMap } = await load();
    await expect(loadMockCatalog()).resolves.toHaveLength(1);
    await expect(loadPathMap()).resolves.toEqual({ 'a.html': 'b.html' });
  });

  it('shares the single catalog fetch between catalog and map readers', async () => {
    stubFetch(withMap([entry()], { 'a.html': 'b.html' }));
    const { loadMockCatalog, loadPathMap } = await load();
    await Promise.all([loadMockCatalog(), loadPathMap()]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('helpers', () => {
  it('providersOf/subjectsOf/categoriesOf return sorted unique values', async () => {
    const { providersOf, subjectsOf, categoriesOf } = await load();
    const mocks = [
      entry({ provider: 'B', subject: 'GK', category: 'Full' }),
      entry({ provider: 'A', subject: 'Math', category: 'Sectional' }),
      entry({ provider: 'B', subject: 'GK', category: 'Full' }),
    ];
    expect(providersOf(mocks)).toEqual(['A', 'B']);
    expect(subjectsOf(mocks)).toEqual(['GK', 'Math']);
    expect(categoriesOf(mocks)).toEqual(['Full', 'Sectional']);
  });
});
