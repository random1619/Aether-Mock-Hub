/* QUESTION EXPORTER — produce a self-contained .html file for the
   current question (TCS-style review view). Used by the "Save" button
   in the question card / post-submit review. */
import type { Question, ExamMeta } from '@/types';

export interface QuestionExportContext {
  meta: ExamMeta;
  idx: number;
  q: Question;
  chosen?: number;
  flagged: boolean;
  /** Which language to render for bilingual spans ('en' | 'hi' | 'both'). */
  lang: 'en' | 'hi' | 'both';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Build the HTML for a single option row.
 * For bilingual content the source HTML carries .eqt / .hqt spans; if the
 * caller asked for a single language we strip the other one before export.
 */
function stripOtherLang(html: string, keep: 'en' | 'hi'): string {
  // Quick-and-dirty: drop spans/divs whose class includes the opposite marker.
  const re = keep === 'en'
    ? /<(\w+)[^>]*\bclass="[^"]*\bhqt\b[^"]*"[^>]*>[\s\S]*?<\/\1>/g
    : /<(\w+)[^>]*\bclass="[^"]*\beqt\b[^"]*"[^>]*>[\s\S]*?<\/\1>/g;
  return html.replace(re, '');
}

export function buildQuestionHtml(ctx: QuestionExportContext): string {
  const { meta, idx, q, chosen, flagged, lang } = ctx;
  const clean = (h: string) => (lang === 'both' ? h : stripOtherLang(h, lang));
  const marksTxt = q.marks !== undefined ? `+${q.marks} / −${(q.marks * 0.25).toFixed(2)}` : '+2 / −0.50';
  const chosenTxt = chosen === undefined ? 'Not Answered' : `Option ${String.fromCharCode(65 + chosen)}`;
  const isCorrect = chosen !== undefined && chosen === q.correct_option_id;
  const isWrong = chosen !== undefined && chosen !== q.correct_option_id;
  const outcome = chosen === undefined ? 'skipped' : isCorrect ? 'correct' : 'incorrect';

  const optionsHtml = q.options
    .map((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      const isChosen = chosen === oi;
      const isRight = q.correct_option_id === oi;
      let cls = 'opt';
      if (isRight) cls += ' right';
      if (isChosen && isWrong) cls += ' wrong';
      if (isChosen && isCorrect) cls += ' chosen right';
      else if (isChosen) cls += ' chosen';
      return `
        <div class="${cls}">
          <div class="row">
            <span class="letter">${letter}</span>
            <span class="txt">${clean(opt)}</span>
          </div>
          <div class="badges">
            ${isRight ? '<span class="badge badge-ok">Correct Answer</span>' : ''}
            ${isChosen ? '<span class="badge badge-me">Your Answer</span>' : ''}
          </div>
        </div>`;
    })
    .join('\n');

  const solutionHtml = q.solution
    ? `<div class="sol"><h3>Explanation</h3><div class="sol-body">${clean(q.solution)}</div></div>`
    : '';

  const savedAt = new Date().toLocaleString('en-IN', { hour12: false });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Q${idx + 1} — ${esc(meta.name)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    --ink: #0b1524; --panel: #16233c; --panel2: #1b2a46;
    --border: #2a3a5a; --muted: #8ba0c2; --text: #e9eef7;
    --ok: #2f9e44; --bad: #e03131; --mark: #7048e8; --accent: #339af0;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--ink); color: var(--text); font-family: "Segoe UI", system-ui, sans-serif; line-height: 1.55; }
  .wrap { max-width: 760px; margin: 28px auto; padding: 0 20px 40px; }
  header { border-bottom: 1px solid var(--border); padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); font-weight: 700; }
  h1 { font-size: 20px; margin: 4px 0 0; }
  .meta { font-size: 12px; color: var(--muted); margin-top: 6px; }
  .qcard { background: var(--panel); border: 1px solid var(--border); }
  .qhead { display: flex; align-items: center; justify-content: space-between; background: var(--panel2); padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--muted); }
  .qno { display: inline-block; background: #5c6b85; color: #fff; padding: 2px 10px; font-weight: 700; }
  .flag { color: var(--mark); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  .qbody { padding: 18px 18px 22px; }
  .comp { background: rgba(0,0,0,0.15); border: 1px solid var(--border); padding: 10px 12px; margin-bottom: 14px; font-size: 14px; }
  .qtext { font-size: 15px; margin-bottom: 16px; }
  .hindi, .hqt { font-family: "Noto Sans Devanagari", "Mangal", system-ui, sans-serif; }
  .opt { border: 1px solid var(--border); padding: 10px 12px; margin-bottom: 8px; border-radius: 4px; position: relative; }
  .opt .row { display: flex; align-items: flex-start; gap: 10px; }
  .letter { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); font-size: 12px; font-weight: 700; margin-top: 2px; flex-shrink: 0; }
  .opt.right { border-color: var(--ok); background: rgba(47,158,68,0.08); }
  .opt.right .letter { background: var(--ok); border-color: var(--ok); color: #fff; }
  .opt.wrong { border-color: var(--bad); background: rgba(224,49,49,0.08); }
  .opt.wrong .letter { background: var(--bad); border-color: var(--bad); color: #fff; }
  .opt.chosen:not(.right):not(.wrong) { border-color: var(--accent); background: rgba(51,154,240,0.06); }
  .badges { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border-radius: 10px; }
  .badge-ok { background: rgba(47,158,68,0.2); color: #8ce99a; }
  .badge-me { background: rgba(51,154,240,0.22); color: #74c0fc; }
  .sol { margin-top: 16px; padding: 14px; background: rgba(51,154,240,0.06); border-left: 3px solid var(--accent); border-radius: 3px; }
  .sol h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); }
  .sol-body { font-size: 14px; }
  footer { margin-top: 22px; padding-top: 14px; border-top: 1px dashed var(--border); font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-block; padding: 2px 8px; background: var(--panel2); border: 1px solid var(--border); border-radius: 10px; margin-right: 4px; }
  .pill.ok { border-color: var(--ok); color: #8ce99a; }
  .pill.bad { border-color: var(--bad); color: #ffa8a8; }
  .pill.skip { border-color: var(--muted); color: var(--muted); }
  @media print {
    body { background: #fff; color: #000; }
    .wrap { max-width: 100%; margin: 0; padding: 0 12mm 12mm; }
    .qcard { border: 1px solid #999; }
    header { border-bottom: 1px solid #999; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">Staff Selection Commission · Saved Question</div>
    <h1>${esc(meta.name)}</h1>
    <div class="meta">${esc(meta.provider || '')} · Question ${idx + 1} · Marks ${marksTxt}</div>
  </header>

  <div class="qcard">
    <div class="qhead">
      <span><span class="qno">Question No. ${idx + 1}</span></span>
      <span>
        ${flagged ? '<span class="flag">★ Marked for review</span> · ' : ''}
        <span>${esc(chosenTxt)}</span>
      </span>
    </div>
    <div class="qbody">
      ${q.comp ? `<div class="comp">${clean(q.comp)}</div>` : ''}
      <div class="qtext">${clean(q.question)}</div>
      <div class="opts">${optionsHtml}</div>
      ${solutionHtml}
    </div>
  </div>

  <footer>
    <div>
      <span class="pill ${outcome === 'correct' ? 'ok' : outcome === 'incorrect' ? 'bad' : 'skip'}">
        Outcome: ${outcome.charAt(0).toUpperCase() + outcome.slice(1)}
      </span>
      ${flagged ? '<span class="pill">Flagged</span>' : ''}
    </div>
    <div>Saved ${esc(savedAt)} · ${esc(meta.path)}#q${idx + 1}</div>
  </footer>
</div>
</body>
</html>`;
}

/**
 * Trigger a browser download of the given HTML string with a safe filename
 * like `SSC-CGL-2024-q12.html`.
 */
export function downloadQuestionHtml(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Release the object URL on the next tick so the download can start.
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Build a filesystem-safe filename from exam + question index. */
export function questionFilename(meta: ExamMeta, idx: number): string {
  const base = (meta.name || meta.path || 'question')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'question'}-q${idx + 1}.html`;
}
