/**
 * Aether Mocks — Build-time Mock Extractor
 * =====================================================================
 * Parses every static mock HTML under public/**, evaluates its
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
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'mocks');
const MANIFEST = path.resolve(__dirname, '..', 'public', 'mocks-index.json');
const OUT_DIR_PUBLIC = path.resolve(PUBLIC, 'mocks');
const MANIFEST_PUBLIC = path.resolve(PUBLIC, 'mocks-index.json');

/* ── Section classification — ported 1:1 from js/engine/sections.js ── */
function classifyExamPattern(totalQuestions) {
  // SSC CGL Tier 1 latest: 4 sections × 15 mins = 60 mins, sectional locks enabled
  if (totalQuestions >= 95 && totalQuestions <= 105) {
    const qPerSec = Math.floor(totalQuestions / 4);
    const rem = totalQuestions % 4;
    const s1Cnt = qPerSec + (rem > 0 ? 1 : 0);
    const s2Cnt = qPerSec + (rem > 1 ? 1 : 0);
    const s3Cnt = qPerSec + (rem > 2 ? 1 : 0);
    const s4Cnt = qPerSec + (rem > 3 ? 1 : 0);
    return {
      type: 'tier1',
      locked: true,
      sections: [
        { name: 'General Intelligence & Reasoning', start: 0, count: s1Cnt, timer: 15 },
        { name: 'General Awareness', start: s1Cnt, count: s2Cnt, timer: 15 },
        { name: 'Quantitative Aptitude', start: s1Cnt + s2Cnt, count: s3Cnt, timer: 15 },
        { name: 'English Comprehension', start: s1Cnt + s2Cnt + s3Cnt, count: s4Cnt, timer: 15 },
      ],
    };
  }
  // Single-section 25Q → 15 mins sectional (SSC sectional practice)
  if (totalQuestions === 25) {
    return {
      type: 'sectional25',
      locked: true,
      sections: [
        { name: 'Practice Section', start: 0, count: 25, timer: 15 },
      ],
    };
  }
  if (totalQuestions > 20 && totalQuestions < 30) {
    return {
      type: 'sectional',
      locked: true,
      sections: [
        { name: 'Section', start: 0, count: totalQuestions, timer: 15 },
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
  // Provide minimal browser globals so page logic (document.*) after the data
  // definition doesn't throw and prevent the data capture. The HTML now
  // bundles `const questions = [...]` and page JS in one inline script.
  const fakeEl = () => ({
    style: {},
    innerHTML: '',
    textContent: '',
    innerText: '',
    appendChild() { return this; },
    setAttribute() {},
    getAttribute() { return null; },
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return fakeEl(); },
    querySelectorAll() { return []; },
    classList: { add(){}, remove(){}, contains(){return false}, toggle(){} },
  });
  const fakeDoc = {
    addEventListener() {},
    getElementById() { return fakeEl(); },
    querySelector() { return fakeEl(); },
    querySelectorAll() { return []; },
    createElement() { return fakeEl(); },
    body: fakeEl(),
    documentElement: fakeEl(),
  };
  const sandbox = {
    window: { document: fakeDoc, addEventListener() {} },
    document: fakeDoc,
    console,
    localStorage: { getItem() { return null; }, setItem() {} },
    navigator: {},
    location: {},
    setTimeout() {},
    setInterval() {},
  };
  sandbox.globalThis = sandbox;
  sandbox.window.globalThis = sandbox;
  vm.createContext(sandbox);
  const program = scriptBodies.join('\n;\n') + `
    ;(() => {
      const out = {};
      try { if (typeof questions !== 'undefined') out.questions = questions; } catch (e) {}
      try { if (typeof window.questions !== 'undefined') out.questions = out.questions || window.questions; } catch (e) {}
      try { if (typeof QUESTIONS !== 'undefined') out.questions = out.questions || QUESTIONS; } catch (e) {}
      try { if (typeof QUIZ_DATA !== 'undefined') out.questions = out.questions || (Array.isArray(QUIZ_DATA) ? QUIZ_DATA : QUIZ_DATA.questions); } catch (e) {}
      try { if (typeof quizData !== 'undefined') out.questions = out.questions || (Array.isArray(quizData) ? quizData : quizData.questions); } catch (e) {}
      try { if (typeof testData !== 'undefined') out.questions = out.questions || (Array.isArray(testData) ? testData : testData.questions); } catch (e) {}
      try { if (typeof examData !== 'undefined') out.questions = out.questions || (Array.isArray(examData) ? examData : examData.questions); } catch (e) {}
      try { if (typeof this !== 'undefined' && this.qs) out.questions = out.questions || this.qs; } catch (e) {}
      try { if (typeof sectionsData !== 'undefined') out.sectionsData = sectionsData; } catch (e) {}
      try { if (typeof window.sectionsData !== 'undefined') out.sectionsData = out.sectionsData || window.sectionsData; } catch (e) {}
      return JSON.stringify(out);
    })()`;
  try {
    const json = vm.runInContext(program, sandbox, { timeout: 2000 });
    const parsed = JSON.parse(json || '{}');
    if (parsed.questions && parsed.questions.length) return parsed;
    // VM succeeded but found nothing — fall through to regex fallback
    if (!parsed.__error) parsed.__error = 'no-questions-via-vm';
    // don't return yet, try regex
    const fallback = tryRegexExtract(scriptBodies.join('\n'));
    if (fallback) return fallback;
    return parsed;
  } catch (e) {
    const fallback = tryRegexExtract(scriptBodies.join('\n'));
    if (fallback) return fallback;
    return { __error: String(e && e.message || e) };
  }
}

function tryRegexExtract(combined) {
  // Direct bracket-match for `const questions = [...]` without executing page JS.
  // Mirrors src/services/mockParser bracket logic. Also handles this.qs and testData
  // First handle testData object which contains questions array inside
  const testDataRe = /testData\s*=\s*\{/;
  const tdMatch = testDataRe.exec(combined);
  if(tdMatch){
    const objStart = tdMatch.index + tdMatch[0].length - 1; // at {
    let depth=0,inStr=null,escaped=false;
    let questionsArrayRaw = null;
    for(let i=objStart;i<combined.length;i++){
      const ch=combined[i];
      if(inStr){ if(escaped) escaped=false; else if(ch==='\\') escaped=true; else if(ch===inStr) inStr=null; continue; }
      if(ch==='"'||ch==="'"||ch==='`') inStr=ch;
      else if(ch==='{') depth++;
      else if(ch==='}'){ depth--; if(depth===0){
        // Found end of testData object, extract questions array inside
        const objRaw = combined.slice(objStart, i+1);
        const qArrMatch = objRaw.match(/"questions"\s*:\s*(\[[\s\S]*\])/);
        if(qArrMatch){
          try{
            const arr = JSON.parse(qArrMatch[1]);
            if(Array.isArray(arr) && arr.length) return { questions: arr };
          }catch{
            try{
              const cleaned = qArrMatch[1].replace(/,\s*([}\]])/g,'$1');
              const arr = JSON.parse(cleaned);
              if(Array.isArray(arr) && arr.length) return { questions: arr };
            }catch{}
          }
        }
        break;
      }}
    }
  }
  const varRes = [
    /(?:const|let|var)\s+(?:questions|QUESTIONS|QUIZ_DATA)\s*=\s*\[/,
    /this\.qs\s*=\s*\[/,
    /this\.questions\s*=\s*\[/,
  ];
  for(const varRe of varRes){
    const m = varRe.exec(combined);
    if (!m) continue;
    const start = m.index + m[0].length - 1;
    let depth = 0, inStr = null, escaped = false;
    for (let i = start; i < combined.length; i++) {
      const ch = combined[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          const raw = combined.slice(start, i + 1);
          try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length) return { questions: arr };
          } catch {}
          try {
            const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
            const arr = JSON.parse(cleaned);
            if (Array.isArray(arr) && arr.length) return { questions: arr };
          } catch {}
          break;
        }
      }
    }
  }
  return null;
}

// DOM q-card extraction for Mocks Wallah Direction etc. - parses rendered HTML
function extractLangEnQuestions(html){
  // For Computer Awareness en.html style: <div class="question lang-en"> + <div class="lang-en"><div class="option">
  if(!html.includes('class="question lang-en"')) return null;
  const questions=[];
  // Split by question blocks
  const qBlocks = html.split(/<div class="question lang-en">/);
  for(let i=1;i<qBlocks.length;i++){
    const block = '<div class="question lang-en">' + qBlocks[i];
    // Extract question text until next <!-- OPTIONS --> or <div class="lang-en">
    const qTextMatch = block.match(/<div class="question lang-en">([\s\S]*?)<\/div>/);
    const qText = qTextMatch ? qTextMatch[1].trim() : '';
    // Extract options: look for <div class="lang-en"> containing options
    const langEnMatch = block.match(/<div class="lang-en">([\s\S]*?)<\/div>\s*<div class="lang-hi">/);
    const options = [];
    let correctIdx = 0;
    if(langEnMatch){
      const optHtml = langEnMatch[1];
      const optRe = /<div class="option([^"]*)">([\s\S]*?)<\/div>/g;
      let om, idx=0;
      while((om=optRe.exec(optHtml))!==null){
        const cls = om[1] || '';
        const text = om[2].replace(/<[^>]+>/g,'').trim();
        if(text) {
          options.push(text);
          if(cls.includes('correct')) correctIdx = idx;
          idx++;
        }
      }
    }
    // Solution
    const solMatch = block.match(/<div class="solution">([\s\S]*?)<\/div>\s*<\/div>/);
    const sol = solMatch ? solMatch[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,500) : '';
    if(qText && options.length){
      questions.push({
        question: qText,
        options,
        correct_option_id: correctIdx,
        solution: sol,
        marks: 2,
      });
    }
    if(questions.length>500) break;
  }
  if(questions.length) return {questions};
  return null;
}

function extractDomQCards(html){
  if(!html.includes('class="q-card"')) return null;
  // Extract test.correct mapping first
  let correctMap = {};
  let marksMap = {};
  const correctMatch = html.match(/correct\s*:\s*\{([\s\S]*?)\}\s*,/);
  if(correctMatch){
    try{
      // crude parse: "id": 1, "id": 3 etc
      const body = '{' + correctMatch[1] + '}';
      // Try to eval as JS object via Function
      const obj = Function('"use strict"; return (' + body + ')')();
      correctMap = obj;
    }catch{}
  }
  const marksMatch = html.match(/marks\s*:\s*\{([\s\S]*?)\}\s*,/);
  // marks not needed for extraction but could be used

  const qCards = [];
  const re = /<div class="q-card"[^>]*id="q([^"]+)"[^>]*data-qnum="(\d+)"[^>]*data-section="(\d+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  // Fallback: split by q-card
  const parts = html.split(/<div class="q-card"/);
  for(let i=1;i<parts.length;i++){
    const block = '<div class="q-card"' + parts[i];
    // Extract id
    const idM = block.match(/id="q([^"]+)"/);
    const qnumM = block.match(/data-qnum="(\d+)"/);
    const sectionM = block.match(/data-section="(\d+)"/);
    const qTextM = block.match(/class="q-text"[^>]*>([\s\S]*?)<\/div>\s*<div class="options">/);
    const options = [];
    const optRe = /class="option-text"[^>]*>([\s\S]*?)<\/div>/g;
    let om;
    while((om=optRe.exec(block))!==null){
      options.push(om[1].trim());
    }
    const solM = block.match(/class="solution-content"[^>]*>([\s\S]*?)<\/div>/);
    const qText = qTextM ? qTextM[1].trim() : '';
    const sol = solM ? solM[1].trim() : '';
    if(!qText && options.length===0) continue;
    const id = idM ? idM[1] : `dom_${i}`;
    const correct = correctMap[id] !== undefined ? correctMap[id] : 0;
    // Try to get section name from header
    const secNameM = block.match(/class="q-section"[^>]*>([^<]+)<\/div>/);
    const secName = secNameM ? secNameM[1].trim() : '';
    qCards.push({
      question: qText,
      options,
      correct_option_id: typeof correct === 'number' ? correct : 0,
      solution: sol,
      marks: 2,
      section: secName || undefined,
    });
    // prevent infinite: break if too many
    if(qCards.length>500) break;
  }
  if(qCards.length) return {questions: qCards};
  return null;
}

/* ── Question normalisation ── */
function normaliseQuestions(raw, examData) {
  if (Array.isArray(raw)) return raw;
  if (examData && Array.isArray(examData.sections)) {
    const flat = [];
    examData.sections.forEach((sec) => (sec.questions || []).forEach((q) => flat.push(q)));
    return flat;
  }
  return [];
}

function cleanQuestion(q) {
  // Handle testData format: question_text, correct_answer (1-based), explanation, marks object
  let options = Array.isArray(q.options) ? q.options : [];
  // Clean options that contain "1) text <input..." - strip the "1) " prefix and input HTML
  options = options.map(opt => {
    let s = String(opt);
    // Remove leading "1) ", "2) " etc and any <input> tag
    s = s.replace(/^\s*\d+\)\s*/, '').replace(/<input[^>]*>/gi, '').replace(/<span class="checkmark[^>]*>.*?<\/span>/gi, '').trim();
    // Remove empty checkmarks
    s = s.replace(/\s+/g, ' ').trim();
    return s || opt;
  });
  // Handle correct_answer 1-based -> 0-based
  let correct = q.correct_option_id ?? q.correctIndex ?? q.correct ?? q.answer ?? q.correct_option ?? q.correct_answer ?? null;
  if (typeof correct === 'string' && /^[a-dA-D]$/.test(correct.trim())) {
    correct = correct.trim().toLowerCase().charCodeAt(0) - 97;
  } else if (q.correct_answer !== undefined && q.correct_option_id === undefined && q.correctIndex === undefined) {
    // testData uses 1-based correct_answer
    const ca = parseInt(String(q.correct_answer), 10);
    if (!Number.isNaN(ca)) correct = ca - 1;
  }
  // Handle question_text and word
  let question = q.question ?? q.text ?? q.question_text ?? '';
  if (!question && q.word) {
    question = `Select the synonym/meaning of: <b>${q.word}</b>`;
  } else if (!question && q.sentence) {
    question = [q.instr, q.sentence].filter(Boolean).join('<br>');
  }
  const solution = q.solution ?? q.explanation ?? q.sol ?? q.exp ?? q.correct_option ?? '';
  // Handle marks object {positive:2, negative:0.5} or number
  let marks = 2.0;
  if (q.marks !== undefined) {
    if (typeof q.marks === 'object' && q.marks.positive !== undefined) marks = parseFloat(q.marks.positive);
    else marks = parseFloat(q.marks);
  } else if (q.marks_per_question !== undefined) {
    marks = parseFloat(q.marks_per_question);
  }
  if (!Number.isFinite(marks)) marks = 2.0;
  return {
    question,
    options,
    correct_option_id: typeof correct === 'number' ? correct : (parseInt(String(correct), 10) || 0),
    solution,
    marks,
    section: q.section ?? q.subject ?? null,
  };
}

/* ── Filesystem walk ── */
const IGNORED_DIRS = ['v2', 'mocks', 'dist', 'dist-electron', 'dist-installer', 'node_modules', '.git', '.firebase', '.claude', '.mimocode', '.superpowers', 'backup', 'styles', 'scss', 'css'];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.includes(entry.name.toLowerCase())) {
        walk(full, acc);
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html') && entry.name.toLowerCase() !== 'index.html') {
      acc.push(full);
    }
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
export function extractAllMocks() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR_PUBLIC, { recursive: true });
  const appPublicDir = path.resolve(__dirname, '..', 'public');
  const rootFiles = walk(PUBLIC).map(f => ({ full: f, rel: path.relative(PUBLIC, f).replace(/\\/g, '/') }));
  const appFiles = walk(appPublicDir).map(f => ({ full: f, rel: path.relative(appPublicDir, f).replace(/\\/g, '/') }));
  
  // Combine unique by relative path
  const fileMap = new Map();
  for (const item of [...rootFiles, ...appFiles]) {
    if (!fileMap.has(item.rel)) fileMap.set(item.rel, item.full);
  }

  const manifest = [];
  const skipped = [];
  let ok = 0;

  for (const [rel, file] of fileMap.entries()) {
    const html = fs.readFileSync(file, 'utf8');
    const bodies = extractInlineDataScripts(html);
    let data = bodies.length ? evalMockData(bodies) : { __error: 'no-inline-script' };
    // Fallback: try DOM q-card extraction for Mocks Wallah Direction etc.
    if(!data.questions || !data.questions.length){
      const dom = extractDomQCards(html);
      if(dom && dom.questions.length) data = dom;
    }
    // Fallback: try lang-en question format (Computer Awareness en.html)
    if(!data.questions || !data.questions.length){
      const langEn = extractLangEnQuestions(html);
      if(langEn && langEn.questions.length) data = langEn;
    }
    // Fallback: try this.qs array directly from full HTML (SUPER PRACTICE)
    if(!data.questions || !data.questions.length){
      const qsFromHtml = tryRegexExtract(html);
      if(qsFromHtml && qsFromHtml.questions.length) data = qsFromHtml;
    }

    const rawQuestions = normaliseQuestions(data.questions, data.examData);
    if (!rawQuestions.length) {
      skipped.push({ path: rel, reason: data.__error || 'no-questions' });
      continue;
    }

    const questions = rawQuestions.map(cleanQuestion);
    const examDurationMin = extractExamDuration(html);
    const { locked, sections } = buildSections(questions.length, data.sectionsData, examDurationMin);

    const parts = rel.split('/');
    const provider = parts[0] || 'Unknown';
    const category = parts.length > 2 ? parts.slice(1, -1).join('/') : (parts[1] || 'General');
    const title = extractTitle(html) || path.basename(file, '.html');

    const slug = slugify(rel);
    const record = {
      version: 1,
      slug,
      path: rel,
      title,
      provider,
      category,
      durationMinutes: Number.isFinite(examDurationMin) ? examDurationMin : 60,
      totalQuestions: questions.length,
      sectionsLocked: locked,
      sections,
      questions,
    };

    const jsonContent = JSON.stringify(record);
    fs.writeFileSync(path.join(OUT_DIR, slug + '.json'), jsonContent);
    fs.writeFileSync(path.join(OUT_DIR_PUBLIC, slug + '.json'), jsonContent);

    function getSubject(cat, nam) {
      const catLower = (cat || '').toLowerCase();
      const nameLower = (nam || '').toLowerCase();
      if (['quant', 'math', 'calc', 'mixt', 'allig', 'ratio', 'percent', 'prop', 'geometry', 'algebra', 'trig', 'arithmetic', 'number system'].some(k => catLower.includes(k) || nameLower.includes(k))) return 'Quant';
      if (['reasoning', 'analog', 'odd one', 'syllogism', 'coding', 'blood relation', 'puzzle', 'direction'].some(k => catLower.includes(k) || nameLower.includes(k))) return 'Reasoning';
      if (['english', 'vocab', 'grammar', 'comprehension', 'synonym', 'antonym', 'idiom', 'error', 'cloze'].some(k => catLower.includes(k) || nameLower.includes(k))) return 'English';
      if (['gs', 'gk', 'history', 'geography', 'polity', 'science', 'current', 'affairs', 'banking', 'computer', 'static'].some(k => catLower.includes(k) || nameLower.includes(k))) return 'General Studies';
      if (['full mock', 'pre mock', 'tier 1', 'tier 2', 'live mock', 'cgl', 'chsl', 'mts'].some(k => catLower.includes(k) || nameLower.includes(k))) return 'Full Mock';
      return 'General';
    }

    manifest.push({
      slug,
      path: rel,
      title,
      name: title,
      provider,
      category,
      subject: getSubject(category, title),
      durationMinutes: record.durationMinutes,
      totalQuestions: record.totalQuestions,
      sectionsLocked: locked,
      hasSections: Array.isArray(sections),
    });
    ok++;
  }

  manifest.sort((a, b) => a.path.localeCompare(b.path));
  const manifestContent = JSON.stringify({ generatedAt: new Date().toISOString(), count: manifest.length, mocks: manifest }, null, 2);
  fs.writeFileSync(MANIFEST, manifestContent);
  fs.writeFileSync(MANIFEST_PUBLIC, manifestContent);

  const mockDataEntries = manifest.map(m => ({
    path: m.path,
    name: m.name || m.title,
    provider: m.provider,
    category: m.category,
    subject: m.subject,
    totalQuestions: m.totalQuestions,
    durationMinutes: m.durationMinutes
  }));
  const mockDataJs = `// Generated Mock Data\nconst MOCK_DATA = ${JSON.stringify(mockDataEntries, null, 2)};\n`;
  fs.writeFileSync(path.resolve(__dirname, '..', 'public', 'mocks-data.js'), mockDataJs);
  fs.writeFileSync(path.resolve(PUBLIC, 'mocks-data.js'), mockDataJs);

  console.log(`\nExtraction complete: ${ok} mocks extracted -> ${path.relative(REPO_ROOT, OUT_DIR)}`);
  console.log(`Manifest: ${manifest.length} entries -> ${path.relative(REPO_ROOT, MANIFEST)}`);
  console.log(`MOCK_DATA: ${mockDataEntries.length} verified mocks emitted to mocks-data.js`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} empty/shell HTML files (no inline question data).`);
    console.log('Skipped sample:', skipped.slice(0,15).map(s=> s.path + ' ('+s.reason+')').join('\n'));
  }
  return { count: ok, manifestLength: manifest.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  extractAllMocks();
}
