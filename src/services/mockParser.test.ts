import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseMock, extractQuestionCount } from '@/services/mockParser';

/* parseMock caches per path — use unique paths per test to stay isolated. */
let seq = 0;
function nextPath() {
  return `providers/Test/mock-${++seq}.html`;
}

function htmlResponse(body: string, init: ResponseInit = { status: 200 }) {
  return new Response(body, { ...init, headers: { 'Content-Type': 'text/html' } });
}

function mockHtml(questions: unknown[], extra = ''): string {
  return `<!DOCTYPE html><html><head><title>Test Mock</title></head><body>
<script>
const questions = ${JSON.stringify(questions)};
</script>${extra}</body></html>`;
}

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question: 'Capital of France?',
    options: ['London', 'Paris', 'Rome', 'Berlin'],
    correct_option_id: 1,
    marks: 2,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  (fetch as ReturnType<typeof vi.fn>).mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    return Promise.resolve(handler(url));
  });
}

describe('happy path', () => {
  it('fetches from site root with the path URI-encoded', async () => {
    stubFetch(() => htmlResponse(mockHtml([makeQuestion()])));
    await parseMock('providers/Test Dir/a b.html');
    expect(fetch).toHaveBeenCalledWith(
      '/providers/Test%20Dir/a%20b.html',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('parses questions, title, duration, sections', async () => {
    stubFetch(() =>
      htmlResponse(
        `<html><head><title>My Mock</title><meta name="exam-duration" content="90"></head>
         <body><script>const questions = ${JSON.stringify([
           makeQuestion({ section: 'Math' }),
           makeQuestion({ section: 'Math' }),
           makeQuestion({ section: 'English' }),
         ])};</script></body></html>`,
      ),
    );
    const r = await parseMock(nextPath());
    expect(r.meta.name).toBe('My Mock');
    expect(r.meta.durationMinutes).toBe(90);
    expect(r.questions).toHaveLength(3);
    expect(r.meta.sections).toEqual([
      { name: 'Math', start: 0, end: 1 },
      { name: 'English', start: 2, end: 2 },
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('reads the duration meta with attributes in either order', async () => {
    stubFetch(() =>
      htmlResponse(
        `<html><head><meta content="45" name="exam-duration"></head>
         <body><script>const questions = ${JSON.stringify([makeQuestion()])};</script></body></html>`,
      ),
    );
    const r = await parseMock(nextPath());
    expect(r.meta.durationMinutes).toBe(45);
  });

  it('defaults duration to 60 when meta is absent or non-numeric', async () => {
    stubFetch(() => htmlResponse(mockHtml([makeQuestion()])));
    expect((await parseMock(nextPath())).meta.durationMinutes).toBe(60);
  });

  it('uses displayName over <title>', async () => {
    stubFetch(() => htmlResponse(mockHtml([makeQuestion()])));
    const r = await parseMock(nextPath(), 'Pretty Name');
    expect(r.meta.name).toBe('Pretty Name');
  });
});

describe('question content extraction', () => {
  it('survives `]</script>` inside question HTML content (greedy regex)', async () => {
    const tricky = makeQuestion({
      question: 'Which is correct? ]</script> — pick one',
      options: ['a] </script> b', 'c', 'd', 'e'],
    });
    stubFetch(() => htmlResponse(mockHtml([tricky, makeQuestion()])));
    const r = await parseMock(nextPath());
    expect(r.questions).toHaveLength(2);
    expect(r.questions[0].question).toContain('pick one');
  });

  it('tolerates trailing commas in the embedded JSON', async () => {
    stubFetch(() =>
      htmlResponse(
        `<html><head><title>T</title></head><body><script>
const questions = [ { "question": "Q?", "options": ["a","b"], "correct_option_id": 0, }, ];
</script></body></html>`,
      ),
    );
    const r = await parseMock(nextPath());
    expect(r.questions).toHaveLength(1);
    expect(r.questions[0].correct_option_id).toBe(0);
  });

  it('throws a descriptive error for unparseable JSON (not a raw SyntaxError)', async () => {
    stubFetch(() =>
      htmlResponse(
        `<html><head><title>T</title></head><body><script>
const questions = [ { broken json here } ];
</script></body></html>`,
      ),
    );
    await expect(parseMock(nextPath())).rejects.toThrow(/Could not parse questions JSON/);
  });
});

describe('error classification', () => {
  it('HTTP errors surface the status code', async () => {
    stubFetch(() => htmlResponse('Not Found', { status: 404 }));
    await expect(parseMock(nextPath())).rejects.toThrow(/404/);
  });

  it('an HTML shell page (SPA fallback) says the mock is missing — not "no questions array"', async () => {
    stubFetch(() => htmlResponse('<!DOCTYPE html><html><head><title>App</title></head><body><div id="root"></div></body></html>'));
    await expect(parseMock(nextPath())).rejects.toThrow(/returned a page, not a mock file/);
  });

  it('an empty questions array is rejected', async () => {
    stubFetch(() => htmlResponse(mockHtml([])));
    await expect(parseMock(nextPath())).rejects.toThrow(/empty questions array/);
  });

  it('times out after 15s on a hung connection', async () => {
    vi.useFakeTimers();
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );
    const promise = parseMock(nextPath());
    const assertion = expect(promise).rejects.toThrow(/Timed out/);
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });
});

describe('correct_option_id validation', () => {
  it('warns and defaults to option A when the key is missing', async () => {
    const { correct_option_id: _drop, ...noKey } = makeQuestion();
    stubFetch(() => htmlResponse(mockHtml([noKey])));
    const r = await parseMock(nextPath());
    expect(r.questions[0].correct_option_id).toBe(0);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/Q1.*missing correct_option_id/);
  });

  it('warns and clamps out-of-range keys', async () => {
    stubFetch(() => htmlResponse(mockHtml([makeQuestion({ correct_option_id: 9 })])));
    const r = await parseMock(nextPath());
    expect(r.questions[0].correct_option_id).toBe(0);
    expect(r.warnings[0]).toMatch(/out of range/);
  });

  it('warns on non-numeric keys and on negative keys', async () => {
    stubFetch(() =>
      htmlResponse(mockHtml([makeQuestion({ correct_option_id: 'two' }), makeQuestion({ correct_option_id: -1 })])),
    );
    const r = await parseMock(nextPath());
    expect(r.warnings).toHaveLength(2);
    expect(r.questions[0].correct_option_id).toBe(0);
    expect(r.questions[1].correct_option_id).toBe(0);
  });

  it('accepts numeric strings without warning', async () => {
    stubFetch(() => htmlResponse(mockHtml([makeQuestion({ correct_option_id: '2' })])));
    const r = await parseMock(nextPath());
    expect(r.questions[0].correct_option_id).toBe(2);
    expect(r.warnings).toEqual([]);
  });
});

describe('section derivation', () => {
  it('merges non-contiguous same-name sections into an envelope (A,B,A → 2 sections)', async () => {
    stubFetch(() =>
      htmlResponse(
        mockHtml([
          makeQuestion({ section: 'Math' }),
          makeQuestion({ section: 'English' }),
          makeQuestion({ section: 'Math' }),
        ]),
      ),
    );
    const r = await parseMock(nextPath());
    expect(r.meta.sections).toHaveLength(2);
    expect(r.meta.sections[0]).toEqual({ name: 'Math', start: 0, end: 2 });
    expect(r.meta.sections[1]).toEqual({ name: 'English', start: 1, end: 1 });
  });

  it('groups untitled questions under "General"', async () => {
    stubFetch(() => htmlResponse(mockHtml([makeQuestion(), makeQuestion({ section: '  ' })])));
    const r = await parseMock(nextPath());
    expect(r.meta.sections).toEqual([{ name: 'General', start: 0, end: 1 }]);
  });
});

describe('normalization', () => {
  it('falls back from `question` to `text`, defaults marks to 2, sanitizes HTML', async () => {
    stubFetch(() =>
      htmlResponse(
        mockHtml([
          {
            text: '<b>Bold?</b><script>alert(1)</script>',
            options: ['<i>x</i>'],
            correct_option_id: 0,
          },
        ]),
      ),
    );
    const r = await parseMock(nextPath());
    expect(r.questions[0].question).toContain('<b>Bold?</b>');
    expect(r.questions[0].question).not.toContain('script');
    expect(r.questions[0].marks).toBe(2);
  });

  it('falls through to base stem when bilingual enQ is an empty string', async () => {
    // Simulate a bilingual mock where qEn is "" (common hand-edited artifact)
    // but q (Hindi/base) has the real stem. Previously useEn was true for
    // empty-string enQ, producing a blank stem + English options hybrid.
    stubFetch(() =>
      htmlResponse(
        mockHtml([
          {
            qEn: '',
            optsEn: ['Paris', 'London', 'Rome', 'Berlin'],
            q: 'फ्रांस की राजधानी क्या है?',
            opts: ['पेरिस', 'लंदन', 'रोम', 'बर्लिन'],
            correct_option_id: 0,
          },
        ]),
      ),
    );
    const r = await parseMock(nextPath());
    expect(r.questions[0].question).toContain('फ्रांस');
    expect(r.questions[0].options).toEqual(['Paris', 'London', 'Rome', 'Berlin']);
  });

  it('falls through to base solution when bilingual enSol is empty', async () => {
    stubFetch(() =>
      htmlResponse(
        mockHtml([
          {
            qEn: 'Capital of France?',
            optsEn: ['Paris', 'London', 'Rome', 'Berlin'],
            solEn: '',
            solution: 'पेरिस फ्रांस की राजधानी है',
            correct_option_id: 0,
          },
        ]),
      ),
    );
    const r = await parseMock(nextPath());
    expect(r.questions[0].solution).toContain('राजधानी');
  });
});

describe('extractQuestionCount', () => {
  it('returns the array length for valid mocks and 0 for garbage', () => {
    expect(extractQuestionCount(mockHtml([makeQuestion(), makeQuestion()]))).toBe(2);
    expect(extractQuestionCount('<html>nothing here</html>')).toBe(0);
    expect(extractQuestionCount(mockHtml([]))).toBe(0);
  });
});
