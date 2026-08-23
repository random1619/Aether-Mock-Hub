/* SETTINGS STORE — theme + user preferences.
   Reads/writes the shared aether-db settings block; light is default. */
import { create } from 'zustand';
import { getDb, onExternalChange, setTheme as persistTheme } from '@/services/attemptStore';
import { onProfileChange } from '@/services/profileStore';
import { updateNativeStatusBar, haptic } from '@/services/nativeMobile';

type Theme = 'dark' | 'light' | 'netflix' | 'onepiece';

interface SettingsState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

function applyDom(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  updateNativeStatusBar(theme);
}

function readTheme(): Theme {
  const t = getDb().settings.theme;
  return t === 'dark' || t === 'netflix' || t === 'onepiece' ? t : 'light';
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: (() => {
    const theme = readTheme();
    applyDom(theme);
    return theme;
  })(),
  setTheme: (theme) => {
    persistTheme(theme); // mutates aether-db AND saves to localStorage
    applyDom(theme);
    haptic.selection();
    set({ theme });
  },
  toggleTheme: () => {
    /* Quick toggle flips between the two Apple schemes only. Netflix is opt-in
       via the Appearance setting; toggling from Netflix returns to light. */
    const next: Theme = get().theme === 'dark' ? 'light' : get().theme === 'light' ? 'dark' : 'light';
    get().setTheme(next);
  },
}));

/* Cross-tab sync: when another tab writes aether-db (theme toggle, attempt
   submit), pull the fresh theme and apply it here. onExternalChange reloads
   the singleton DB before invoking this callback. */
onExternalChange(() => {
  const theme = readTheme();
  if (theme !== useSettingsStore.getState().theme) {
    applyDom(theme);
    useSettingsStore.setState({ theme });
  }
});

/* Profile switch: each profile keeps its OWN theme inside its namespaced
   aether-db. When the active profile changes, re-read the theme from the
   freshly-loaded DB and apply it. main.tsx orders reloadForProfile() before
   this fires, so getDb() already reflects the new profile. */
onProfileChange(() => {
  const theme = readTheme();
  applyDom(theme);
  useSettingsStore.setState({ theme });
});
