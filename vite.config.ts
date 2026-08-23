/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'

const dirname = import.meta.dirname ?? path.resolve()

const SPA_REDIRECT_KEY = '__aether_redirect';

/** Inject a script into index.html that recovers the original URL after a
    404 → /v2/ redirect triggered by our static 404.html fallback page. */
function spaFallbackPlugin(): import('vite').Plugin {
  return {
    name: 'spa-fallback',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `<script>!function(){var p=sessionStorage.getItem('${SPA_REDIRECT_KEY}');if(p){sessionStorage.removeItem('${SPA_REDIRECT_KEY}');var u=new URL(p,location.origin);if(u.pathname.startsWith('/v2/')){var r=u.pathname.slice(3)||'/';history.replaceState(null,'',r+u.search+u.hash)}}}()</script></head>`,
      );
    },
  };
}

function parentPublicPlugin(): import('vite').Plugin {
  return {
    name: 'parent-public',
    enforce: 'pre',
    configureServer(server) {
      const parentPublic = path.resolve(dirname, '..', 'public');
      const appPublic = path.resolve(dirname, 'public');
      server.middlewares.use((req, res, next) => {
        if (!req.url || req.method !== 'GET') return next();
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        // Skip vite internals, SPA routes, and HMR
        if (
          urlPath.startsWith('/v2/') ||
          urlPath.startsWith('/@') ||
          urlPath.startsWith('/src/') ||
          urlPath.startsWith('/node_modules/') ||
          urlPath.startsWith('/__') ||
          urlPath === '/'
        )
          return next();
        // Try parent public first, then app public (for dist mocks, mocks-data)
        for (const base of [parentPublic, appPublic]) {
          const safe = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '').replace(/^\/+/, '');
          const filePath = path.join(base, safe);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const mime: Record<string, string> = {
              '.html': 'text/html; charset=utf-8',
              '.json': 'application/json; charset=utf-8',
              '.js': 'text/javascript; charset=utf-8',
              '.css': 'text/css; charset=utf-8',
            };
            res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'Access-Control-Allow-Origin': '*' });
            fs.createReadStream(filePath).pipe(res);
            return;
          }
        }
        return next();
      });
    },
  };
}

const DB_FILE = path.resolve(dirname, 'aether-server-db.json');

function getDevDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    }
  } catch {}
  return { attempts: {}, bookmarks: [], alarms: [] };
}

function saveDevDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

function backendApiPlugin(): import('vite').Plugin {
  return {
    name: 'backend-api',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next();
        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname;

        const sendJson = (status: number, data: any) => {
          res.writeHead(status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify(data));
        };

        const readBody = (): Promise<any> =>
          new Promise((resolve) => {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch {
                resolve({});
              }
            });
          });

        if (pathname === '/api/health') {
          return sendJson(200, { status: 'online', time: new Date().toISOString() });
        }

        if (pathname === '/api/system') {
          const db = getDevDb();
          return sendJson(200, {
            status: 'online',
            serverTime: new Date().toISOString(),
            uptimeSeconds: Math.floor(process.uptime()),
            totalAttempts: Object.values(db.attempts || {}).flat().length,
            totalBookmarks: (db.bookmarks || []).length,
            storageHealthy: true,
            version: '2.4.0',
          });
        }

        if (pathname === '/api/attempts' && req.method === 'GET') {
          const db = getDevDb();
          return sendJson(200, db.attempts || {});
        }

        if (pathname === '/api/attempts' && req.method === 'POST') {
          const payload = await readBody();
          const { mockPath, attempt } = payload;
          if (mockPath && attempt) {
            const db = getDevDb();
            const list = db.attempts[mockPath] || [];
            if (!list.some((a: any) => a.submittedAt === attempt.submittedAt)) {
              list.push(attempt);
              db.attempts[mockPath] = list.slice(-10);
              saveDevDb(db);
            }
          }
          return sendJson(200, { success: true });
        }

        if (pathname === '/api/sync' && req.method === 'POST') {
          const payload = await readBody();
          const db = getDevDb();
          let merged = 0;
          Object.entries(payload.attempts || {}).forEach(([p, arr]: [string, any]) => {
            if (Array.isArray(arr)) {
              const currentList = db.attempts[p] || [];
              arr.forEach((incomingAtt) => {
                if (!currentList.some((c: any) => c.submittedAt === incomingAtt.submittedAt)) {
                  currentList.push(incomingAtt);
                  merged++;
                }
              });
              db.attempts[p] = currentList.slice(-10);
            }
          });
          if (merged > 0) saveDevDb(db);
          return sendJson(200, { success: true, merged, attempts: db.attempts });
        }

        if (pathname === '/api/bookmarks' && req.method === 'GET') {
          const db = getDevDb();
          return sendJson(200, db.bookmarks || []);
        }

        if (pathname === '/api/bookmarks' && req.method === 'POST') {
          const bookmark = await readBody();
          if (bookmark?.id) {
            const db = getDevDb();
            const bookmarks = db.bookmarks || [];
            const idx = bookmarks.findIndex((b: any) => b.id === bookmark.id);
            if (idx >= 0) bookmarks[idx] = bookmark;
            else bookmarks.push(bookmark);
            db.bookmarks = bookmarks;
            saveDevDb(db);
          }
          return sendJson(200, { success: true });
        }

        if (pathname === '/api/alarms' && req.method === 'GET') {
          const db = getDevDb();
          return sendJson(200, db.alarms || []);
        }

        return next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: '/v2/',
  plugins: [react(), tailwindcss(), spaFallbackPlugin(), parentPublicPlugin(), backendApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  // vitest picks this up; vite itself ignores the field.
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Run test files sequentially in a single worker. The default parallel fork
    // pool has a jsdom-across-workers startup race on Windows that intermittently
    // fails the whole run with "failed to find the runner" (0 tests execute).
    // Serializing removes the race at a small wall-clock cost — the right call
    // for a CI gate. (`fileParallelism: false` + `maxWorkers: 1` are the typed,
    // supported knobs in this vitest version; `poolOptions` is not in the type.)
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
  },
  // The 404.html in spa-public/ is copied into the output so plain static
  // servers serve a redirect-to-SPA instead of a raw "Not Found" page.
  publicDir: 'spa-public',
  build: {
    // Build straight into the deployed static site under /v2/ so the modern
    // app ships alongside legacy mocks without breaking any existing URLs.
    outDir: '../public/v2',
    emptyOutDir: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    fs: { strict: false },
    // Parent public is now served by parentPublicPlugin (enforce: pre), so no
    // external server on 8080 is required for mocks. Keep only a thin proxy
    // for legacy static dirs that may not exist as files (e.g. /providers/).
    proxy: {
      '/providers': 'http://localhost:8080',
      '/css': 'http://localhost:8080',
      '/js': 'http://localhost:8080',
    },
  },
})
