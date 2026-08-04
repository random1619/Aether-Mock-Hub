import { useMemo } from 'react';
import { clsx } from 'clsx';
import { sanitizeHtml } from '@/services/mockParser';
import type { LangView } from '@/types';

export interface SafeHtmlProps {
  html: string;
  /** 'en' shows English, 'hi' shows Hindi, 'both' renders every word (no filtering). */
  lang?: LangView;
  className?: string;
}

/**
 * Bilingual handling supports three vendor markup styles found in the mocks:
 *  - Explicit markers: `.eqt` / `.hqt` spans or `lang="hi"`/`lang="hi-IN"`
 *    attributes (Pundits, TheSolver, EnglishMadhyam). English lives in `.eqt`,
 *    Hindi in `.hqt`/`lang="hi*"`. Markers can nest (a `lang="hi-IN"` span may
 *    sit inside an `.eqt` solution block).
 *  - Inline interleave (360 Mocks): English and Hindi share one block element —
 *    sibling `<strong>`/`<em>` runs, a parenthetical Devanagari translation
 *    "(केवल 1 और 2)" trailing an English phrase, or bare Devanagari sentences.
 *
 * Strategy: process the sanitized HTML in a DETACHED DOM (never the live,
 * React-rendered DOM), then serialize back to a string. Re-deriving from the
 * untouched source on every render makes the filter pure and idempotent —
 * toggling en ↔ hi can never "lose" a language or show both at once (the old
 * implementation mutated live text nodes and could not restore them reliably).
 *
 * Opposite-language content is removed structurally: elements are dropped from
 * the detached tree and Devanagari/Latin runs are stripped from text nodes, so
 * the serialized output contains ONLY the target language.
 */

/** Devanagari (Hindi) Unicode blocks. */
const DEV = /[ऀ-ॿ꣠-ꣿ]/;
/** Any Latin letter. */
const LATIN = /[A-Za-z]/;

type Script = 'en' | 'hi' | 'mixed' | 'none';

/**
 * Classify a string's script by Devanagari dominance.
 * 'hi'    — has Devanagari at ≥25% of Latin count (tolerates Latin loanwords).
 * 'en'    — Latin letters, zero Devanagari.
 * 'mixed' — genuinely half-and-half.
 * 'none'  — no letters (digits/punctuation only).
 */
function classify(text: string): Script {
  let dev = 0;
  let lat = 0;
  for (const ch of text) {
    if (DEV.test(ch)) dev++;
    else if (LATIN.test(ch)) lat++;
  }
  if (dev === 0 && lat === 0) return 'none';
  if (dev > 0 && dev >= lat * 0.25) return 'hi';
  if (lat > 0 && dev === 0) return 'en';
  return 'mixed';
}

/** EN view: drop Devanagari runs (parenthetical + inline words), keep Latin. */
const stripDevanagari = (t: string): string =>
  t
    .replace(/[ऀ-ॿ꣠-ꣿ]+[^\nA-Za-zऀ-ॿ꣠-ꣿ]*/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1');

/** HI view: drop Latin letters, keep Devanagari + digits + punctuation. */
const keepHindiOnly = (t: string): string =>
  t.replace(/[A-Za-z]+/g, '').replace(/[ \t]{2,}/g, ' ');

/** Identify an explicit bilingual marker element, if any. */
function markerKind(el: Element): 'en' | 'hi' | null {
  if (el.classList.contains('eqt')) return 'en';
  const lg = el.getAttribute('lang');
  if (el.classList.contains('hqt') || lg === 'hi' || lg === 'hi-IN' || lg === 'ar-SA') {
    return 'hi';
  }
  return null;
}

/**
 * Recursively filter `el`'s children for `lang`.
 * `protect` is the language of an enclosing KEPT marker block (.eqt/.hqt):
 * pure single-script content matching `protect` is intentional (e.g. cipher
 * codes inside `.hqt`) and is left untouched even though it looks non-target.
 */
function processChildren(el: Element, lang: 'en' | 'hi', protect: 'en' | 'hi' | null): void {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node as Text;
      const hasDev = DEV.test(t.data);
      const hasLat = LATIN.test(t.data);
      // Protected marker block and the text matches its script → leave alone.
      if (protect && classify(t.data) === protect) continue;
      if (lang === 'en') {
        // Pure Devanagari run → drop. Mixed run → strip Devanagari, keep Latin.
        if (!hasLat && hasDev) t.data = '';
        else if (hasDev) t.data = stripDevanagari(t.data);
      } else {
        if (!hasDev && hasLat) t.data = '';
        else if (hasLat) t.data = keepHindiOnly(t.data);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const sub = node as Element;
      const k = markerKind(sub);
      if (k) {
        const hideThis = (lang === 'en' && k === 'hi') || (lang === 'hi' && k === 'en');
        if (hideThis) {
          sub.remove();
          continue;
        }
        processChildren(sub, lang, k); // kept marker: protect its language inside
        continue;
      }
      const isLeaf = sub.childElementCount === 0;
      const text = sub.textContent || '';
      const hasDev = DEV.test(text);
      const hasLat = LATIN.test(text);
      // Only structurally drop a TEXT LEAF that contains PURELY the opposite
      // script. Anything carrying target-script characters keeps its text and
      // simply gets the opposite script stripped at the text-node level. This
      // is critical for inline-interleave vendors (360 Mocks): they frequently
      // embed "English sentence (हिंदी अनुवाद)" inside a single leaf <p>/<li>,
      // and classifying the leaf's aggregated textContent yields 'hi', which
      // would otherwise delete the English question stem along with the Hindi.
      const pureOpp =
        (lang === 'en' && hasDev && !hasLat) || (lang === 'hi' && hasLat && !hasDev);
      if (isLeaf && pureOpp) {
        sub.remove();
        continue;
      }
      processChildren(sub, lang, protect);
    }
  }
}

/** Remove elements emptied by the filter (but keep structural/media elements). */
function pruneEmpty(root: Element): void {
  root
    .querySelectorAll('em, strong, span, i, b, p, li, h1, h2, h3, h4, h5, h6')
    .forEach((e) => {
      if (!e.textContent?.trim() && !e.querySelector('img, math, table, ul, ol, br')) {
        e.remove();
      }
    });
}

/**
 * Produce the language-specific HTML for a fragment by filtering it in a
 * detached DOM and re-serializing. Pure + idempotent.
 */
function applyLang(html: string, lang: LangView): string {
  if (!html) return html;
  // 'both' renders the source verbatim — the only view guaranteed to keep every
  // word. Skip the filter entirely so nothing is ever dropped.
  if (lang === 'both') return html;
  // Fast path: no Devanagari anywhere → nothing to toggle.
  if (!DEV.test(html)) return html;

  const container = document.createElement('div');
  container.innerHTML = html;
  processChildren(container, lang, markerKind(container));
  pruneEmpty(container);
  return container.innerHTML;
}

/**
 * Renders sanitized rich question/option/solution HTML.
 * Handles bilingual content; vendor math is pre-rendered in the source HTML.
 */
export function SafeHtml({ html, lang = 'both', className }: SafeHtmlProps) {
  // Derive the language-specific markup from the source on every render. The
  // source `html` prop is stable, so toggling lang re-derives cleanly.
  const rendered = useMemo(() => sanitizeHtml(applyLang(html, lang)), [html, lang]);

  return (
    <div
      className={clsx('rich-content', className)}
      lang={lang === 'both' ? undefined : lang}
      // Content is sanitized before it reaches here.
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
