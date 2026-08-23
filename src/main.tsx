import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster, toast } from 'sonner';
import './index.css';
import App from './App.tsx';
import { setStorageHealthListener, applyPathMap, reloadForProfile } from '@/services/attemptStore';
import { loadPathMap } from '@/services/mockCatalog';
import { useSettingsStore } from '@/stores/settingsStore';
import { onProfileChange } from '@/services/profileStore';
import { syncFromDisk } from '@/services/credentials';

/* On desktop, pull credentials from the OS-encrypted disk mirror into
   localStorage before the app reads them — this is what restores a user's
   login ids after a reinstall (userData survives outside the install dir). */
syncFromDisk().catch(() => {
  /* disk mirror unavailable — web copy in localStorage is the fallback */
});

/* Per-user profiles: when the active profile switches, discard the previous
   profile's in-memory DB and load the new profile's namespaced blob, then
   notify subscribers so every page re-derives. Registered BEFORE the app
   renders so the very first switch is never missed. settingsStore subscribes
   separately to re-apply that profile's theme. */
onProfileChange(() => {
  reloadForProfile();
});

/* Migrate saved progress onto renamed mock paths. The generator emits a
   MOCK_PATH_MAP (old→new) whenever it renames files; apply it once per session
   after the catalog loads, so attempts/completed/saved follow the new paths. */
loadPathMap()
  .then(applyPathMap)
  .catch(() => {
    /* catalog unavailable (offline dev etc.) — skip migration, keep old paths */
  });

/* Surface storage-quota failures to the user — without this the data silently
   lives only in memory and vanishes on reload. */
setStorageHealthListener((healthy) => {
  if (!healthy) {
    toast.error('Storage is full or blocked', {
      description: 'Progress from this session will not survive a reload. Free up site data or leave private mode.',
      duration: Infinity,
      id: 'storage-health', // dedupes repeat failures
    });
  } else {
    toast.dismiss('storage-health');
  }
});

/** Toaster follows the app theme (settingsStore ↔ data-theme are in sync). */
function ThemedToaster() {
  const theme = useSettingsStore((s) => s.theme);
  return (
    <Toaster
      theme={theme === 'dark' || theme === 'netflix' ? 'dark' : 'light'}
      position="bottom-right"
      closeButton
      gap={10}
      toastOptions={{
        style: {
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          color: 'var(--text)',
          boxShadow: 'var(--shadow-lg)',
        },
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <ThemedToaster />
  </StrictMode>,
);
