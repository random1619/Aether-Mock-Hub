import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { SafeHtml } from './SafeHtml';

/* These tests pin the "never lose a word" contract for bilingual content.
   Most mocks are code-mixed: an English grammar solution quotes the English
   term inside a Hindi explanation, and a Hindi question embeds Latin math
   variables. Filtering to a single script necessarily deletes legitimate
   words, so the DEFAULT view must be 'both' (verbatim). */

/** Render SafeHtml to a static string and return its visible text content. */
function textOf(html: string, lang?: 'en' | 'hi' | 'both'): string {
  const markup = renderToStaticMarkup(createElement(SafeHtml, { html, lang }));
  // Strip tags to compare visible text only.
  return markup.replace(/<[^>]*>/g, '');
}

describe('SafeHtml bilingual fidelity', () => {
  it("defaults to 'both' and keeps every word of a code-mixed sentence", () => {
    const mixed = '"suspend" का अर्थ होता है किसी गतिविधि को रोकना';
    const out = textOf(mixed); // no lang prop → default
    expect(out).toContain('suspend');
    expect(out).toContain('का अर्थ होता है');
  });

  it("'both' keeps the quoted English term AND the Hindi gloss together", () => {
    const mixed = 'A)Monthly\'का उपयोग होगा क्योंकि passage में';
    const out = textOf(mixed, 'both');
    expect(out).toContain('Monthly');
    expect(out).toContain('क्योंकि');
  });

  it("'both' preserves Latin math variables embedded in Hindi (2n, r-फाइकोएरिथ्रिन)", () => {
    const bio = 'वर्णक: r-फाइकोएरिथ्रिन';
    const math = '2n समान गुणसूत्र';
    expect(textOf(bio, 'both')).toContain('r-फाइकोएरिथ्रिन');
    expect(textOf(math, 'both')).toContain('2n');
  });

  it("'both' keeps standalone Hindi answer words that 'en' would drop", () => {
    // The 'en' filter eats "केवल" and "और", truncating "1 and 2 only".
    const ans = '1 and 2 only (केवल 1 और 2)';
    const both = textOf(ans, 'both');
    expect(both).toContain('केवल');
    expect(both).toContain('और');
  });

  it("'en' still filters to Latin only (drops Devanagari)", () => {
    const out = textOf('Answer है', 'en');
    expect(out).toContain('Answer');
    expect(out).not.toContain('है');
  });

  it("'hi' still filters to Devanagari only (drops Latin)", () => {
    const out = textOf('उत्तर D सही है', 'hi');
    expect(out).toContain('उत्तर');
    expect(out).not.toContain('D');
  });

  it('is idempotent: rendering the same source twice gives the same output', () => {
    const mixed = 'English sentence (हिंदी अनुवाद) and more';
    expect(textOf(mixed, 'both')).toBe(textOf(mixed, 'both'));
  });
});
