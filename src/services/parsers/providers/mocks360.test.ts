import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Question } from '@/types';
import { mocks360Parser } from './mocks360';
import { resolveProviderParser } from '../registry';
import { parseMock } from '@/services/mockParser';

/* ── helpers ── */
const makeQ = (overrides: Partial<Question> = {}): Question => ({
  question: '<p>Stem with A) … D) … codes inside</p>',
  options: ['<p>A</p>', '<p>B</p>', '<p>C</p>', '<p>D</p>'],
  correct_option_id: 0,
  ...overrides,
});

/* REGISTRY */
describe('registry', () => {
  it('resolves Mocks360 paths to the mocks360 adapter', () => {
    expect(resolveProviderParser('providers/Mocks360/Advance Biology 360 Pro Level Mock I (Hindi).html')?.id).toBe('mocks360');
  });
  it('matches case-insensitively and with a leading slash', () => {
    expect(resolveProviderParser('/providers/mocks360/x.html')?.id).toBe('mocks360');
  });
  it('routes other providers to their own adapters, not mocks360', () => {
    expect(resolveProviderParser('providers/Oliveboard/Test_204.html')?.id).toBe('oliveboard');
    expect(resolveProviderParser('providers/EnglishMadhyam/x.html')?.id).toBe('englishmadhyam');
  });
  it('returns null for an unregistered provider', () => {
    expect(resolveProviderParser('providers/UnknownVendor/x.html')).toBeNull();
  });
});

/* MOCKS360 ADAPTER — letter-option normalization */
describe('mocks360 postProcess', () => {
  it('unshuffles letter options and remaps the key via the displayed letter', () => {
    const warnings: string[] = [];
    // Vendor shuffle: slot0 shows "D", slot1 "A", slot2 "C", slot3 "B"; key 0 → letter D.
    const q = makeQ({ options: ['<p>D</p>', '<p>A</p>', '<p>C</p>', '<p>B</p>'], correct_option_id: 0 });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out.options.map((o) => o.replace(/<[^>]*>/g, ''))).toEqual(['A', 'B', 'C', 'D']);
    expect(out.correct_option_id).toBe(3); // D
    expect(warnings.some((w) => w.includes('0 → 3'))).toBe(true);
  });

  it('repairs keys authored pre-shuffle using the solution letter', () => {
    const warnings: string[] = [];
    // Key points at slot 1 (letter A) but the solution says the answer is C.
    const q = makeQ({
      options: ['<p>D</p>', '<p>A</p>', '<p>C</p>', '<p>B</p>'],
      correct_option_id: 1,
      solution: '<p>Answer (उत्तर): C • explanation…</p>',
    });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out.correct_option_id).toBe(2); // C
    expect(warnings.some((w) => w.includes('repaired via solution'))).toBe(true);
  });

  it('reads Hindi solution letters ("उत्तर: (b)")', () => {
    const warnings: string[] = [];
    const q = makeQ({
      options: ['<p>A</p>', '<p>B</p>', '<p>C</p>', '<p>D</p>'],
      correct_option_id: 3,
      solution: '<p>उत्तर: (b) क्योंकि…</p>',
    });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out.correct_option_id).toBe(1); // B
  });

  it('leaves already-consistent letter options untouched (no warning)', () => {
    const warnings: string[] = [];
    const q = makeQ({ correct_option_id: 2 });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out).toBe(q);
    expect(warnings).toHaveLength(0);
  });

  it('does not touch questions with real option content', () => {
    const warnings: string[] = [];
    const q = makeQ({ options: ['<p>Only 1</p>', '<p>Only 2</p>', '<p>Only 3</p>', '<p>All</p>'], correct_option_id: 1 });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out).toBe(q);
    expect(warnings).toHaveLength(0);
  });

  it('does not touch questions with fewer than 4 options', () => {
    const warnings: string[] = [];
    const q = makeQ({ options: ['<p>A</p>', '<p>B</p>'], correct_option_id: 0 });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out).toBe(q);
  });

  it('leaves duplicated letter options unchanged with a warning (["D","A","C","A"])', () => {
    const warnings: string[] = [];
    // Two options claim "A" — no unique A–D permutation exists, so the correct
    // order is unknowable. Previously this sorted to A,A,C,D and remapped the
    // key to the wrong slot, silently corrupting the answer.
    const q = makeQ({ options: ['<p>D</p>', '<p>A</p>', '<p>C</p>', '<p>A</p>'], correct_option_id: 3 });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out).toBe(q); // untouched
    expect(warnings.some((w) => w.includes('not a unique A–D set'))).toBe(true);
  });

  it('leaves duplicated letters unchanged even with an empty solution (["C","B","D","B"])', () => {
    const warnings: string[] = [];
    const q = makeQ({ options: ['<p>C</p>', '<p>B</p>', '<p>D</p>', '<p>B</p>'], correct_option_id: 0, solution: '' });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out).toBe(q);
    expect(warnings.some((w) => w.includes('not a unique A–D set'))).toBe(true);
  });

  it('leaves an out-of-range "E" option question unchanged', () => {
    const warnings: string[] = [];
    // A match-the-following with a genuine 5th label. "E" is not a valid A–D
    // placeholder, so the question is skipped without the unique-set warning.
    const q = makeQ({ options: ['<p>A</p>', '<p>B</p>', '<p>C</p>', '<p>E</p>'], correct_option_id: 3 });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out).toBe(q);
  });

  it('keeps question count stable', () => {
    const warnings: string[] = [];
    const qs = [makeQ(), makeQ({ options: ['<p>B</p>', '<p>A</p>', '<p>C</p>', '<p>D</p>'], correct_option_id: 0 })];
    expect(mocks360Parser.postProcess!(qs, warnings)).toHaveLength(2);
  });
});

/* MOCKS360 ADAPTER — ChatGPT-export residue stripping (sanitizeHtml hook) */
describe('mocks360 residue stripping', () => {
  const clean = mocks360Parser.sanitizeHtml!;

  it('strips data-start / data-end / data-col-size attributes', () => {
    const dirty = '<p data-start="10" data-end="42" data-col-size="sm">12,99,000 km&sup2;</p>';
    expect(clean(dirty)).toBe('<p>12,99,000 km&sup2;</p>');
  });

  it('is idempotent and leaves clean HTML untouched', () => {
    const already = '<p>Plain stem</p>';
    expect(clean(already)).toBe(already);
    expect(clean(clean(already))).toBe(already);
  });

  it('does not touch other data-* attributes or real content', () => {
    const keep = '<p data-path-to-node="5" data-index-in-node="0">NITI Aayog</p>';
    expect(clean(keep)).toBe(keep);
  });

  it('word-boundaries the names so a data-startx attribute survives', () => {
    const keep = '<td data-startx="1">Jital</td>';
    expect(clean(keep)).toBe(keep);
  });

  it('handles single-quoted-free / uppercase residue', () => {
    expect(clean('<span DATA-START="1">x</span>')).toBe('<span>x</span>');
  });
});

/* MOCKS360 ADAPTER — validation guard */
describe('mocks360 validation guard', () => {
  it('flags an empty stem', () => {
    const warnings: string[] = [];
    mocks360Parser.postProcess!([makeQ({ question: '<p></p>' })], warnings);
    expect(warnings.some((w) => w.includes('empty stem'))).toBe(true);
  });

  it('flags a wrong option count', () => {
    const warnings: string[] = [];
    mocks360Parser.postProcess!([makeQ({ options: ['<p>A</p>', '<p>B</p>', '<p>C</p>'] })], warnings);
    expect(warnings.some((w) => w.includes('3 options'))).toBe(true);
  });

  it('flags an empty option', () => {
    const warnings: string[] = [];
    mocks360Parser.postProcess!([makeQ({ options: ['<p>1</p>', '<p></p>', '<p>3</p>', '<p>4</p>'] })], warnings);
    expect(warnings.some((w) => w.includes('option 2 is empty'))).toBe(true);
  });

  it('flags an out-of-range key', () => {
    const warnings: string[] = [];
    mocks360Parser.postProcess!([makeQ({ correct_option_id: 7 })], warnings);
    expect(warnings.some((w) => w.includes('out of range'))).toBe(true);
  });

  it('emits a summary line when there are violations, none when clean', () => {
    const dirty: string[] = [];
    mocks360Parser.postProcess!([makeQ({ question: '' })], dirty);
    expect(dirty.some((w) => w.includes('contract violations'))).toBe(true);

    const clean: string[] = [];
    mocks360Parser.postProcess!([makeQ()], clean);
    expect(clean.some((w) => w.includes('contract violations'))).toBe(false);
  });

  it('does not mutate the questions while validating', () => {
    const warnings: string[] = [];
    const q = makeQ({ correct_option_id: 9 });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out.correct_option_id).toBe(9); // guard records, never "fixes"
  });
});

/* MOCKS360 ADAPTER — bilingual eqt/hqt tagging */
describe('mocks360 bilingual tagging', () => {
  it('wraps Hindi and English runs in eqt/hqt spans', () => {
    const warnings: string[] = [];
    const q = makeQ({
      question: '<p>भारत में पंचवर्षीय योजनाओं पर विचार कीजिए<br>Consider the Five Year Plans in India</p>',
    });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out.question).toContain('class="hqt"');
    expect(out.question).toContain('class="eqt"');
    expect(out.question).toContain('पंचवर्षीय');
    expect(out.question).toContain('Consider the Five Year Plans');
  });

  it('tags the solution too, not just the stem', () => {
    const warnings: string[] = [];
    const q = makeQ({
      question: '<p>केवल अंग्रेजी</p>',
      solution: '<p>उत्तर सही है<br>The answer is correct</p>',
    });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out.solution).toContain('class="hqt"');
    expect(out.solution).toContain('class="eqt"');
  });

  it('leaves a single-language question by reference (no re-render churn)', () => {
    const warnings: string[] = [];
    const q = makeQ({ question: '<p>Pure English stem, no Hindi.</p>' });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    expect(out).toBe(q);
  });

  it('still unshuffles letter options while tagging bilingual stems', () => {
    const warnings: string[] = [];
    const q = makeQ({
      question: '<p>कथन A<br>Statement A</p>',
      options: ['<p>D</p>', '<p>A</p>', '<p>C</p>', '<p>B</p>'],
      correct_option_id: 0,
    });
    const [out] = mocks360Parser.postProcess!([q], warnings);
    // Letter repair ran…
    expect(out.options.map((o) => o.replace(/<[^>]*>/g, ''))).toEqual(['A', 'B', 'C', 'D']);
    expect(out.correct_option_id).toBe(3);
    // …AND the stem got tagged.
    expect(out.question).toContain('class="hqt"');
  });
});

/* END-TO-END — parseMock applies the adapter for Mocks360 paths */
describe('parseMock wiring', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unshuffles letter options when parsing a Mocks360 file', async () => {
    const raw = [{
      question: '<p>Stem A) 1 only B) 2 only C) 3 only D) All</p>',
      options: ['<p>D</p>', '<p>A</p>', '<p>C</p>', '<p>B</p>'],
      correct_option_id: 0,
      marks: 2,
    }];
    const html = `<!DOCTYPE html><html><head><title>360</title></head><body><script>const questions = ${JSON.stringify(raw)};</script></body></html>`;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    const { questions, warnings } = await parseMock('providers/Mocks360/e2e-unshuffle-test.html', '360');
    expect(questions[0].options.map((o) => o.replace(/<[^>]*>/g, '').trim())).toEqual(['A', 'B', 'C', 'D']);
    expect(questions[0].correct_option_id).toBe(3);
    expect(warnings.some((w) => w.includes('Mocks360'))).toBe(true);
  });

  it('strips ChatGPT residue through the full parseMock pipeline (sanitizeHtml hook)', async () => {
    const raw = [{
      question: '<p data-start="10" data-end="42">Area is 12,99,000 km&sup2;</p>',
      options: ['<p data-start="0" data-end="1">A</p>', '<p>B</p>', '<p>C</p>', '<p>D</p>'],
      correct_option_id: 0,
      solution: '<p data-col-size="sm">Answer (उत्तर): A — correct</p>',
      marks: 2,
    }];
    const html = `<!DOCTYPE html><html><body><script>const questions = ${JSON.stringify(raw)};</script></body></html>`;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    const { questions } = await parseMock('providers/Mocks360/e2e-residue-test.html', '360');
    expect(questions[0].question).not.toContain('data-start');
    expect(questions[0].question).not.toContain('data-end');
    expect(questions[0].solution ?? '').not.toContain('data-col-size');
    // …while real content (the number, the entity) survives intact.
    expect(questions[0].question).toContain('12,99,000');
  });

  it('does not normalize non-Mocks360 paths', async () => {
    const raw = [{
      question: '<p>Q</p>',
      options: ['<p>D</p>', '<p>A</p>', '<p>C</p>', '<p>B</p>'],
      correct_option_id: 0,
    }];
    const html = `<!DOCTYPE html><html><body><script>const questions = ${JSON.stringify(raw)};</script></body></html>`;
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    const { questions } = await parseMock('providers/Other/e2e-no-normalize-test.html', 'Other');
    expect(questions[0].options).toEqual(['<p>D</p>', '<p>A</p>', '<p>C</p>', '<p>B</p>']);
    expect(questions[0].correct_option_id).toBe(0);
  });
});
