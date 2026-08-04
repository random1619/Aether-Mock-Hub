/**
 * Aether Mocks — Electron main process
 * ============================================================
 * Offline desktop shell for the static CBT platform.
 *
 * Architecture:
 *   - Serves the bundled public/ over a loopback HTTP server so the
 *     existing static app runs UNCHANGED (PDF.js workers, fetch, etc.
 *     all keep working on an http:// origin — no file:// CORS hacks).
 *   - Native BrowserWindow with theme sync + durable on-disk settings.
 *   - Exam focus tools: kiosk mode, global shortcuts, break reminders.
 *   - electron-updater for auto-update; electron-builder for packaging.
 * ============================================================
 */
'use strict';

const { app, BrowserWindow, ipcMain, nativeTheme, globalShortcut, Notification, Menu, shell, dialog, Tray, powerSaveBlocker, powerMonitor, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// electron-updater is optional at runtime (dev builds skip update checks)
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch { /* not installed in dev */ }

/* ─────────────────────────────────────────────────────────────
   Config
   ───────────────────────────────────────────────────────────── */
const IS_DEV = process.argv.includes('--dev') || !app.isPackaged;
// electron/ lives at app/electron; the static platform (incl. the built React
// app under /v2/) lives at the repo's public/. Packaged: resources/public.
const CONTENT_DIR = app.isPackaged
    ? path.join(process.resourcesPath, 'public')
    : path.join(__dirname, '..', '..', 'public');
// The desktop app boots into the MODERN React app, not the legacy dashboard.
// ENTRY_URL is the browser path (clean route so BrowserRouter matches "/");
// ENTRY_FILE is the on-disk SPA entry used for the fallback responder.
const ENTRY_URL = '/v2/';
const ENTRY_FILE = '/v2/index.html';
const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 0; // 0 = pick a free ephemeral port at runtime

let mainWindow = null;
let contentServer = null;
let serverOrigin = null;
let powerSaveId = null;
let tray = null;

/* ─────────────────────────────────────────────────────────────
   Durable settings store (replaces localStorage for app prefs).
   JSON file in the OS user-data dir — survives reinstalls/updates.
   ───────────────────────────────────────────────────────────── */
const storeFile = () => path.join(app.getPath('userData'), 'aether-desktop-settings.json');
const STORE_DEFAULTS = { theme: 'dark', windowBounds: null, zoomLevel: 0, focus: { breakMins: 0, kioskDefault: false } };
function readStore() {
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(storeFile(), 'utf8')); } catch { /* missing/corrupt */ }
    // Merge over defaults — a hand-edited file missing `focus` must not crash callers.
    const base = Object.assign({}, STORE_DEFAULTS, parsed || {});
    base.focus = Object.assign({}, STORE_DEFAULTS.focus, (parsed && parsed.focus) || {});
    return base;
}
function writeStore(patch) {
    const cur = readStore();
    const next = Object.assign({}, cur, patch);
    try { fs.writeFileSync(storeFile(), JSON.stringify(next, null, 2)); } catch { /* ignore */ }
    return next;
}

/* ─────────────────────────────────────────────────────────────
   Loopback content server — serves public/ with correct MIME types.
   Only bound to 127.0.0.1; never exposed off-machine.
   ───────────────────────────────────────────────────────────── */
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'text/javascript; charset=utf-8',
    '.mjs':  'text/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf':  'application/pdf',
    '.png':  'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif':  'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.ico':  'image/x-icon', '.map': 'application/json',
};
// Shared responder with correct MIME + cache headers.
function serveFile(fp, st, res) {
    const ext = path.extname(fp).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    // HTML + the generated mock index: always revalidate. Big binaries: cache.
    const cache = (ext === '.html' || fp.endsWith('mocks-data.js'))
        ? 'no-cache'
        : (ext === '.pdf' ? 'public, max-age=604800' : 'public, max-age=86400');
    res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': st.size,
        'Cache-Control': cache,
        'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(fp).pipe(res);
}

function startContentServer() {
    return new Promise((resolve, reject) => {
        const srv = http.createServer((req, res) => {
            try {
                // Decode + normalize; block path traversal outside CONTENT_DIR.
                let urlPath = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
                if (urlPath === '/') urlPath = '/v2/'; // boot into the React app root
                const filePath = path.normalize(path.join(CONTENT_DIR, urlPath));
                const root = path.normalize(CONTENT_DIR);
                if (filePath !== root && !filePath.startsWith(root + path.sep)) {
                    res.writeHead(403); res.end('Forbidden'); return;
                }
                fs.stat(filePath, (err, st) => {
                    // Directory → serve its index.html (so /v2/ resolves with path "/").
                    if (!err && st.isDirectory()) {
                        const idx = path.join(filePath, 'index.html');
                        return fs.stat(idx, (e2, st2) => {
                            if (e2 || !st2.isFile()) { res.writeHead(404); res.end('Not found'); return; }
                            serveFile(idx, st2, res);
                        });
                    }
                    // SPA fallback: unknown /v2/* client-side routes → React entry,
                    // so BrowserRouter can handle deep links like /v2/analytics.
                    if ((err || !st.isFile()) && urlPath.startsWith('/v2/')) {
                        const entry = path.join(CONTENT_DIR, ENTRY_FILE);
                        return fs.stat(entry, (e3, st3) => {
                            if (e3 || !st3.isFile()) { res.writeHead(404); res.end('Not found'); return; }
                            serveFile(entry, st3, res);
                        });
                    }
                    if (err || !st.isFile()) { res.writeHead(404); res.end('Not found'); return; }
                    serveFile(filePath, st, res);
                });
            } catch { res.writeHead(500); res.end('Server error'); }
        });
        srv.on('error', reject);
        srv.listen(SERVER_PORT, SERVER_HOST, () => {
            serverOrigin = `http://${SERVER_HOST}:${srv.address().port}`;
            resolve(srv);
        });
    });
}

/* ─────────────────────────────────────────────────────────────
   Native application menu (exam-focused) + window
   ───────────────────────────────────────────────────────────── */
function buildMenu() {
    const send = (channel, arg) => () => mainWindow && mainWindow.webContents.send(channel, arg);
    const template = [
        ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
        {
            label: 'File',
            submenu: [
                { label: 'Open PDF…', accelerator: 'CmdOrCtrl+O', click: openPdfFromDisk },
                { type: 'separator' },
                { role: 'quit', label: 'Exit Aether Mocks' },
            ],
        },
        {
            label: 'Exam',
            submenu: [
                { label: 'Focus Mode (Kiosk)', accelerator: 'F11', click: toggleKiosk },
                { label: 'Start Break Reminder…', click: promptBreakReminder },
                { label: 'Stop Break Reminder', click: stopBreakReminder },
                { type: 'separator' },
                { label: 'Back to Dashboard', accelerator: 'CmdOrCtrl+Home', click: () => mainWindow && mainWindow.loadURL(serverOrigin + ENTRY_URL) },
            ],
        },
        {
            label: 'View',
            submenu: [
                { label: 'Toggle Dark / Light', accelerator: 'CmdOrCtrl+Shift+L', click: send('aether:toggle-theme') },
                { type: 'separator' },
                { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
                { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
            ],
        },
        {
            label: 'Window',
            submenu: [ { role: 'minimize' }, { role: 'close' } ],
        },
        {
            label: 'Help',
            submenu: [
                { label: 'About Aether Mocks', click: showAbout },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showAbout() {
    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'About Aether Mocks',
        message: 'Aether Mocks',
        detail: `Offline CBT Platform\nVersion ${app.getVersion()}\nContent served locally from:\n${CONTENT_DIR}`,
        buttons: ['OK'],
    });
}

/* ─────────────────────────────────────────────────────────────
   Exam focus tools
   ───────────────────────────────────────────────────────────── */
/** True while the renderer reports an active exam (aether:start-exam IPC).
    Gates DevTools lockdown, forced kiosk, and shortcut blocking. */
let examActive = false;
/** True when WE pushed the window into kiosk for an exam — only then do we
    pull it back out on exam end (a user-chosen kiosk stays untouched). */
let kioskForcedByExam = false;

function toggleKiosk() {
    if (!mainWindow) return;
    // Anti-cheat: kiosk is locked ON for the duration of an active exam.
    if (examActive && mainWindow.isKiosk()) {
        notify('Focus Mode', 'Kiosk mode stays on until the exam is submitted.');
        return;
    }
    const next = !mainWindow.isKiosk();
    mainWindow.setKiosk(next);
    mainWindow.webContents.send('aether:kiosk-changed', next);
    notify('Focus Mode', next ? 'Kiosk mode ON — distraction-free exam.' : 'Kiosk mode OFF.');
}

/* Exam lifecycle (renderer: examStore start/submit/reset). Forces kiosk on,
   locks DevTools, and keeps the display awake until the attempt ends. */
function examStarted() {
    examActive = true;
    startPowerSaveBlocker();
    if (mainWindow && !mainWindow.isKiosk()) {
        kioskForcedByExam = true;
        mainWindow.setKiosk(true);
        mainWindow.webContents.send('aether:kiosk-changed', true);
    }
}

function examEnded() {
    examActive = false;
    stopPowerSaveBlocker();
    if (mainWindow && kioskForcedByExam) {
        kioskForcedByExam = false;
        mainWindow.setKiosk(false);
        mainWindow.webContents.send('aether:kiosk-changed', false);
    }
}

let breakTimer = null;
function promptBreakReminder() {
    // Simple presets via dialog (no extra window chrome needed).
    const presets = [25, 45, 60];
    dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: 'Break Reminder',
        message: 'Start a break reminder?',
        detail: 'Get a notification to rest your eyes after a focused block.',
        buttons: presets.map(m => `${m} min`).concat(['Cancel']),
        cancelId: presets.length,
    }).then(({ response }) => {
        if (response >= presets.length) return;
        const mins = presets[response];
        startBreakReminder(mins);
    });
}
function startBreakReminder(mins) {
    stopBreakReminder(false);
    breakTimer = setInterval(() => {
        notify('Time for a break', `You've been focused for ${mins} minutes. Rest your eyes.`);
    }, mins * 60 * 1000);
    writeStore({ focus: Object.assign({}, readStore().focus, { breakMins: mins }) });
    notify('Break Reminder', `Reminder set — every ${mins} minutes.`);
}
function stopBreakReminder(showMsg = true) {
    if (breakTimer) { clearInterval(breakTimer); breakTimer = null; }
    writeStore({ focus: Object.assign({}, readStore().focus, { breakMins: 0 }) });
    if (showMsg) notify('Break Reminder', 'Reminder stopped.');
}

function notify(title, body) {
    try {
        if (Notification.isSupported()) new Notification({ title, body, silent: true }).show();
    } catch { /* ignore */ }
}

/* ─────────────────────────────────────────────────────────────
   Power-save blocker — prevents screen sleep / system idle
   during an active exam so the display never dims mid-question.
   ───────────────────────────────────────────────────────────── */
function startPowerSaveBlocker() {
    if (powerSaveId !== null) return;
    try {
        powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
    } catch { /* powerSaveBlocker may not be available on all platforms */ }
}

function stopPowerSaveBlocker() {
    if (powerSaveId === null) return;
    try {
        powerSaveBlocker.stop(powerSaveId);
    } catch { /* ignore */ }
    powerSaveId = null;
}

/* ─────────────────────────────────────────────────────────────
   System tray — minimize to tray, right-click quick actions.
   ───────────────────────────────────────────────────────────── */
function createTray() {
    // Build a simple 16x16 tray icon programmatically (no asset file needed).
    try {
        const { nativeImage } = require('electron');
        const icon = nativeImage.createEmpty();
        // Use the app icon as fallback — on Windows the taskbar icon usually works.
        tray = new Tray(icon);
    } catch {
        // Tray not supported (some Linux desktops) — skip silently.
        return;
    }

    const ctx = Menu.buildFromTemplate([
        { label: 'Dashboard', click: () => { showWindow(); mainWindow?.loadURL(serverOrigin + ENTRY_URL); } },
        { label: 'Resume Last Exam', click: () => { showWindow(); mainWindow?.webContents.send('aether:resume-last'); } },
        { type: 'separator' },
        { label: 'Exit Aether Mocks', click: () => { app.isQuitting = true; app.quit(); } },
    ]);
    tray.setToolTip('Aether Mocks');
    tray.setContextMenu(ctx);
    tray.on('click', () => showWindow());
}

function showWindow() {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
}

/* ─────────────────────────────────────────────────────────────
   Native PDF open — bypasses the browser file:// CORS limitation.
   Reads the file and hands bytes to the renderer to load in PDF.js.
   ───────────────────────────────────────────────────────────── */
async function openPdfFromDisk() {
    if (!mainWindow) return;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Open PDF',
        filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
        properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) return;
    const filePath = filePaths[0];
    try {
        // Async read — a large PDF must not block the main process.
        const data = await fs.promises.readFile(filePath);
        const payload = { name: path.basename(filePath), data: data.toString('base64') };
        // Ensure the reader is on screen, then hand it the bytes exactly once.
        if (mainWindow.webContents.getURL().includes('pdf-reader.html')) {
            mainWindow.webContents.send('aether:open-external-pdf', payload);
        } else {
            await mainWindow.loadURL(serverOrigin + '/pdf-reader.html');
            mainWindow.webContents.once('did-finish-load', () => {
                mainWindow.webContents.send('aether:open-external-pdf', payload);
            });
        }
    } catch (e) {
        dialog.showErrorBox('Could not open PDF', e.message);
    }
}

/* ─────────────────────────────────────────────────────────────
   Window lifecycle
   ───────────────────────────────────────────────────────────── */
async function createWindow() {
    const saved = readStore();
    const bounds = saved.windowBounds || { width: 1440, height: 900 };

    mainWindow = new BrowserWindow({
        width: bounds.width, height: bounds.height,
        x: bounds.x, y: bounds.y,
        minWidth: 1024, minHeight: 640,
        show: false,
        backgroundColor: saved.theme === 'light' ? '#eef1f9' : '#060a15', // pre-paint flash color
        title: 'Aether Mocks',
        autoHideMenuBar: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,              // preload only uses contextBridge + ipcRenderer
            spellcheck: false,
            // Allow the loopback origin only; block remote navigation by default.
        },
    });

    // Persist window bounds on move/resize (debounced).
    let boundsTimer = null;
    const saveBounds = () => {
        clearTimeout(boundsTimer);
        boundsTimer = setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) writeStore({ windowBounds: mainWindow.getBounds() });
        }, 400);
    };
    mainWindow.on('resize', saveBounds);
    mainWindow.on('move', saveBounds);

    // Persist zoom level across sessions (CmdOrCtrl +/- / 0).
    const savedZoom = readStore().zoomLevel || 0;
    if (savedZoom !== 0) mainWindow.webContents.setZoomLevel(savedZoom);
    mainWindow.webContents.on('zoom-changed', () => {
        writeStore({ zoomLevel: mainWindow.webContents.getZoomLevel() });
    });

    // Show only when content is painted — avoids a white flash.
    mainWindow.once('ready-to-show', () => mainWindow.show());

    // Open external links in the system browser, not in-app.
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http') && !url.startsWith(serverOrigin)) shell.openExternal(url);
        return { action: 'deny' };
    });
    // Block navigation away from our origin (defense-in-depth for the bundled app).
    mainWindow.webContents.on('will-navigate', (e, url) => {
        if (!url.startsWith(serverOrigin)) { e.preventDefault(); shell.openExternal(url); }
    });

    // Anti-cheat: DevTools are locked while an exam is active (prevents
    // inspecting the question payloads / exam store mid-attempt).
    mainWindow.webContents.on('devtools-opened', () => {
        if (!examActive) return;
        mainWindow.webContents.closeDevTools();
        notify('Exam Integrity', 'Developer tools are disabled during an exam.');
    });

    // Anti-cheat: kill inspect/print/save chords at the OS level during an
    // exam (belt-and-braces over the renderer's keydown blocking — these fire
    // even when the page's JS is busy).
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (!examActive || input.type !== 'keyDown') return;
        const key = (input.key || '').toLowerCase();
        const mod = input.control || input.meta;
        if (
            key === 'f12' ||
            (mod && input.shift && ['i', 'j', 'c'].includes(key)) ||
            (mod && ['p', 's', 'u'].includes(key))
        ) {
            event.preventDefault();
        }
    });

    // Inject the desktop bridge into EVERY page (dashboard, exam engine,
    // pdf-reader, analytics) so all 1,124 content pages get native features
    // without editing a single HTML file.
    const bridgePath = path.join(__dirname, 'renderer-desktop.js');
    let bridgeSrc = '';
    try { bridgeSrc = fs.readFileSync(bridgePath, 'utf8'); } catch { /* optional */ }
    if (bridgeSrc) {
        mainWindow.webContents.on('dom-ready', () => {
            mainWindow.webContents.executeJavaScript(bridgeSrc).catch(() => {});
        });
    }

    buildMenu();
    await mainWindow.loadURL(serverOrigin + ENTRY_URL);

    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

/* ─────────────────────────────────────────────────────────────
   IPC bridge (renderer → main)
   ───────────────────────────────────────────────────────────── */
function wireIpc() {
    ipcMain.handle('aether:get-settings', () => readStore());
    ipcMain.handle('aether:set-theme', (_e, theme) => {
        writeStore({ theme: theme === 'light' ? 'light' : 'dark' });
        return readStore().theme;
    });
    ipcMain.handle('aether:toggle-kiosk', () => toggleKiosk());
    ipcMain.handle('aether:notify', (_e, { title, body }) => notify(title, body));
    ipcMain.handle('aether:open-pdf', () => openPdfFromDisk());
    ipcMain.handle('aether:origin', () => serverOrigin);

    // Exam lifecycle — renderer calls these on exam start/end. They drive the
    // power-save blocker, forced kiosk mode, and the DevTools lockdown.
    ipcMain.handle('aether:start-exam', () => examStarted());
    ipcMain.handle('aether:end-exam', () => examEnded());

    // Data export — opens a native Save dialog and writes the JSON blob.
    ipcMain.handle('aether:export-data', async () => {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Aether Data',
            defaultPath: `aether-mocks-backup-${new Date().toISOString().slice(0, 10)}.json`,
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        return { canceled, filePath: filePath || null };
    });

    // Data import — opens a native Open dialog and returns the raw file content.
    ipcMain.handle('aether:import-data', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Aether Data',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile'],
        });
        if (canceled || !filePaths[0]) return { canceled: true, data: null };
        try {
            const data = await fs.promises.readFile(filePaths[0], 'utf8');
            return { canceled: false, data };
        } catch (e) {
            return { canceled: true, data: null, error: e.message };
        }
    });

    // Zoom persistence — renderer can query current zoom.
    ipcMain.handle('aether:get-zoom', () => readStore().zoomLevel || 0);

    /* ── Crash-safe exam autosave ─────────────────────────────
       The renderer mirrors its progress snapshot to disk via these
       handlers: Chromium's localStorage commits are async, so a hard
       crash / power cut can lose the last seconds of answers. The disk
       copy is written atomically (tmp + rename) to avoid torn writes. */
    const autosaveFile = () => path.join(app.getPath('userData'), 'aether-exam-autosave.json');
    ipcMain.handle('aether:autosave-exam', (_e, json) => {
        // Shape is validated by the renderer on load; main only guards
        // type + size so a broken page can't write arbitrary junk.
        if (typeof json !== 'string' || json.length === 0 || json.length > 5 * 1024 * 1024) return false;
        try {
            const tmp = autosaveFile() + '.tmp';
            fs.writeFileSync(tmp, json, 'utf8');
            fs.renameSync(tmp, autosaveFile());
            return true;
        } catch { return false; }
    });
    ipcMain.handle('aether:load-autosave', () => {
        try { return fs.readFileSync(autosaveFile(), 'utf8'); } catch { return null; }
    });
    ipcMain.handle('aether:clear-autosave', () => {
        try { fs.unlinkSync(autosaveFile()); } catch { /* already absent */ }
    });

    /* ── Credential vault (login ids) ───────────────────────────
       The renderer keeps login-id credentials (PBKDF2 password hashes +
       hashed security answers — never plaintext) in localStorage, and mirrors
       them here so they survive a REINSTALL / auto-update: userData lives
       outside the install dir. The file is encrypted with Electron safeStorage
       (OS keychain: DPAPI on Windows, Keychain on macOS, libsecret on Linux),
       so plaintext never touches disk. When safeStorage is unavailable the
       fallback is the raw JSON — still only password HASHES, which are useless
       without the passwords, so it stays safe (just not OS-encrypted).

       Format on disk: a small envelope { v: 1, enc: 'safeStorage'|'plain',
       data: '<base64 ciphertext>' | <object> }. The inner object is the
       renderer's credential map { [profileId]: {salt,hash,iterations,secqa} }. */
    const credsFile = () => path.join(app.getPath('userData'), 'aether-credentials.json');

    function writeCreds(map) {
        const json = JSON.stringify(map ?? {});
        const envelope = { v: 1 };
        try {
            if (safeStorage && safeStorage.isEncryptionAvailable()) {
                envelope.enc = 'safeStorage';
                envelope.data = safeStorage.encryptString(json).toString('base64');
            } else {
                envelope.enc = 'plain';
                envelope.data = JSON.parse(json);
            }
            const tmp = credsFile() + '.tmp';
            fs.writeFileSync(tmp, JSON.stringify(envelope), 'utf8');
            fs.renameSync(tmp, credsFile()); // atomic — no torn writes
            return true;
        } catch { return false; }
    }

    function readCreds() {
        let raw;
        try { raw = fs.readFileSync(credsFile(), 'utf8'); } catch { return null; }
        try {
            const env = JSON.parse(raw);
            if (env && env.enc === 'safeStorage' && typeof env.data === 'string') {
                if (!(safeStorage && safeStorage.isEncryptionAvailable())) return null;
                const plain = safeStorage.decryptString(Buffer.from(env.data, 'base64'));
                return JSON.parse(plain);
            }
            if (env && env.enc === 'plain') return env.data || null;
            // Pre-envelope format (a bare map) — accept it directly.
            if (env && typeof env === 'object' && !env.enc) return env;
            return null;
        } catch { return null; }
    }

    ipcMain.handle('aether:creds-load', () => readCreds());
    ipcMain.handle('aether:creds-save', (_e, map) => {
        // Guard type + size so a broken page can't write arbitrary junk. The
        // renderer owns the shape (hashes only); main just persists it safely.
        if (!map || typeof map !== 'object' || Array.isArray(map)) return false;
        if (JSON.stringify(map).length > 1024 * 1024) return false;
        return writeCreds(map);
    });

    /* ── Scorecard → PDF ──────────────────────────────────────
       The renderer sends a self-contained HTML document; we render it
       in a hidden window and print straight to PDF, so the app window
       (and its dark theme) never interferes with the print layout. */
    ipcMain.handle('aether:export-scorecard', async (_e, payload) => {
        const html = payload && payload.html;
        if (typeof html !== 'string' || !html || html.length > 2 * 1024 * 1024) return { canceled: true };
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Scorecard PDF',
            defaultPath: (payload.filename && String(payload.filename).replace(/[^\w.-]+/g, '-'))
                || `aether-scorecard-${new Date().toISOString().slice(0, 10)}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
        });
        if (canceled || !filePath) return { canceled: true };
        let win = null;
        try {
            win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
            await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
            const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
            await fs.promises.writeFile(filePath, pdf);
            notify('Scorecard saved', path.basename(filePath));
            return { canceled: false, filePath };
        } catch (e) {
            dialog.showErrorBox('PDF export failed', e.message);
            return { canceled: true, error: e.message };
        } finally {
            if (win) win.destroy();
        }
    });
}

/* ─────────────────────────────────────────────────────────────
   Auto-update (GitHub/generic provider via electron-updater).
   No-ops in dev or when no publish config is present.
   ───────────────────────────────────────────────────────────── */
function wireAutoUpdate() {
    if (!autoUpdater || IS_DEV) return;
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-available', () => notify('Update available', 'Downloading the latest Aether Mocks…'));
    autoUpdater.on('update-downloaded', () => {
        dialog.showMessageBox(mainWindow, {
            type: 'info', title: 'Update ready',
            message: 'A new version is ready.',
            detail: 'Restart to apply the update now?',
            buttons: ['Restart now', 'Later'], cancelId: 1,
        }).then(({ response }) => { if (response === 0) autoUpdater.quitAndInstall(); });
    });
    autoUpdater.on('error', (err) => console.warn('[auto-update]', err && err.message));
    // Check shortly after launch; don't block startup.
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
}

/* ─────────────────────────────────────────────────────────────
   App boot
   ───────────────────────────────────────────────────────────── */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    // Protocol handler: aether://exam/<encoded> deep links from the browser.
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient('aether', process.execPath, [path.resolve(process.argv[1])]);
        }
    } else {
        app.setAsDefaultProtocolClient('aether');
    }

    app.on('second-instance', (_e, argv) => {
        showWindow();
        // Handle protocol URL passed to the second instance.
        const url = argv.find(a => a.startsWith('aether://'));
        if (url) handleProtocolUrl(url);
    });

    function handleProtocolUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.host === 'exam' && parsed.pathname) {
                const encoded = parsed.pathname.replace(/^\//, '');
                if (mainWindow) {
                    mainWindow.loadURL(`${serverOrigin}/v2/exam/${encoded}`);
                }
            }
        } catch { /* malformed URL — ignore */ }
    }

    app.whenReady().then(async () => {
        // Reflect saved theme at the OS level (title bar / native widgets).
        nativeTheme.themeSource = readStore().theme === 'light' ? 'light' : 'dark';

        wireIpc();
        contentServer = await startContentServer();
        createTray();
        await createWindow();
        wireAutoUpdate();

        // Warn when the charger is unplugged mid-exam. The power-save
        // blocker doubles as our "exam is active" signal; battery LEVEL
        // is handled renderer-side via Chromium's Battery Status API.
        powerMonitor.on('on-battery', () => {
            if (powerSaveId !== null) {
                notify('On Battery Power', 'Charger unplugged during an exam — plug in soon.');
            }
        });

        // Restore a previously-set break reminder.
        const savedMins = readStore().focus.breakMins;
        if (savedMins > 0) startBreakReminder(savedMins);

        // Global exam shortcuts (work even when the app is not focused).
        globalShortcut.register('CommandOrControl+Shift+K', () => toggleKiosk());

        app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
    });

    // Handle protocol URL from cold start (Windows).
    app.on('open-url', (_e, url) => handleProtocolUrl(url));

    // Minimize to tray instead of closing (Windows).
    app.on('window-all-closed', () => { if (process.platform !== 'darwin') { /* keep running in tray */ } });

    app.on('will-quit', () => { globalShortcut.unregisterAll(); stopBreakReminder(false); });
    app.on('quit', () => {
        stopPowerSaveBlocker();
        if (contentServer) try { contentServer.close(); } catch {}
    });
}
