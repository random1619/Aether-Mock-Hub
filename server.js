/**
 * Aether Mocks App - Full Multi-User Dynamic Backend Server
 * ==========================================================
 * Provides complete data isolation per user. Every user has their own unique:
 * - Mock Test Attempts history & timestamps
 * - Bookmarked / Saved Questions notebook
 * - Scheduled Alarms & Revision Timers
 * - Accuracy Analytics & Subject Mastery
 * - XP, Aspirant Level & Badges Progression
 * - User Preferences & Custom Goal Targets
 *
 * Data is persisted to JSON disk on Render, supporting offline syncing
 * and multi-client tenancy.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const APP_DIR = __dirname;
const PARENT_PUBLIC_DIR = path.resolve(APP_DIR, '..', 'public');
const LOCAL_PUBLIC_DIR = path.join(APP_DIR, 'public');
const PUBLIC_DIR = fs.existsSync(PARENT_PUBLIC_DIR) ? PARENT_PUBLIC_DIR : LOCAL_PUBLIC_DIR;
const DB_FILE = path.join(APP_DIR, 'aether-server-db.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Multi-User In-Memory Database with JSON Disk Persistence
let db = {
  version: 2,
  users: {},
  updatedAt: new Date().toISOString(),
};

function sanitizeUserId(rawId) {
  if (!rawId || typeof rawId !== 'string') return 'default_user';
  const clean = rawId.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return clean || 'default_user';
}

function getUserRecord(userId) {
  const uid = sanitizeUserId(userId);
  if (!db.users[uid]) {
    db.users[uid] = {
      id: uid,
      name: uid === 'default_user' ? 'Aspirant' : uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attempts: {},
      bookmarks: [],
      alarms: [],
      settings: {
        theme: 'light',
        dailyGoalQuestions: 50,
      },
      gamification: {
        xp: 0,
        level: 1,
        streakFreezes: 1,
        unlockedBadges: [],
      },
    };
  }
  return db.users[uid];
}

function loadDbFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      
      // Automatic migration from v1 legacy flat schema to v2 multi-user schema
      if (parsed.attempts && !parsed.users) {
        db.users = {
          default_user: {
            id: 'default_user',
            name: 'Aspirant',
            createdAt: parsed.updatedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attempts: parsed.attempts || {},
            bookmarks: parsed.bookmarks || [],
            alarms: parsed.alarms || [],
            settings: {},
            gamification: {},
          },
        };
      } else {
        db = { ...db, ...parsed, users: parsed.users || {} };
      }

      const userCount = Object.keys(db.users).length;
      const totalAttempts = Object.values(db.users).reduce(
        (sum, u) => sum + Object.values(u.attempts || {}).flat().length,
        0
      );
      console.log(`[DB] Loaded multi-user database: ${userCount} users, ${totalAttempts} total attempts`);
    }
  } catch (err) {
    console.warn('[DB] Failed to load db file, initializing fresh:', err.message);
  }
}

function saveDbToDisk() {
  try {
    db.updatedAt = new Date().toISOString();
    // Atomic write via temp file
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.warn('[DB] Failed to save db to disk:', err.message);
  }
}

loadDbFromDisk();

// Dynamic Mock Catalog Generator & Cache
let cachedCatalog = null;
let lastCatalogScan = 0;

function scanCatalog() {
  const now = Date.now();
  if (cachedCatalog && now - lastCatalogScan < 10000) {
    return cachedCatalog;
  }

  const mocks = [];
  const targetDir = PUBLIC_DIR;

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const lower = entry.name.toLowerCase();
        if (['node_modules', '.git', 'v2', 'dist', 'dist-electron', 'backup'].includes(lower)) continue;
        walk(full);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html') && entry.name.toLowerCase() !== 'index.html') {
        const rel = path.relative(targetDir, full).replace(/\\/g, '/');
        const parts = rel.split('/');
        const rawProvider = parts[0] || 'General';
        const provider = rawProvider.toLowerCase().includes('oliveboard') ? 'Oliveboard' : rawProvider.toLowerCase().includes('pundit') ? 'Pundits' : rawProvider;
        const cat = parts.length > 2 ? parts.slice(1, -1).join('/') : parts.length > 1 ? parts[1] : 'General';
        const rawName = path.basename(full, '.html').replace(/^@the_solvers_/i, '').replace(/_\d{4,6}$/i, '').replace(/[_-]/g, ' ').trim();
        
        let subject = 'General';
        const lowerName = rawName.toLowerCase();
        if (/quant|math|calc|ratio|percent|algebra/i.test(lowerName)) subject = 'Quant';
        else if (/reasoning|analogy|puzzle|series/i.test(lowerName)) subject = 'Reasoning';
        else if (/english|vocab|grammar|cloze|reading/i.test(lowerName)) subject = 'English';
        else if (/gk|gs|history|geography|science|current|polity/i.test(lowerName)) subject = 'General Studies';
        else if (/full|tier|mock\s*\d/i.test(lowerName)) subject = 'Full Mock';

        mocks.push({
          path: rel,
          name: rawName,
          provider,
          category: cat,
          subject,
        });
      }
    }
  }

  walk(targetDir);
  cachedCatalog = mocks.sort((a, b) => a.name.localeCompare(b.name));
  lastCatalogScan = now;
  return cachedCatalog;
}

// User-Scoped Analytics Aggregator
function computeUserAnalytics(user) {
  const allAttempts = Object.values(user.attempts || {}).flat();
  const total = allAttempts.length;
  if (total === 0) {
    return {
      userId: user.id,
      totalAttempts: 0,
      uniqueMocksAttempted: 0,
      overallAccuracy: 0,
      avgScore: 0,
      bestScore: 0,
      recentScores: [],
    };
  }

  const uniquePaths = new Set(Object.keys(user.attempts).filter((k) => user.attempts[k].length > 0));
  const avgAcc = Math.round(allAttempts.reduce((acc, a) => acc + (a.accuracy || 0), 0) / total);
  const avgScore = Number((allAttempts.reduce((acc, a) => acc + (a.score || 0), 0) / total).toFixed(1));
  const bestScore = Math.max(...allAttempts.map((a) => a.score || 0));

  const recent = allAttempts
    .slice()
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 15)
    .map((a) => ({
      date: a.submittedAt,
      score: a.score,
      maxScore: a.maxScore,
      accuracy: a.accuracy,
      provider: a.provider || 'General',
    }));

  return {
    userId: user.id,
    totalAttempts: total,
    uniqueMocksAttempted: uniquePaths.size,
    overallAccuracy: avgAcc,
    avgScore,
    bestScore,
    recentScores: recent,
  };
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Extract User ID from header, query param, or fallback
  const rawUserId =
    req.headers['x-user-id'] ||
    parsedUrl.searchParams.get('userId') ||
    parsedUrl.searchParams.get('user');
  const userId = sanitizeUserId(rawUserId);

  // -------------------------------------------------------------
  // REST API ROUTING
  // -------------------------------------------------------------

  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health & System
      if (pathname === '/api/health') {
        return sendJson(res, 200, {
          status: 'online',
          time: new Date().toISOString(),
          version: '2.5.0',
        });
      }

      if (pathname === '/api/system') {
        const catalog = scanCatalog();
        const user = getUserRecord(userId);
        const allUsers = Object.values(db.users);
        const totalAttempts = allUsers.reduce((sum, u) => sum + Object.values(u.attempts || {}).flat().length, 0);

        return sendJson(res, 200, {
          status: 'online',
          serverTime: new Date().toISOString(),
          uptimeSeconds: Math.floor(process.uptime()),
          totalMocks: catalog.length,
          totalRegisteredUsers: allUsers.length,
          totalGlobalAttempts: totalAttempts,
          currentUser: {
            id: user.id,
            name: user.name,
            totalAttempts: Object.values(user.attempts || {}).flat().length,
            totalBookmarks: user.bookmarks.length,
          },
          storageHealthy: true,
          version: '2.5.0',
        });
      }

      // 2. Mock Catalog (Dynamic Search & Filter)
      if (pathname === '/api/catalog') {
        let mocks = scanCatalog();
        const q = parsedUrl.searchParams.get('q');
        const provider = parsedUrl.searchParams.get('provider');
        const subject = parsedUrl.searchParams.get('subject');
        const category = parsedUrl.searchParams.get('category');

        if (provider) mocks = mocks.filter((m) => m.provider.toLowerCase() === provider.toLowerCase());
        if (subject) mocks = mocks.filter((m) => m.subject.toLowerCase() === subject.toLowerCase());
        if (category) mocks = mocks.filter((m) => m.category.toLowerCase().includes(category.toLowerCase()));
        if (q) {
          const ql = q.toLowerCase();
          mocks = mocks.filter((m) => m.name.toLowerCase().includes(ql) || m.path.toLowerCase().includes(ql));
        }

        return sendJson(res, 200, mocks);
      }

      // 3. User Profile CRUD
      if (pathname === '/api/user' && req.method === 'GET') {
        const user = getUserRecord(userId);
        return sendJson(res, 200, user);
      }

      if (pathname === '/api/user' && req.method === 'POST') {
        const payload = await readBody(req);
        const targetId = sanitizeUserId(payload.userId || userId);
        const user = getUserRecord(targetId);

        if (payload.name) user.name = payload.name;
        if (payload.settings) user.settings = { ...user.settings, ...payload.settings };
        if (payload.gamification) user.gamification = { ...user.gamification, ...payload.gamification };
        user.updatedAt = new Date().toISOString();

        saveDbToDisk();
        return sendJson(res, 200, { success: true, user });
      }

      // 4. Attempts CRUD (User-Scoped)
      if (pathname === '/api/attempts' && req.method === 'GET') {
        const user = getUserRecord(userId);
        return sendJson(res, 200, user.attempts);
      }

      if (pathname === '/api/attempts' && req.method === 'POST') {
        const payload = await readBody(req);
        const targetId = sanitizeUserId(payload.userId || userId);
        const user = getUserRecord(targetId);

        const { mockPath, attempt } = payload;
        if (!mockPath || !attempt) {
          return sendJson(res, 400, { error: 'mockPath and attempt required' });
        }

        const list = user.attempts[mockPath] || [];
        const exists = list.some((a) => a.submittedAt === attempt.submittedAt);
        if (!exists) {
          list.push(attempt);
          user.attempts[mockPath] = list.slice(-15); // keep up to 15 attempts per mock per user
          user.updatedAt = new Date().toISOString();
          saveDbToDisk();
        }
        return sendJson(res, 200, { success: true, count: list.length, userId: targetId });
      }

      // 5. Analytics (User-Scoped)
      if (pathname === '/api/analytics' && req.method === 'GET') {
        const user = getUserRecord(userId);
        return sendJson(res, 200, computeUserAnalytics(user));
      }

      // 6. Bookmarks CRUD (User-Scoped)
      if (pathname === '/api/bookmarks' && req.method === 'GET') {
        const user = getUserRecord(userId);
        return sendJson(res, 200, user.bookmarks);
      }

      if (pathname === '/api/bookmarks' && req.method === 'POST') {
        const payload = await readBody(req);
        const targetId = sanitizeUserId(payload.userId || userId);
        const user = getUserRecord(targetId);
        const bookmark = payload.bookmark || payload;

        if (!bookmark || !bookmark.id) {
          return sendJson(res, 400, { error: 'bookmark with valid id required' });
        }

        const idx = user.bookmarks.findIndex((b) => b.id === bookmark.id);
        if (idx >= 0) user.bookmarks[idx] = bookmark;
        else user.bookmarks.push(bookmark);
        user.updatedAt = new Date().toISOString();

        saveDbToDisk();
        return sendJson(res, 200, { success: true, total: user.bookmarks.length, userId: targetId });
      }

      if (pathname.startsWith('/api/bookmarks/') && req.method === 'DELETE') {
        const user = getUserRecord(userId);
        const id = decodeURIComponent(pathname.replace('/api/bookmarks/', ''));
        user.bookmarks = user.bookmarks.filter((b) => b.id !== id);
        user.updatedAt = new Date().toISOString();
        saveDbToDisk();
        return sendJson(res, 200, { success: true, total: user.bookmarks.length, userId });
      }

      // 7. Alarms CRUD (User-Scoped)
      if (pathname === '/api/alarms' && req.method === 'GET') {
        const user = getUserRecord(userId);
        return sendJson(res, 200, user.alarms);
      }

      if (pathname === '/api/alarms' && req.method === 'POST') {
        const payload = await readBody(req);
        const targetId = sanitizeUserId(payload.userId || userId);
        const user = getUserRecord(targetId);
        const alarm = payload.alarm || payload;

        if (!alarm || !alarm.id) return sendJson(res, 400, { error: 'alarm with id required' });
        const idx = user.alarms.findIndex((a) => a.id === alarm.id);
        if (idx >= 0) user.alarms[idx] = alarm;
        else user.alarms.push(alarm);
        user.updatedAt = new Date().toISOString();

        saveDbToDisk();
        return sendJson(res, 200, { success: true, alarms: user.alarms, userId: targetId });
      }

      if (pathname.startsWith('/api/alarms/') && req.method === 'DELETE') {
        const user = getUserRecord(userId);
        const id = decodeURIComponent(pathname.replace('/api/alarms/', ''));
        user.alarms = user.alarms.filter((a) => a.id !== id);
        user.updatedAt = new Date().toISOString();
        saveDbToDisk();
        return sendJson(res, 200, { success: true, alarms: user.alarms, userId });
      }

      // 8. Two-Way Sync (User-Scoped)
      if (pathname === '/api/sync' && req.method === 'POST') {
        const payload = await readBody(req);
        const targetId = sanitizeUserId(payload.userId || userId);
        const user = getUserRecord(targetId);
        const incomingAttempts = payload.attempts || {};
        let merged = 0;

        Object.entries(incomingAttempts).forEach(([p, arr]) => {
          if (Array.isArray(arr)) {
            const currentList = user.attempts[p] || [];
            arr.forEach((incomingAtt) => {
              if (!currentList.some((c) => c.submittedAt === incomingAtt.submittedAt)) {
                currentList.push(incomingAtt);
                merged++;
              }
            });
            user.attempts[p] = currentList.slice(-15);
          }
        });

        // Sync bookmarks if present
        if (Array.isArray(payload.bookmarks)) {
          payload.bookmarks.forEach((bm) => {
            if (bm && bm.id && !user.bookmarks.some((b) => b.id === bm.id)) {
              user.bookmarks.push(bm);
              merged++;
            }
          });
        }

        // Sync gamification state if present
        if (payload.gamification) {
          user.gamification = { ...user.gamification, ...payload.gamification };
        }

        if (merged > 0 || payload.gamification) {
          user.updatedAt = new Date().toISOString();
          saveDbToDisk();
        }

        return sendJson(res, 200, {
          success: true,
          merged,
          userId: targetId,
          attempts: user.attempts,
          bookmarks: user.bookmarks,
          gamification: user.gamification,
        });
      }

      return sendJson(res, 404, { error: `API route ${pathname} not found` });
    } catch (err) {
      console.error('[API Error]', err);
      return sendJson(res, 500, { error: 'Internal Server Error', message: err.message });
    }
  }

  // -------------------------------------------------------------
  // STATIC FILE SERVING & SPA FALLBACK
  // -------------------------------------------------------------

  if (pathname === '/' || pathname === '') {
    res.writeHead(302, { Location: '/v2/' });
    res.end();
    return;
  }

  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // SPA fallback for /v2/* routes
  if (!fs.existsSync(filePath) && pathname.startsWith('/v2/')) {
    const v2Fallback = path.join(PUBLIC_DIR, 'v2', 'index.html');
    if (fs.existsSync(v2Fallback)) {
      filePath = v2Fallback;
    }
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mimeType,
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
});

const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`  🚀 Aether Multi-User Backend Server Live on Port ${PORT}`);
  console.log(`  🔗 REST API: http://${HOST}:${PORT}/api/`);
  console.log(`  📦 Static & Mocks: http://${HOST}:${PORT}/`);
  console.log(`=======================================================`);
});
