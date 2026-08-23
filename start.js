/**
 * Aether Mocks App - Mock Data & Test Generator & Startup Helper
 * ===============================================================
 * Generates `public/mocks-data.js` catalog and extracts question data into
 * `public/mocks/*.json` and `public/mocks-index.json` strictly within the app directory.
 *
 * Usage:
 *   node start.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_DIR = __dirname;
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const PARENT_PUBLIC_DIR = path.resolve(APP_DIR, '..', 'public');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'mocks-data.js');

const PATTERN_PREFIX = /^@the_solvers_/i;
const PATTERN_SUFFIX = /_\d{4,6}$/i;

function cleanName(filename) {
  const ext = path.extname(filename);
  let name = path.basename(filename, ext);
  name = name.replace(PATTERN_PREFIX, '');
  name = name.replace(PATTERN_SUFFIX, '');
  name = name.replace(/[_]/g, ' ').replace(/[-]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

function getSubject(category, name) {
  const catLower = (category || '').toLowerCase();
  const nameLower = (name || '').toLowerCase();

  const quantKeywords = ['quant', 'math', 'calc', 'mixt', 'allig', 'ratio', 'percent', 'prop'];
  const reasoningKeywords = ['reasoning', 'analog', 'odd one'];
  const englishKeywords = ['english', 'vocab', 'grammar'];
  const gsKeywords = ['gs', 'gk', 'history', 'geography', 'polity', 'science', 'current', 'affairs', 'banking'];
  const fullMockKeywords = ['full mock', 'pre mock', 'tier 1', 'tier 2', 'live mock'];

  if (quantKeywords.some(k => catLower.includes(k) || nameLower.includes(k))) return 'Quant';
  if (reasoningKeywords.some(k => catLower.includes(k) || nameLower.includes(k))) return 'Reasoning';
  if (englishKeywords.some(k => catLower.includes(k) || nameLower.includes(k))) return 'English';
  if (gsKeywords.some(k => catLower.includes(k) || nameLower.includes(k))) return 'General Studies';
  if (fullMockKeywords.some(k => catLower.includes(k) || nameLower.includes(k))) return 'Full Mock';
  return 'General';
}

function normalizeProvider(rawProvider) {
  const lower = (rawProvider || '').toLowerCase();
  if (lower === 'oliiveboardd' || lower === 'oliveboard') return 'Oliveboard';
  if (lower === 'pundiits' || lower === 'pundits') return 'Pundits';
  if (lower === 'the solver') return 'The Solver';
  return rawProvider || 'General';
}

function walkDir(dir, ignoredDirs = ['backup', 'node_modules', 'styles', 'scss', 'css', '.git', '.firebase', 'v2', 'dist', 'dist-electron', 'dist-installer', 'mocks']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirs.includes(entry.name.toLowerCase())) continue;
      results = results.concat(walkDir(fullPath, ignoredDirs));
    } else if (entry.isFile()) {
      if (entry.name.toLowerCase().endsWith('.html') && entry.name.toLowerCase() !== 'index.html') {
        results.push(fullPath);
      }
    }
  }
  return results;
}

export function generateMockData() {
  const targetDir = fs.existsSync(PARENT_PUBLIC_DIR) ? PARENT_PUBLIC_DIR : PUBLIC_DIR;
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target public directory not found at: ${targetDir}`);
  }

  const htmlFiles = walkDir(targetDir);
  const mocks = [];

  for (const filePath of htmlFiles) {
    const relPath = path.relative(targetDir, filePath).replace(/\\/g, '/');
    const parts = relPath.split('/');
    const rawProvider = parts[0];
    const provider = normalizeProvider(rawProvider);

    let category = "General";
    if (parts.length > 2) {
      category = parts.slice(1, -1).join('/');
    } else if (parts.length > 1) {
      category = parts[1];
    }

    const filename = path.basename(filePath);
    const cleanedName = cleanName(filename);
    const subject = getSubject(category, cleanedName);

    mocks.push({
      path: relPath,
      name: cleanedName,
      provider: provider,
      category: category,
      subject: subject
    });
  }

  mocks.sort((a, b) => {
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  const jsContent = `// Generated Mock Data\nconst MOCK_DATA = ${JSON.stringify(mocks, null, 2)};\nconst MOCK_PATH_MAP = {};\n`;
  
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, jsContent, 'utf-8');

  console.log(`[OK] Catalog generated: ${mocks.length} mocks indexed in ${path.relative(APP_DIR, OUTPUT_FILE)}`);
  return mocks;
}

export async function runFullGeneration() {
  console.log('===================================================');
  console.log('  Aether App - Generating Catalog & Mock Test Files');
  console.log('===================================================');

  const mocks = generateMockData();

  const extractScriptPath = path.join(APP_DIR, 'scripts', 'extract-mocks.mjs');
  if (fs.existsSync(extractScriptPath)) {
    try {
      const { extractAllMocks } = await import(`file://${extractScriptPath.replace(/\\/g, '/')}`);
      if (typeof extractAllMocks === 'function') {
        extractAllMocks();
      }
    } catch (e) {
      console.warn(`[WARN] Mock test extraction warning: ${e.message}`);
    }
  }

  console.log('===================================================');
  console.log(`[SUCCESS] All ${mocks.length} mock tests generated successfully.`);
  console.log('===================================================\n');
}

const isMain = Boolean(process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename));
if (isMain) {
  runFullGeneration().catch((err) => {
    console.error('Error generating mock tests:', err);
    process.exit(1);
  });
}
