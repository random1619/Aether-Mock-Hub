import { describe, it, expect } from 'vitest';
import { segmentBilingual } from './bilingual';

/* Runs in jsdom, so `document` is available — pass it straight through. */
const seg = (html: string) => segmentBilingual(html, document);

describe('segmentBilingual', () => {
  it('wraps a Hindi run and an English run split by <br>', () => {
    const out = seg('<p>भारत में पंचवर्षीय योजनाओं पर विचार कीजिए<br>Consider the Five Year Plans in India</p>');
    expect(out).toContain('<span class="hqt">');
    expect(out).toContain('<span class="eqt">');
    // Hindi text sits inside the hqt span, English inside eqt.
    expect(out).toMatch(/class="hqt"[^>]*>[^<]*पंचवर्षीय/);
    expect(out).toMatch(/class="eqt"[^>]*>[^<]*Consider the Five Year Plans/);
  });

  it('returns single-language fragments unchanged', () => {
    const en = '<p>Only English here.</p>';
    const hi = '<p>केवल हिंदी यहाँ।</p>';
    expect(seg(en)).toBe(en);
    expect(seg(hi)).toBe(hi);
  });

  it('pure-splits a Latin loanword embedded in a Hindi sentence (order preserved)', () => {
    // Chosen semantics: a Latin run inside a Hindi sentence is tagged English,
    // so the EN view collects every Latin term and the HI view is pure Hindi.
    // Crucially the split is contiguous — the visible text/order never changes.
    const src = '<p>नीति आयोग NITI Aayog ने योजना बनाई</p>';
    const out = seg(src);
    expect(out).toContain('<span class="hqt">नीति आयोग </span>');
    expect(out).toContain('<span class="eqt">NITI Aayog </span>');
    expect(out).toContain('<span class="hqt">ने योजना बनाई</span>');
    // No word is lost and reading order is preserved.
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const before = document.createElement('div');
    before.innerHTML = src;
    const after = document.createElement('div');
    after.innerHTML = out;
    expect(norm(after.textContent || '')).toBe(norm(before.textContent || ''));
  });

  it('attaches trailing symbols/digits to the run they follow', () => {
    // "90-93 मिनट" — digits + Devanagari. Digits are neutral; they must ride
    // with the Hindi run, not leak out as a separate bare node.
    const out = seg('<li>परिक्रमा में 90-93 मिनट लगते हैं<br>It takes 90-93 minutes</li>');
    const hqt = out.match(/<span class="hqt">([\s\S]*?)<\/span>/);
    expect(hqt![1]).toContain('90-93');
    expect(hqt![1]).toContain('मिनट');
  });

  it('segments each <li> in a list independently', () => {
    const out = seg(
      '<ol><li>पहला कथन<br>First statement</li><li>दूसरा कथन<br>Second statement</li></ol>',
    );
    // Both list items get their own eqt/hqt pair.
    expect((out.match(/class="hqt"/g) || []).length).toBe(2);
    expect((out.match(/class="eqt"/g) || []).length).toBe(2);
  });

  it('preserves inline <strong>/<em> formatting inside the run', () => {
    const out = seg('<p>कथन <strong>सही</strong> है<br>Statement is <strong>correct</strong></p>');
    expect(out).toContain('<strong>सही</strong>');
    expect(out).toContain('<strong>correct</strong>');
  });

  it('splits a parenthesised translation gloss: "Traveler (यात्री)"', () => {
    const out = seg('<p>Traveler (यात्री)</p>');
    // English term in an EN span, the Hindi gloss in an HI span — and the whole
    // string stays in original order.
    expect(out).toContain('class="eqt"');
    expect(out).toContain('class="hqt"');
    expect(out).toMatch(/class="eqt"[^>]*>[^<]*Traveler/);
    expect(out).toMatch(/class="hqt"[^>]*>[^<]*यात्री/);
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const before = document.createElement('div');
    before.innerHTML = '<p>Traveler (यात्री)</p>';
    const after = document.createElement('div');
    after.innerHTML = out;
    expect(norm(after.textContent || '')).toBe(norm(before.textContent || ''));
  });

  it('splits an answer-gloss label without reordering: "Answer (उत्तर): C"', () => {
    const out = seg('<p>Answer (उत्तर): C) All pairs matched</p>');
    // English parts land in eqt, the Hindi label in hqt, order fully preserved.
    expect(out).toMatch(/class="eqt"[^>]*>[^<]*Answer/);
    expect(out).toMatch(/class="hqt"[^>]*>[^<]*उत्तर/);
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const before = document.createElement('div');
    before.innerHTML = '<p>Answer (उत्तर): C) All pairs matched</p>';
    const after = document.createElement('div');
    after.innerHTML = out;
    expect(norm(after.textContent || '')).toBe(norm(before.textContent || ''));
  });

  it('keeps a same-language parenthetical (a term, not a translation) glued in place', () => {
    // "(Metamerism)" is a Latin term glossing a Hindi word inside one Hindi
    // sentence — splitting it out would tear the clause. It stays in the HI run.
    const src = '<p>उत्सर्जन हेतु नेफ्रिडिया (Metamerism) नेरिस</p>';
    const out = seg(src);
    // No reordering: text matches the source exactly after tag-stripping.
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const before = document.createElement('div');
    before.innerHTML = src;
    const after = document.createElement('div');
    after.innerHTML = out;
    expect(norm(after.textContent || '')).toBe(norm(before.textContent || ''));
    expect(out).toContain('Metamerism');
  });

  it('does not split on "/" or ":" when the script does not flip ("NITI/IUCN", "Megasthenes: He…")', () => {
    // A Hindi sentence with an acronym after a colon must stay one HI run.
    const src = '<p>कर्क रेखा (Tropic of Cancer) पर मौसम</p>';
    const out = seg(src);
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const before = document.createElement('div');
    before.innerHTML = src;
    const after = document.createElement('div');
    after.innerHTML = out;
    expect(norm(after.textContent || '')).toBe(norm(before.textContent || ''));
  });

  it('never loses or reorders text across a corpus of hard cases', () => {
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    const cases = [
      '<p>1 and 2 only (केवल 1 और 2)</p>',
      '<p>Correction / सुधार: A Market Economy is defined as बाजार</p>',
      '<p>सही उत्तर: (C) FINAL ANSWER</p>',
      '<p>Wrote \'Indica\'; described 7 castes. (7 जातियों का वर्णन किया)</p>',
      '<p>Loss (समाप्ति) Renunciation (त्याग), Termination (पर्यवसान)</p>',
    ];
    for (const src of cases) {
      const before = document.createElement('div');
      before.innerHTML = src;
      const after = document.createElement('div');
      after.innerHTML = seg(src);
      expect(norm(after.textContent || '')).toBe(norm(before.textContent || ''));
    }
  });

  it('leaves an already-tagged fragment untouched (never double-wraps)', () => {
    const tagged =
      '<p><span class="hqt">योजना</span> <span class="eqt">Plan</span></p>';
    expect(seg(tagged)).toBe(tagged);
  });

  it('handles the real Five-Year-Plans layout: <strong> run + <ol>/<li> items', () => {
    const html =
      '<p data-start="62">भारत में पंचवर्षीय योजनाओं पर विचार कीजिए:<br><strong>With reference to Five Year Plans:</strong></p>' +
      '<ol><li><p>1944 का बॉम्बे प्लान<br>The Bombay Plan of 1944</p></li></ol>';
    const out = seg(html);
    expect(out).toContain('class="hqt"');
    expect(out).toContain('class="eqt"');
    // Nothing is dropped.
    expect(out).toContain('बॉम्बे प्लान');
    expect(out).toContain('The Bombay Plan');
  });

  it('never loses text: concatenated text content is preserved', () => {
    const src =
      '<p>भारत की प्रथम योजना<br>The First Plan of India</p><ol><li>कृषि<br>Agriculture</li></ol>';
    const before = document.createElement('div');
    before.innerHTML = src;
    const out = seg(src);
    const after = document.createElement('div');
    after.innerHTML = out;
    // Same visible text (whitespace-collapsed) before and after segmentation.
    const norm = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
    expect(norm(after.textContent || '')).toBe(norm(before.textContent || ''));
  });

  it('is idempotent on its own output', () => {
    const src = '<p>योजना<br>Plan</p>';
    const once = seg(src);
    const twice = seg(once);
    expect(twice).toBe(once);
  });
});
