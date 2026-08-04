/**
 * Aether Mocks — Build-time Mock Extractor
 * =====================================================================
 * Parses every static mock HTML under public/providers/**, evaluates its
 * inline question-data script in a sandboxed VM, and emits a clean,
 * self-describing JSON per mock that the React CBT player consumes.
 *
 * Why build-time: the React app must serve 1,121 legacy mocks without
 * editing them, and must NOT ship 220KB HTML files to the browser just
 * to read an inline `const questions`. Extracting once at build time
 * gives the player small, cacheable, strongly-typed JSON.
 *
 * Ported verbatim from the legacy engine so behaviour is preserved:
 *   - section classification (js/engine/sections.js)
 *   - default marks +2.0 / negative marking -0.25 (js/engine/results.js)
 *
 * Usage:  node app/scripts/extract-mocks.mjs
 * Output: app/public/mocks/<slug>.json   (one per mock)
 *         app/public/mocks-index.json    (manifest for dashboard/search)
 * =====================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(REPO_ROOT, 'public');
const PROVIDERS = path.join(PUBLIC, 'providers');
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'mocks');
const MANIFEST = path.resolve(__dirname, '..', 'public', 'mocks-index.json');

/* ── Section classification — ported 1:1 from js/engine/sections.js ── */
function classifyExamPattern(totalQuestions) {
  if (totalQuestions >= 95 && totalQuestions <= 105) {
    const qPerSec = Math.floor(totalQuestions / 4);
    const rem = totalQuestions % 4;
    const s1Cnt = qPerSec + (rem > 0 ? 1 : 0);
    const s2Cnt = qPerSec + (rem > 1 ? 1 : 0);
    const s3Cnt = qPerSec + (rem > 2 ? 1 : 0);
    const s4Cnt = qPerSec + (rem > 3 ? 1 : 0);
    return {
      type: 'tier1',
      locked: false,
      sections: [
        { name: 'General Intelligence & Reasoning', start: 0, count: s1Cnt },
        { name: 'General Awareness', start: s1Cnt, count: s2Cnt },
        { name: 'Quantitative Aptitude', start: s1Cnt + s2Cnt, count: s3Cnt },
        { name: 'English Comprehension', start: s1Cnt + s2Cnt + s3Cnt, count: s4Cnt },
      ],
    };
  }
  if (totalQuestions >= 125 && totalQuestions <= 155) {
    const s1Qs = Math.round(totalQuestions * 0.4);
    const s2Qs = Math.round(totalQuestions * 0.47);
    const s3Qs = totalQuestions - s1Qs - s2Qs;
    return {
      type: 'tier2',
      locked: true,
      sections: [
        { name: 'Section I: Reasoning & Quantitative', start: 0, count: s1Qs, timer: 60 },
        { name: 'Section II: English & General Awareness', start: s1Qs, count: s2Qs, timer: 60 },
        { name: 'Section III: Computer Knowledge', start: s1Qs + s2Qs, count: s3Qs, timer: 15 },
      ],
    };
  }
  return null;
}

/** Build the section list exactly as the engine's detectSections() does. */
function buildSections(totalQuestions, sectionsData, examDurationMin) {
  // Priority 1: explicit window.sectionsData (bespoke Tier-2 files) — locked.
  if (Array.isArray(sectionsData) && sectionsData.length) {
    return {
      locked: true,
      sections: sectionsData.map((sec) => ({
        name: sec.name,
        start: sec.start,
        end: sec.end,
        timer: typeof sec.timer === 'number' ? sec.timer : 15 * 60, // seconds
      })),
    };
  }
  // Priority 2: auto-classify SSC CGL patterns.
  const pattern = classifyExamPattern(totalQuestions);
  if (pattern) {
    const totalMinutes = Number.isFinite(examDurationMin)
      ? examDurationMin
      : pattern.type === 'tier2' ? 135 : 60;
    const base = pattern.type === 'tier2' ? 135 : 60;
    const sections = pattern.sections.map((sec, idx) => {
      const end = idx < pattern.sections.length - 1 ? sec.start + sec.count - 1 : totalQuestions - 1;
      let timer = null;
      if (pattern.locked && sec.timer) {
        const sectionMinutes = Math.round((sec.timer / base) * totalMinutes);
        timer = sectionMinutes * 60;
      }
      return { name: sec.name, start: sec.start, end, timer };
    });
    return { locked: pattern.locked, sections };
  }
  return { locked: false, sections: null };
}

/* ── HTML helpers ── */
function extractInlineDataScripts(html) {
  // Return bodies of every <script> WITHOUT a src= attribute.
  const bodies = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1] && m[1].trim().length > 0) bodies.push(m[1]);
  }
  return bodies;
}

function extractExamDuration(html) {
  const m = html.match(/<meta[^>]*name=["']exam-duration["'][^>]*content=["'](\d+)["']/i)
    || html.match(/<meta[^>]*content=["'](\d+)["'][^>]*name=["']exam-duration["']/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : null;
}

/* ── VM evaluation of a mock's inline data ── */
function evalMockData(scriptBodies) {
  // A fresh global that behaves like a browser window for our purposes.
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Concatenate all inline scripts (data may be split; later scripts can read earlier consts
  // only if they share scope — so we run them as one program).
  const program = scriptBodies.join('\n;\n') + `
    ;(() => {
      const out = {};
      try { if (typeof questions !== 'undefined') out.questions = questions; } catch (e) {}
      try { if (typeof window.questions !== 'undefined') out.questions = out.questions || window.questions; } catch (e) {}
      try { if (typeof sectionsData !== 'undefined') out.sectionsData = sectionsData; } catch (e) {}
      try { if (typeof window.sectionsData !== 'undefined') out.sectionsData = out.sectionsData || window.sectionsData; } catch (e) {}
      try { if (typeof examData !== 'undefined') out.examData = examData; } catch (e) {}
      return JSON.stringify(out);
    })()`;
  try {
    const json = vm.runInContext(program, sandbox, { timeout: 2000 });
    return JSON.parse(json || '{}');
  } catch (e) {
    return { __error: String(e && e.message || e) };
  }
}

/* ── Question normalisation ── */
function normaliseQuestions(raw, examData) {
  // Shape A: flat array of question objects.
  if (Array.isArray(raw)) return raw;
  // Shape B: examData { sections: [{ name, questions: [...] }] } → flatten.
  if (examData && Array.isArray(examData.sections)) {
    const flat = [];
    examData.sections.forEach((sec) => (sec.questions || []).forEach((q) => flat.push(q)));
    return flat;
  }
  return [];
}

function cleanQuestion(q) {
  const options = Array.isArray(q.options) ? q.options : [];
  return {
    question: q.question ?? q.text ?? '',
    options,
    // Preserve the exact answer field the legacy grader uses.
    correct_option_id: q.correct_option_id ?? q.correct ?? q.answer ?? null,
    solution: q.solution ?? q.explanation ?? '',
    marks: q.marks !== undefined ? parseFloat(q.marks) : 2.0,
    section: q.section ?? null,
  };
}

/* ── Filesystem walk ── */
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html') && entry.name !== 'index.html') acc.push(full);
  }
  return acc;
}

function slugify(rel) {
  return rel
    .replace(/\\/g, '/')
    .replace(/\.html?$/i, '')
    .split('/')
    .map((seg) => encodeURIComponent(seg.replace(/\s+/g, '_').replace(/[^\w\-()]/g, '')))
    .join('__');
}

/* ── Main ── */
function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = walk(PROVIDERS);
  const manifest = [];
  const skipped = [];
  let ok = 0;

  for (const file of files) {
    const rel = path.relative(PUBLIC, file).replace(/\\/g, '/'); // providers/<...>.html
    const html = fs.readFileSync(file, 'utf8');
    const bodies = extractInlineDataScripts(html);
    const data = bodies.length ? evalMockData(bodies) : { __error: 'no-inline-script' };

    const rawQuestions = normaliseQuestions(data.questions, data.examData);
    if (!rawQuestions.length) {
      skipped.push({ path: rel, reason: data.__error || 'no-questions' });
      continue;
    }

    const questions = rawQuestions.map(cleanQuestion);
    const examDurationMin = extractExamDuration(html);
    const { locked, sections } = buildSections(questions.length, data.sectionsData, examDurationMin);

    const provider = rel.split('/')[1] || 'Unknown';
    const category = rel.split('/')[2] || 'General';
    const title = extractTitle(html) || path.basename(file, '.html');

    const slug = slugify(rel);
    const record = {
      version: 1,
      slug,
      path: rel,               // legacy path — stable key for AetherStore continuity
      title,
      provider,
      category,
      durationMinutes: Number.isFinite(examDurationMin) ? examDurationMin : 60,
      totalQuestions: questions.length,
      sectionsLocked: locked,
      sections,
      questions,
    };

    fs.writeFileSync(path.join(OUT_DIR, slug + '.json'), JSON.stringify(record));
    manifest.push({
      slug,
      path: rel,
      title,
      provider,
      category,
      durationMinutes: record.durationMinutes,
      totalQuestions: record.totalQuestions,
      sectionsLocked: locked,
      hasSections: Array.isArray(sections),
    });
    ok++;
  }

  manifest.sort((a, b) => a.path.localeCompare(b.path));
  fs.writeFileSync(MANIFEST, JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, mocks: manifest }, null, 2));

  console.log(`\nExtraction complete: ${ok} mocks extracted -> ${path.relative(REPO_ROOT, OUT_DIR)}`);
  console.log(`Manifest: ${manifest.length} entries -> ${path.relative(REPO_ROOT, MANIFEST)}`);
  if (skipped.length) {
    console.log(`\nSkipped ${skipped.length} empty/broken shells (no question data) — matches legacy behaviour:`);
    skipped.slice(0, 20).forEach((s) => console.log(`  - ${s.path}  [${s.reason}]`));
    if (skipped.length > 20) console.log(`  ... and ${skipped.length - 20} more`);
  }
}

main();
