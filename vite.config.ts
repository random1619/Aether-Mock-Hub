/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  base: '/v2/',
  plugins: [react(), tailwindcss(), spaFallbackPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  // vitest picks this up; vite itself ignores the field.
  test: {
    environment: 'jsdom',
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
    proxy: {
      // Proxy legacy content so fetches to /providers, /mocks-data.js, etc.
      // resolve to the static site root during development.
      '/providers': 'http://localhost:8080',
      '/mocks-data.js': 'http://localhost:8080',
      '/css': 'http://localhost:8080',
      '/js': 'http://localhost:8080',
    },
  },
})
