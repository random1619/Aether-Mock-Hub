/* BILINGUAL SEGMENTER — tag every language run in a mixed Hindi+English
   HTML fragment with explicit `.eqt` / `.hqt` marker spans.

   Why this exists
   ---------------
   360 Mocks embed BOTH languages in one stream with NO structural marker for
   which run is which: a Hindi sentence, a `<br/>`, then the English gloss —
   or the reverse. The renderer's language toggle (SafeHtml) falls back to
   per-character script detection on such untagged content, which mangles
   mixed runs: "NITI Aayog" (Latin loanword) vanishes from the Hindi view and
   "90-93 मिनट" leaks digits into both. Symbols between runs (₹, %, ✔️, –)
   get assigned to the wrong side or dropped.

   This segmenter converts the loose inline interleave into the SAME explicit
   `.eqt` / `.hqt` markup that SafeHtml already handles perfectly for
   TheSolver / Pundits / EnglishMadhyam — so en / hi / both toggling becomes
   exact and symbols stay attached to their language.

   Hybrid strategy
   ---------------
   1. LAYOUT split: run boundaries are the vendor's structural separators —
      block elements (`<p>`, `<li>`, …) and `<br>` breaks. Each block/line is
      a candidate run.
   2. SCRIPT classify: within a run, count Devanagari vs Latin letters to
      decide its language; a short Latin loanword inside a Devanagari run does
      NOT flip it (the 25% tolerance mirrors SafeHtml's own classifier, so the
      two never disagree).
   3. Symbols, digits, whitespace and entities carry no language — they are
      glued to the run that surrounds them instead of being split out.

   The transform is PURE and IDEMPOTENT: a fragment that already carries
   `.eqt`/`.hqt`/`lang="hi*"` markers is returned untouched, so re-parsing a
   hand-tagged mock never double-wraps. */

/** Devanagari (Hindi) Unicode blocks — same range SafeHtml uses. */
const DEV = /[ऀ-ॿ꣠-ꣿ]/;
const LATIN = /[A-Za-z]/;

/** True when the fragment already declares its languages explicitly. */
const ALREADY_TAGGED =
  /class="[^"]*\b(?:eqt|hqt)\b|lang="(?:hi|hi-IN|ar-SA)"/i;

type RunLang = 'en' | 'hi' | 'none';

/**
 * Classify a text run by script dominance, mirroring SafeHtml.classify so the
 * segmenter and the renderer never reach opposite conclusions about the same
 * string. Devanagari at ≥25% of the Latin count reads as Hindi (tolerates
 * Latin loanwords like "NITI", "ISS", "GDP" inside a Hindi sentence).
 */
function classifyRun(text: string): RunLang {
  let dev = 0;
  let lat = 0;
  for (const ch of text) {
    if (DEV.test(ch)) dev++;
    else if (LATIN.test(ch)) lat++;
  }
  if (dev === 0 && lat === 0) return 'none';
  if (dev > 0 && dev >= lat * 0.25) return 'hi';
  if (lat > 0 && dev === 0) return 'en';
  return 'none'; // genuinely half-and-half → leave neutral rather than guess wrong
}

/** An inline element that should be recursed into rather than treated as a
    hard run boundary (its text contributes to the surrounding run). */
const INLINE_TAGS = new Set([
  'STRONG', 'EM', 'B', 'I', 'U', 'SPAN', 'SUB', 'SUP', 'MARK', 'SMALL', 'A',
]);

/** Strip tags to recover the plain text of a node (for classification). */
function textOf(node: Node): string {
  return node.textContent ?? '';
}

/* ── Sentence-aware splitting ───────────────────────────────────────────────
   The vendor mixes languages inside a single line in two DISTINCT ways:

     1. A TRANSLATION PAIR — two independent sentences/glosses back-to-back:
        "Traveler (यात्री)", "EN → DEV", "Wrote 'Indica'. (7 जातियों का वर्णन)".
        Each side is its OWN sentence, so splitting there keeps meaning intact.

     2. An INLINE LOANWORD — one sentence that happens to embed the other
        script: "नीति आयोग NITI Aayog ने योजना बनाई", "कर्क रेखा (Tropic of
        Cancer) पर". Splitting mid-sentence would tear the words out of their
        clause and break the meaning, so the whole sentence is kept as ONE run
        and classified by dominance (the 25% tolerance keeps "NITI Aayog" with
        its Hindi sentence).

   So a mixed text node is split at SENTENCE/CLAUSE boundaries — never at a
   bare script transition — and each resulting sentence is classified by
   classifyRun. A sentence only becomes a boundary where the dominant script
   actually flips, which is exactly the translation-pair case. */

/** Tokenize into letter-runs (each tagged with its script) interleaved with the
    neutral separators between them. Concatenating every token's text reproduces
    the input byte-for-byte, so NOTHING is ever reordered or dropped. */
function tokenize(text: string): Array<{ text: string; lang: RunLang }> {
  const toks: Array<{ text: string; lang: RunLang }> = [];
  let i = 0;
  const n = text.length;
  const isLetter = (c: string) => DEV.test(c) || LATIN.test(c);
  while (i < n) {
    if (isLetter(text[i])) {
      const lang: RunLang = DEV.test(text[i]) ? 'hi' : 'en';
      let j = i;
      while (j < n && isLetter(text[j]) && (DEV.test(text[j]) ? 'hi' : 'en') === lang) j++;
      toks.push({ text: text.slice(i, j), lang });
      i = j;
    } else {
      let j = i;
      while (j < n && !isLetter(text[j])) j++;
      toks.push({ text: text.slice(i, j), lang: 'none' });
      i = j;
    }
  }
  return toks;
}

/** Resolve every neutral (letter-less) token to a language IN PLACE — never
    moving it. A neutral token takes the language of the run on its left if one
    is open; a leading run of neutrals takes the language of the first real
    token to its right. Because tokens are never reordered, the visible text and
    layout are byte-for-byte preserved. */
function resolveNeutrals(toks: Array<{ text: string; lang: RunLang }>): void {
  // Forward: a neutral after a classified token rides with it.
  let last: RunLang = 'none';
  for (const t of toks) {
    if (t.lang !== 'none') last = t.lang;
    else if (last !== 'none') t.lang = last;
  }
  // Backward: a still-neutral token (one before any classified token) rides with
  // the first classified token to its right — resolved in place, never moved.
  let next: RunLang = 'none';
  for (let i = toks.length - 1; i >= 0; i--) {
    const t = toks[i];
    if (t.lang === 'none' && next !== 'none') t.lang = next;
    else if (t.lang !== 'none') next = t.lang;
  }
}

/** Split a mixed text node into maximal same-language runs, IN ORIGINAL ORDER.
    Two adjacent letter-runs of DIFFERENT scripts start a new run (a genuine
    language flip); everything else merges. A loanword is just a flip-then-
    flip-back, which naturally becomes its own short run — but because runs are
    contiguous and never reordered, meaning and layout stay intact. */
function splitBySentence(text: string): Array<{ text: string; lang: RunLang }> {
  const toks = tokenize(text);
  resolveNeutrals(toks);
  const out: Array<{ text: string; lang: RunLang }> = [];
  for (const t of toks) {
    const last = out[out.length - 1];
    if (last && last.lang === t.lang) last.text += t.text;
    else out.push({ text: t.text, lang: t.lang });
  }
  return out;
}

/** Split an inline element that carries a translation pair across sentence
    boundaries into a sequence of single-language inline elements, preserving
    the element's tag/attributes around each sentence (formatting survives).
    A single mixed sentence (a loanword) is NOT split — it stays one run. */
function splitInlineBySentence(el: Element, doc: Document): Element[] {
  const cloneShallow = (): Element => {
    const c = doc.createElement(el.tagName);
    for (const attr of Array.from(el.attributes)) c.setAttribute(attr.name, attr.value);
    return c;
  };
  // Emit runs CONTIGUOUSLY in document order — each maximal run of same-language
  // content becomes one clone, so nothing is ever reordered (unlike grouping by
  // language, which would pull same-language pieces together out of sequence).
  const runs: Array<{ lang: RunLang; nodes: Node[] }> = [];
  const pushNode = (node: Node, lang: RunLang) => {
    const last = runs[runs.length - 1];
    if (last && last.lang === lang) last.nodes.push(node);
    else runs.push({ lang, nodes: [node] });
  };

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      for (const piece of splitBySentence((child as Text).data)) {
        pushNode(doc.createTextNode(piece.text), piece.lang);
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const sub = child as Element;
      if (INLINE_TAGS.has(sub.tagName) && hasInternalScriptMix(sub)) {
        for (const pieceEl of splitInlineBySentence(sub, doc)) {
          pushNode(pieceEl, classifyRun(textOf(pieceEl)));
        }
      } else {
        pushNode(sub.cloneNode(true), classifyRun(textOf(sub)));
      }
    } else {
      // Neutral (comment etc.) — keep it in place with the current run.
      const lang = runs.length ? runs[runs.length - 1].lang : 'none';
      pushNode(child.cloneNode(true), lang);
    }
  }

  return runs.map(({ nodes }) => {
    const c = cloneShallow();
    for (const n of nodes) c.appendChild(n);
    return c;
  });
}

/** True when an inline element (strong/em/span/…) contains an internal script
    transition — i.e. its text nodes (or nested inline children) carry BOTH
    scripts, so it must be segmented rather than pushed as one run. */
function hasInternalScriptMix(el: Element): boolean {
  let dev = 0;
  let lat = 0;
  // Walk only TEXT children (and shallow inline descendants); block children
  // are handled by the block recursion and don't count as "inline mixing".
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        for (const ch of (child as Text).data) {
          if (DEV.test(ch)) dev++;
          else if (LATIN.test(ch)) lat++;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const sub = child as Element;
        if (INLINE_TAGS.has(sub.tagName)) walk(sub);
      }
    }
  };
  walk(el);
  return dev > 0 && lat > 0;
}

/**
 * Walk `parent`'s direct children and wrap each maximal same-language run in a
 * marker span. Runs break at `<br>` and at block-level children (which are
 * segmented independently). Inline formatting (`<strong>`, `<em>`, …) is kept
 * INSIDE the run: we wrap the run, not the formatting, so bold/italic survive.
 *
 * Instead of moving nodes (which is fiddly across mixed inline boundaries), we
 * rebuild the parent's inline content: consecutive inline nodes of one language
 * are grouped under a fresh `<span class="eqt|hqt">`, block children are
 * recursed and re-appended as-is.
 */
function segmentBlock(parent: Element, doc: Document): void {
  const children = Array.from(parent.childNodes);
  // Fast path: a pure single-language block with no <br> and no block child
  // still needs wrapping — but if every inline run already agrees we can wrap
  // the whole inline flow in ONE span instead of many tiny ones.

  const frag = doc.createDocumentFragment();
  let current: Element | null = null; // the open marker span
  let currentLang: RunLang | null = null;

  const closeRun = () => {
    current = null;
    currentLang = null;
  };

  const openRun = (lang: Exclude<RunLang, 'none'>): Element => {
    const span = doc.createElement('span');
    span.className = lang === 'en' ? 'eqt' : 'hqt';
    frag.appendChild(span);
    current = span;
    currentLang = lang;
    return span;
  };

  /** Append a node to the run for `lang`, opening/closing spans as needed.
      `none` language (symbols/digits/whitespace) joins the OPEN run; with no
      open run it attaches to the NEXT classified run by staying unwrapped at
      the fragment level (then gets swept in by the next openRun's parent). */
  const push = (node: Node, lang: RunLang) => {
    if (lang === 'none') {
      // Neutral content: glue to the currently-open run if there is one, else
      // emit bare so a following classified run's span doesn't swallow it.
      (current ?? frag).appendChild(node);
      return;
    }
    if (currentLang !== lang) openRun(lang);
    (current as Element).appendChild(node);
  };

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = textOf(node);
      if (DEV.test(text) && LATIN.test(text)) {
        // Mixed-script text node: split at SENTENCE boundaries only (never at a
        // bare script transition) so translation pairs separate but an inline
        // loanword keeps its sentence — and its meaning — intact.
        for (const piece of splitBySentence(text)) {
          push(doc.createTextNode(piece.text), piece.lang);
        }
      } else {
        // Pure single-script (or letter-less) node: no split needed.
        push(node, classifyRun(text));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (el.tagName === 'BR') {
        // Hard break: end the current run; the break itself is neutral.
        closeRun();
        frag.appendChild(el);
        continue;
      }
      if (INLINE_TAGS.has(el.tagName)) {
        // A pure inline element (one script) keeps its formatting and rides with
        // its language. One that internally holds a translation pair (e.g.
        // "<strong>EN sentence. (DEV sentence)</strong>") is split at sentence
        // boundaries so the gloss is tagged — formatting wrapper preserved.
        if (!hasInternalScriptMix(el)) {
          push(el, classifyRun(textOf(el)));
          continue;
        }
        for (const pieceEl of splitInlineBySentence(el, doc)) {
          push(pieceEl, classifyRun(textOf(pieceEl)));
        }
        continue;
      }
      // Block-level child (p, li, ol, ul, table, div, …): a fresh run context.
      closeRun();
      segmentBlock(el, doc);
      frag.appendChild(el);
    } else {
      // Comments / processing instructions — pass through, neutral.
      (current ?? frag).appendChild(node);
    }
  }
  closeRun();

  // Replace the parent's content with the segmented fragment.
  parent.textContent = '';
  parent.appendChild(frag);
}

/**
 * Wrap every language run in `html` with `.eqt` / `.hqt` marker spans.
 * Returns the original string unchanged when there is nothing to segment
 * (single-language, or already explicitly tagged).
 *
 * Operates on a detached DOM (never the live rendered tree); the caller
 * re-serializes. Pure + idempotent.
 */
export function segmentBilingual(html: string, doc: Document): string {
  if (!html) return html;
  // Both languages must be present in the TEXT, otherwise there is nothing to
  // separate. Test the text, not the raw HTML — tag/attr names are Latin, so
  // LATIN.test(html) would be true even for a pure-Devanagari fragment.
  const text = html.replace(/<[^>]*>/g, '');
  if (!DEV.test(text) || !LATIN.test(text)) return html;
  // Respect content someone already tagged by hand (never double-wrap).
  if (ALREADY_TAGGED.test(html)) return html;

  const container = doc.createElement('div');
  container.innerHTML = html;
  segmentBlock(container, doc);
  const out = container.innerHTML;

  // Safety net: if segmentation produced no markers (e.g. every run classified
  // 'none'), return the source untouched rather than a subtly reflowed copy.
  return ALREADY_TAGGED.test(out) ? out : html;
}
