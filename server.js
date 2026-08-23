import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const APP_DIR = __dirname;
const PARENT_PUBLIC_DIR = path.resolve(APP_DIR, '..', 'public');
const LOCAL_PUBLIC_DIR = path.join(APP_DIR, 'public');
const PUBLIC_DIR = fs.existsSync(PARENT_PUBLIC_DIR) ? PARENT_PUBLIC_DIR : LOCAL_PUBLIC_DIR;
const MAX_BODY_BYTES = 10 * 1024 * 1024;

/** Path to the flat-file JSON database. */
const DB_PATH = path.join(APP_DIR, 'aether-server-db.json');
/** Staging path used for atomic writes (write here, then rename). */
const DB_STAGING_PATH = `${DB_PATH}.next`;

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

const DEFAULT_STATE = Object.freeze({
  attempts: {},
  bookmarks: [],
  alarms: [],
  settings: { theme: 'light', dailyGoalQuestions: 50 },
  gamification: { xp: 0, level: 1, streakFreezes: 1, unlockedBadges: [] },
  completed: {},
  myList: [],
  bookmarkFolders: [],
  examProgress: {},
});

let cachedCatalog = null;
let lastCatalogScan = 0;

// ---------------------------------------------------------------------------
// Flat-file JSON store
// ---------------------------------------------------------------------------

/**
 * In-memory database.
 * Shape: { users: User[], states: Record<userId, StateDoc>, operations: OpDoc[] }
 *
 * users[]  — { id, loginId, name, passwordHash, createdAt, updatedAt }
 * states   — { [userId]: { userId, state, revision, createdAt, updatedAt } }
 * operations[] — { userId, operationId, type, createdAt }
 */
let _db = { users: [], states: {}, operations: [] };

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      _db = {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        states: (parsed.states && typeof parsed.states === 'object' && !Array.isArray(parsed.states)) ? parsed.states : {},
        operations: Array.isArray(parsed.operations) ? parsed.operations : [],
      };
      console.log(`[DB] Loaded file store from ${DB_PATH} (${_db.users.length} users).`);
    } else {
      console.log(`[DB] No existing store found — starting fresh at ${DB_PATH}.`);
    }
  } catch (error) {
    console.error('[DB] Failed to load store; starting fresh.', error);
    _db = { users: [], states: {}, operations: [] };
  }
}

function persistDb() {
  try {
    const serialized = JSON.stringify(_db, null, 2);
    fs.writeFileSync(DB_STAGING_PATH, serialized, 'utf8');
    fs.renameSync(DB_STAGING_PATH, DB_PATH);
  } catch (error) {
    console.error('[DB] Failed to persist store.', error);
  }
}

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneDefaultState() {
  return structuredClone(DEFAULT_STATE);
}

function normalizeLoginId(rawLoginId) {
  if (typeof rawLoginId !== 'string') return null;
  const loginId = rawLoginId.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{2,63}$/.test(loginId) ? loginId : null;
}

function normalizeName(rawName, fallback) {
  if (typeof rawName !== 'string') return fallback;
  const name = rawName.trim().replace(/\s+/g, ' ').slice(0, 100);
  return name || fallback;
}

function publicUser(user) {
  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createToken(user) {
  return jwt.sign({ sub: user.id, loginId: user.loginId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'aether-mocks-api',
    audience: 'aether-mocks-client',
  });
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function corsHeaders(req) {
  const requestOrigin = req.headers.origin;
  let allowOrigin = CORS_ORIGIN;
  if (CORS_ORIGIN !== '*' && requestOrigin) {
    const allowedOrigins = CORS_ORIGIN.split(',').map((value) => value.trim());
    allowOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0];
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    Vary: 'Origin',
  };
}

function sendJson(req, res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(req) });
  res.end(JSON.stringify(data));
}

function sendNoContent(req, res) {
  res.writeHead(204, corsHeaders(req));
  res.end();
}

function sendError(req, res, error) {
  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
  const message = error instanceof ApiError ? error.message : 'Internal Server Error';
  const payload = { error: { code, message } };
  if (error instanceof ApiError && error.details !== undefined) payload.error.details = error.details;
  if (status >= 500) console.error('[API Error]', error);
  sendJson(req, res, status, payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 10 MB.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (size === 0) return resolve({});
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!isPlainObject(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
        resolve(body);
      } catch (error) {
        reject(error instanceof ApiError ? error : new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateEntityList(value, label) {
  if (!Array.isArray(value)) throw new ApiError(400, 'VALIDATION_ERROR', `${label} must be an array.`);
  for (const item of value) {
    if (!isPlainObject(item) || typeof item.id !== 'string' || !item.id.trim()) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Each ${label} item must have a non-empty string id.`);
    }
  }
}

function validateState(value) {
  if (!isPlainObject(value)) throw new ApiError(400, 'VALIDATION_ERROR', 'state must be a JSON object.');
  const required = ['attempts', 'bookmarks', 'alarms', 'settings', 'gamification', 'completed', 'myList', 'bookmarkFolders'];
  const missing = required.filter((key) => !(key in value));
  if (missing.length) throw new ApiError(400, 'VALIDATION_ERROR', 'state is missing required fields.', { missing });
  // examProgress was added after the first cloud client. Accept its absence for a
  // safe rolling deployment, but always persist and return the complete state.
  const state = { ...cloneDefaultState(), ...structuredClone(value) };
  if (!isPlainObject(state.attempts) || Object.values(state.attempts).some((attempts) => !Array.isArray(attempts))) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'state.attempts must be a record of arrays.');
  }
  validateEntityList(state.bookmarks, 'bookmarks');
  validateEntityList(state.alarms, 'alarms');
  validateEntityList(state.bookmarkFolders, 'bookmarkFolders');
  if (!isPlainObject(state.settings) || !isPlainObject(state.gamification) || !isPlainObject(state.completed) || !isPlainObject(state.examProgress)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'settings, gamification, completed, and examProgress must be objects.');
  }
  if (!Array.isArray(state.myList) || state.myList.some((item) => typeof item !== 'string')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'state.myList must be an array of strings.');
  }
  return state;
}

function validatePatch(payload, field) {
  if (!isPlainObject(payload)) throw new ApiError(400, 'VALIDATION_ERROR', `${field} patch must be a JSON object.`);
  return structuredClone(payload);
}

// ---------------------------------------------------------------------------
// Entity list helpers
// ---------------------------------------------------------------------------

function upsertEntity(list, entity, label) {
  if (!isPlainObject(entity) || typeof entity.id !== 'string' || !entity.id.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', `${label} must include a non-empty string id.`);
  }
  const index = list.findIndex((item) => item.id === entity.id);
  if (index === -1) list.push(structuredClone(entity));
  else list[index] = structuredClone(entity);
}

function deleteEntity(list, id, label) {
  if (typeof id !== 'string' || !id.trim()) throw new ApiError(400, 'VALIDATION_ERROR', `${label} id is required.`);
  const index = list.findIndex((item) => item.id === id);
  if (index !== -1) list.splice(index, 1);
}

function applyOperation(state, operation) {
  if (!isPlainObject(operation) || typeof operation.id !== 'string' || !operation.id.trim() || typeof operation.type !== 'string') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Each operation requires a non-empty id and type.');
  }
  const payload = operation.payload;
  switch (operation.type) {
    case 'attempt.upsert': {
      if (!isPlainObject(payload) || typeof payload.mockPath !== 'string' || !payload.mockPath || !isPlainObject(payload.attempt)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'attempt.upsert requires payload.mockPath and payload.attempt.');
      }
      const attempts = state.attempts[payload.mockPath] || [];
      const submittedAt = payload.attempt.submittedAt;
      if (typeof submittedAt !== 'string' || !submittedAt) throw new ApiError(400, 'VALIDATION_ERROR', 'attempt.submittedAt is required.');
      const index = attempts.findIndex((attempt) => attempt.submittedAt === submittedAt);
      if (index === -1) attempts.push(structuredClone(payload.attempt));
      else attempts[index] = structuredClone(payload.attempt);
      state.attempts[payload.mockPath] = attempts.slice(-15);
      return state;
    }
    case 'attempt.delete': {
      if (!isPlainObject(payload) || typeof payload.mockPath !== 'string' || typeof payload.submittedAt !== 'string') {
        throw new ApiError(400, 'VALIDATION_ERROR', 'attempt.delete requires payload.mockPath and payload.submittedAt.');
      }
      const attempts = state.attempts[payload.mockPath] || [];
      state.attempts[payload.mockPath] = attempts.filter((attempt) => attempt.submittedAt !== payload.submittedAt);
      if (state.attempts[payload.mockPath].length === 0) delete state.attempts[payload.mockPath];
      return state;
    }
    case 'bookmark.upsert': upsertEntity(state.bookmarks, payload, 'bookmark'); return state;
    case 'bookmark.delete': deleteEntity(state.bookmarks, payload?.id, 'bookmark'); return state;
    case 'alarm.upsert': upsertEntity(state.alarms, payload, 'alarm'); return state;
    case 'alarm.delete': deleteEntity(state.alarms, payload?.id, 'alarm'); return state;
    case 'settings.patch': state.settings = { ...state.settings, ...validatePatch(payload, 'settings') }; return state;
    case 'gamification.patch': state.gamification = { ...state.gamification, ...validatePatch(payload, 'gamification') }; return state;
    case 'completed.patch': state.completed = { ...state.completed, ...validatePatch(payload, 'completed') }; return state;
    case 'examProgress.patch': state.examProgress = { ...state.examProgress, ...validatePatch(payload, 'examProgress') }; return state;
    case 'myList.replace':
      if (!Array.isArray(payload) || payload.some((item) => typeof item !== 'string')) throw new ApiError(400, 'VALIDATION_ERROR', 'myList.replace requires an array of strings.');
      state.myList = structuredClone(payload);
      return state;
    case 'bookmarkFolder.upsert': upsertEntity(state.bookmarkFolders, payload, 'bookmarkFolder'); return state;
    case 'bookmarkFolder.delete': deleteEntity(state.bookmarkFolders, payload?.id, 'bookmarkFolder'); return state;
    default:
      throw new ApiError(400, 'VALIDATION_ERROR', `Unsupported operation type: ${operation.type}.`);
  }
}

// ---------------------------------------------------------------------------
// Auth helpers (file-store backed)
// ---------------------------------------------------------------------------

async function getAuthenticatedUser(req) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'AUTH_REQUIRED', 'Bearer token required.');
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) throw new ApiError(401, 'AUTH_REQUIRED', 'Bearer token required.');
  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET, { issuer: 'aether-mocks-api', audience: 'aether-mocks-client' });
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Token is invalid or expired.');
  }
  if (!claims.sub || typeof claims.sub !== 'string') throw new ApiError(401, 'INVALID_TOKEN', 'Token is invalid.');
  const user = _db.users.find((u) => u.id === claims.sub);
  if (!user) throw new ApiError(401, 'INVALID_TOKEN', 'Token is invalid.');
  return user;
}

function getOrCreateState(userId) {
  if (_db.states[userId]) return _db.states[userId];
  const now = new Date().toISOString();
  const created = { userId, state: cloneDefaultState(), revision: now, createdAt: now, updatedAt: now };
  _db.states[userId] = created;
  persistDb();
  return created;
}

async function syncState(user, payload) {
  const hasState = Object.prototype.hasOwnProperty.call(payload, 'state');
  const hasOperations = Object.prototype.hasOwnProperty.call(payload, 'operations');
  if (hasState === hasOperations) throw new ApiError(400, 'VALIDATION_ERROR', 'Provide exactly one of state or operations.');
  if (hasState) validateState(payload.state);
  if (hasOperations && (!Array.isArray(payload.operations) || payload.operations.length === 0 || payload.operations.length > 100)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'operations must contain between 1 and 100 operations.');
  }
  if (hasOperations && payload.operations.some((operation) => isPlainObject(operation) && operation.type === 'state.replace')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Use the top-level state field for a full-state replacement.');
  }
  if (payload.baseRevision !== undefined && (typeof payload.baseRevision !== 'string' || !payload.baseRevision)) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'baseRevision must be a non-empty string when provided.');
  }

  const stateDocument = getOrCreateState(user.id);
  let state = structuredClone(stateDocument.state);
  const results = [];
  let changed = false;

  if (hasState) {
    state = validateState(payload.state);
    changed = true;
  } else {
    for (const operation of payload.operations) {
      if (!isPlainObject(operation) || typeof operation.id !== 'string' || !operation.id.trim()) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Each operation requires a non-empty id.');
      }
      const duplicate = _db.operations.find((op) => op.userId === user.id && op.operationId === operation.id);
      if (duplicate) {
        results.push({ id: operation.id, status: 'duplicate' });
        continue;
      }
      state = applyOperation(state, operation);
      changed = true;
      results.push({ id: operation.id, status: 'applied' });
      _db.operations.push({
        userId: user.id,
        operationId: operation.id,
        type: operation.type,
        createdAt: new Date().toISOString(),
      });
      // Keep operations list bounded to avoid unbounded file growth.
      if (_db.operations.length > 10000) _db.operations = _db.operations.slice(-8000);
    }
  }

  let revision = stateDocument.revision;
  if (changed) {
    revision = new Date().toISOString();
    _db.states[user.id] = { ...stateDocument, state, revision, updatedAt: revision };
    persistDb();
  }
  return { applied: changed, revision, state, results };
}

// ---------------------------------------------------------------------------
// Catalog scanner
// ---------------------------------------------------------------------------

function scanCatalog() {
  const now = Date.now();
  if (cachedCatalog && now - lastCatalogScan < 10000) return cachedCatalog;
  const mocks = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'v2', 'dist', 'dist-electron', 'backup'].includes(entry.name.toLowerCase())) walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html') && entry.name.toLowerCase() !== 'index.html') {
        const relativePath = path.relative(PUBLIC_DIR, fullPath).replace(/\\/g, '/');
        const parts = relativePath.split('/');
        const rawProvider = parts[0] || 'General';
        const provider = rawProvider.toLowerCase().includes('oliveboard') ? 'Oliveboard' : rawProvider.toLowerCase().includes('pundit') ? 'Pundits' : rawProvider;
        const category = parts.length > 2 ? parts.slice(1, -1).join('/') : parts.length > 1 ? parts[1] : 'General';
        const name = path.basename(fullPath, '.html').replace(/^@the_solvers_/i, '').replace(/_\d{4,6}$/i, '').replace(/[_-]/g, ' ').trim();
        let subject = 'General';
        if (/quant|math|calc|ratio|percent|algebra/i.test(name)) subject = 'Quant';
        else if (/reasoning|analogy|puzzle|series/i.test(name)) subject = 'Reasoning';
        else if (/english|vocab|grammar|cloze|reading/i.test(name)) subject = 'English';
        else if (/gk|gs|history|geography|science|current|polity/i.test(name)) subject = 'General Studies';
        else if (/full|tier|mock\s*\d/i.test(name)) subject = 'Full Mock';
        mocks.push({ path: relativePath, name, provider, category, subject });
      }
    }
  }
  walk(PUBLIC_DIR);
  cachedCatalog = mocks.sort((left, right) => left.name.localeCompare(right.name));
  lastCatalogScan = now;
  return cachedCatalog;
}

// ---------------------------------------------------------------------------
// API router
// ---------------------------------------------------------------------------

async function handleApi(req, res, pathname, parsedUrl) {
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(req, res, 200, { status: 'online', time: new Date().toISOString(), version: '3.0.0', database: 'file' });
  }
  if (pathname === '/api/catalog' && req.method === 'GET') {
    let mocks = scanCatalog();
    const filters = ['provider', 'subject', 'category'];
    for (const filter of filters) {
      const value = parsedUrl.searchParams.get(filter);
      if (value) mocks = mocks.filter((mock) => filter === 'category' ? mock.category.toLowerCase().includes(value.toLowerCase()) : mock[filter].toLowerCase() === value.toLowerCase());
    }
    const query = parsedUrl.searchParams.get('q');
    if (query) {
      const lowerQuery = query.toLowerCase();
      mocks = mocks.filter((mock) => mock.name.toLowerCase().includes(lowerQuery) || mock.path.toLowerCase().includes(lowerQuery));
    }
    return sendJson(req, res, 200, mocks);
  }
  if (pathname === '/api/auth/register' && req.method === 'POST') {
    const { loginId: rawLoginId, password, name } = await readBody(req);
    const loginId = normalizeLoginId(rawLoginId);
    if (!loginId) throw new ApiError(400, 'VALIDATION_ERROR', 'loginId must be 3-64 lowercase letters, numbers, underscores, or hyphens and begin with a letter or number.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw new ApiError(400, 'VALIDATION_ERROR', 'password must be between 8 and 128 characters.');
    if (_db.users.find((u) => u.loginId === loginId)) throw new ApiError(409, 'LOGIN_ID_TAKEN', 'That login ID is already registered.');
    const now = new Date().toISOString();
    const user = { id: crypto.randomUUID(), loginId, name: normalizeName(name, loginId), passwordHash: await bcrypt.hash(password, 12), createdAt: now, updatedAt: now };
    _db.users.push(user);
    persistDb();
    return sendJson(req, res, 201, { token: createToken(user), user: publicUser(user) });
  }
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { loginId: rawLoginId, password } = await readBody(req);
    const loginId = normalizeLoginId(rawLoginId);
    if (!loginId || typeof password !== 'string') throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid login ID or password.');
    const user = _db.users.find((u) => u.loginId === loginId);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid login ID or password.');
    return sendJson(req, res, 200, { token: createToken(user), user: publicUser(user) });
  }
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    await getAuthenticatedUser(req);
    return sendNoContent(req, res);
  }

  const user = await getAuthenticatedUser(req);
  if (pathname === '/api/auth/me' && req.method === 'GET') return sendJson(req, res, 200, { user: publicUser(user) });
  if (pathname === '/api/bootstrap' && req.method === 'GET') {
    const stateDocument = getOrCreateState(user.id);
    return sendJson(req, res, 200, { user: publicUser(user), state: stateDocument.state, revision: stateDocument.revision, serverTime: new Date().toISOString() });
  }
  if (pathname === '/api/sync' && req.method === 'POST') {
    const body = await readBody(req);
    return sendJson(req, res, 200, await syncState(user, body));
  }
  throw new ApiError(404, 'NOT_FOUND', `API route ${pathname} not found.`);
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  try {
    if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname, parsedUrl);
    if (pathname === '/' || pathname === '') {
      res.writeHead(302, { Location: '/v2/' });
      res.end();
      return;
    }
    const normalizedPath = path.normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
    let filePath = path.resolve(PUBLIC_DIR, normalizedPath);
    if (!filePath.startsWith(`${path.resolve(PUBLIC_DIR)}${path.sep}`) && filePath !== path.resolve(PUBLIC_DIR)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath) && pathname.startsWith('/v2/')) {
      const fallback = path.join(PUBLIC_DIR, 'v2', 'index.html');
      if (fs.existsSync(fallback)) filePath = fallback;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream', ...corsHeaders(req) });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    sendError(req, res, error);
  }
});

// ---------------------------------------------------------------------------
// Startup & shutdown
// ---------------------------------------------------------------------------

function start() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters long.');
  loadDb();
  server.listen(PORT, HOST, () => console.log(`Aether File-Store API listening on http://${HOST}:${PORT}`));
}

function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  start();
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
