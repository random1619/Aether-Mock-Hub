import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveProviderParser } from '@/services/parsers/registry';
import { parseMock } from '@/services/mockParser';
import { canonicalGuard } from './providers/canonicalGuard';

/* ── Registry resolution: every provider folder maps to its adapter ── */
describe('resolveProviderParser', () => {
  it('resolves each provider folder to the right adapter id', () => {
    const cases: Array<[string, string]> = [
      ['providers/Mocks360/Advance Biology 360 Pro Level Mock I (Hindi).html', 'mocks360'],
      ['providers/EnglishMadhyam/backup/Chapter Wise PYQS/Paid Antonym - Part (i) (SSC CGL 2018).html', 'englishmadhyam'],
      ['providers/StaticGK/STATIC GK SSC (23).html', 'staticgk'],
      ['providers/Oliveboard/Advanced GK current affairs/Advanced_Banking_GK_Apr_2026_Test_204.html', 'oliveboard'],
      ['providers/Pundits/2nd part/2025 Pre/SSC_CGL_2025_Pre_Eduquity_Mock_01.html', 'pundits'],
      ['providers/TheSolver/English/@the_solvers_SSC CGL T-I English Section Test 01.html', 'thesolver'],
      ['providers/Random Mocks/A Word Previous Years Antonyms.html (1).html', 'randommocks'],
    ];
    for (const [path, id] of cases) {
      expect(resolveProviderParser(path)?.id, path).toBe(id);
    }
  });

  it('returns null for a path with no registered provider', () => {
    expect(resolveProviderParser('providers/UnknownVendor/x.html')).toBeNull();
  });
});

/* ── EnglishMadhyam: the only adapter that changes scores ── */
describe('englishMadhyam adapter (via parseMock)', () => {
  let seq = 0;
  const path = () => `providers/EnglishMadhyam/em-${++seq}.html`;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function serve(questions: unknown[]) {
    const body = `<!DOCTYPE html><html><head><title>EM</title></head><body>
<script>
const questions = ${JSON.stringify(questions)};
</script></body></html>`;
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
  }

  const emQuestions = [
    {
      question: '<strong>Antonym of</strong> TRANSIENT',
      comp: '',
      options: ['1) stationary', '2) temporal', '3) celestial', '4) permanent'],
      correct_option_id: 4, // 1-based "D" → 0-based index 3
      solution: 'D) TRANSIENT – lasting a short time',
    },
    {
      question: 'Synonym of CANDID',
      comp: '',
      options: ['1) frank', '2) secretive', '3) sly', '4) rude'],
      correct_option_id: 1, // 1-based "A" → 0-based index 0
      solution: 'A) CANDID – frank',
    },
  ];

  it('rebases 1-based answer keys to 0-based', async () => {
    serve(emQuestions);
    const { questions } = await parseMock(path());
    expect(questions[0].correct_option_id).toBe(3);
    expect(questions[1].correct_option_id).toBe(0);
  });

  it('strips the baked-in "N) " option ordinals', async () => {
    serve(emQuestions);
    const { questions } = await parseMock(path());
    expect(questions[0].options).toEqual(['stationary', 'temporal', 'celestial', 'permanent']);
  });

  it('leaves an already-0-based mock untouched', async () => {
    serve([
      { question: 'Q', comp: '', options: ['a', 'b', 'c', 'd'], correct_option_id: 0, solution: '' },
      { question: 'Q2', comp: '', options: ['a', 'b', 'c', 'd'], correct_option_id: 2, solution: '' },
    ]);
    const { questions, warnings } = await parseMock(path());
    expect(questions[0].correct_option_id).toBe(0);
    expect(questions[1].correct_option_id).toBe(2);
    expect(warnings.some((w) => w.includes('rebased'))).toBe(false);
  });
});

/* ── StaticGK: strip embedded stem numbering ── */
describe('staticGk adapter (via parseMock)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('removes a leading "N." ordinal from the stem', async () => {
    const body = `<!DOCTYPE html><html><head><title>SGK</title></head><body>
<script>
const questions = ${JSON.stringify([
  {
    question: '<p>1.<span> The ancient harvest festival of Baisakhi?</span></p>',
    options: ['November', 'April', 'August', 'January'],
    correct_option_id: 1,
    solution: 'April',
  },
])};
</script></body></html>`;
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    const { questions } = await parseMock('providers/StaticGK/sgk-test.html');
    expect(questions[0].question.replace(/<[^>]*>/g, '')).not.toMatch(/^\s*1\s*\./);
    expect(questions[0].correct_option_id).toBe(1);
  });
});

/* ── CanonicalGuard: zero-options and expectedOptions invariants ── */
describe('canonicalGuard', () => {
  it('flags zero options as "has no options" instead of misleading "out of range"', () => {
    const guard = canonicalGuard({ id: 'test', folder: 'Test' });
    const warnings: string[] = [];
    const q = {
      question: 'Q?',
      options: [] as string[],
      correct_option_id: 0,
      marks: 2,
    };
    guard.postProcess!([q], warnings);
    expect(warnings.some((w) => w.includes('has no options'))).toBe(true);
    expect(warnings.some((w) => w.includes('out of range'))).toBe(false);
  });

  it('still flags a truly out-of-range key when options exist', () => {
    const guard = canonicalGuard({ id: 'test', folder: 'Test' });
    const warnings: string[] = [];
    const q = {
      question: 'Q?',
      options: ['A', 'B'],
      correct_option_id: 5,
      marks: 2,
    };
    guard.postProcess!([q], warnings);
    expect(warnings.some((w) => w.includes('out of range (2 options)'))).toBe(true);
  });

  it('does not flag correct keys with valid options', () => {
    const guard = canonicalGuard({ id: 'test', folder: 'Test' });
    const warnings: string[] = [];
    const q = {
      question: 'Q?',
      options: ['A', 'B', 'C', 'D'],
      correct_option_id: 2,
      marks: 2,
    };
    guard.postProcess!([q], warnings);
    expect(warnings).toHaveLength(0);
  });

  it('does not warn on 5 option mocks when expectedOptions is not set', () => {
    // Oliveboard Advanced GK mocks have 5 options — the guard must NOT flag
    // them since expectedOptions was removed for Oliveboard.
    const guard = canonicalGuard({ id: 'oliveboard', folder: 'Oliveboard' });
    const warnings: string[] = [];
    const qs = Array.from({ length: 30 }, () => ({
      question: 'Q?',
      options: ['A', 'B', 'C', 'D', 'E'],
      correct_option_id: 2,
      marks: 2,
    }));
    guard.postProcess!(qs, warnings);
    expect(warnings.some((w) => w.includes('deviate from expected'))).toBe(false);
  });

  it('warns on option count deviation when expectedOptions IS set', () => {
    const guard = canonicalGuard({ id: 'vendor', folder: 'Vendor', expectedOptions: 4 });
    const warnings: string[] = [];
    const qs = [
      { question: 'Q?', options: ['A', 'B', 'C', 'D', 'E'], correct_option_id: 0, marks: 2 },
    ];
    guard.postProcess!(qs, warnings);
    expect(warnings.some((w) => w.includes('deviate from expected 4 options'))).toBe(true);
  });

  it('flags empty question stems', () => {
    const guard = canonicalGuard({ id: 'test', folder: 'Test' });
    const warnings: string[] = [];
    const q = {
      question: '   ',
      options: ['A', 'B'],
      correct_option_id: 0,
      marks: 2,
    };
    guard.postProcess!([q], warnings);
    expect(warnings.some((w) => w.includes('empty stem'))).toBe(true);
  });
});
