/**
 * Preload — exposes a minimal, safe API to the renderer via contextBridge.
 * The renderer runs with contextIsolation on and nodeIntegration off, so this
 * is the ONLY surface between the untrusted page and the main process.
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Events the main process may push to the page.
const INCOMING = ['aether:toggle-theme', 'aether:kiosk-changed', 'aether:open-external-pdf', 'aether:resume-last'];

contextBridge.exposeInMainWorld('aetherDesktop', {
    isDesktop: true,

    // Settings
    getSettings: () => ipcRenderer.invoke('aether:get-settings'),
    setTheme: (theme) => ipcRenderer.invoke('aether:set-theme', theme),
    origin: () => ipcRenderer.invoke('aether:origin'),

    // Exam focus
    toggleKiosk: () => ipcRenderer.invoke('aether:toggle-kiosk'),
    notify: (title, body) => ipcRenderer.invoke('aether:notify', { title, body }),
    startExam: () => ipcRenderer.invoke('aether:start-exam'),
    endExam: () => ipcRenderer.invoke('aether:end-exam'),

    // PDF
    openPdfFromDisk: () => ipcRenderer.invoke('aether:open-pdf'),

    // Data export/import
    exportData: () => ipcRenderer.invoke('aether:export-data'),
    importData: () => ipcRenderer.invoke('aether:import-data'),

    // Zoom
    getZoom: () => ipcRenderer.invoke('aether:get-zoom'),

    // Crash-safe exam autosave (disk mirror of the progress snapshot)
    autosaveExam: (json) => ipcRenderer.invoke('aether:autosave-exam', json),
    loadAutosave: () => ipcRenderer.invoke('aether:load-autosave'),
    clearAutosave: () => ipcRenderer.invoke('aether:clear-autosave'),

    // Credential vault (login-id password/answer hashes) — OS-encrypted on
    // disk by the main process so login ids survive a reinstall.
    credsLoad: () => ipcRenderer.invoke('aether:creds-load'),
    credsSave: (map) => ipcRenderer.invoke('aether:creds-save', map),

    // Scorecard PDF export (payload: { html, filename })
    exportScorecard: (payload) => ipcRenderer.invoke('aether:export-scorecard', payload),

    // Event subscription — returns an unsubscribe function.
    on(channel, cb) {
        if (!INCOMING.includes(channel)) return () => {};
        const listener = (_e, ...args) => cb(...args);
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
    },
});
