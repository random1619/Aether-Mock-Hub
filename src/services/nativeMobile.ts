import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { toast } from 'sonner';

/** Is the app currently running inside a native mobile container (Android / iOS)? */
export function isNativeMobile(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

/** Haptic feedback helpers that safely no-op on desktop and web */
export const haptic = {
  tap: async () => {
    if (!isNativeMobile()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {}
  },
  medium: async () => {
    if (!isNativeMobile()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {}
  },
  heavy: async () => {
    if (!isNativeMobile()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}
  },
  selection: async () => {
    if (!isNativeMobile()) return;
    try {
      await Haptics.selectionChanged();
    } catch {}
  },
  success: async () => {
    if (!isNativeMobile()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {}
  },
  warning: async () => {
    if (!isNativeMobile()) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch {}
  },
  error: async () => {
    if (!isNativeMobile()) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {}
  },
};

/** Stack of custom back-button handlers (e.g. for closing open modals/drawers) */
type BackHandler = () => boolean | void;
const backHandlerStack: BackHandler[] = [];

/**
 * Register a back-button interceptor (e.g. when a modal opens).
 * Returns an unregister function to call when the modal closes/unmounts.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  backHandlerStack.push(handler);
  return () => {
    const idx = backHandlerStack.lastIndexOf(handler);
    if (idx !== -1) {
      backHandlerStack.splice(idx, 1);
    }
  };
}

/** Enable true fullscreen - hides status bar to minimize notification bar */
export async function enableFullscreen(): Promise<void> {
  if (!isNativeMobile()) return;
  try {
    await StatusBar.hide();
  } catch {}
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {}
}

export async function disableFullscreen(): Promise<void> {
  if (!isNativeMobile()) return;
  try { await StatusBar.show(); } catch {}
}

/** Synchronize the native mobile status bar colors with the active theme */
export async function updateNativeStatusBar(theme: 'light' | 'dark' | 'netflix' | 'onepiece'): Promise<void> {
  if (!isNativeMobile()) return;

  try {
    // Fullscreen: keep status bar hidden for immersive experience
    // We still set overlay and style for when it briefly appears on swipe
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.hide();

    if (theme === 'light') {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#fbfbfd' });
    } else if (theme === 'onepiece') {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#070B14' });
    } else if (theme === 'netflix') {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#141414' });
    } else {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#000000' });
    }
  } catch (err) {
    console.debug('[nativeMobile] StatusBar update error:', err);
  }
}

let backButtonInitialized = false;
let lastBackPressTime = 0;

/** Initialize native mobile listeners: back button, splash screen, status bar */
export function initNativeMobile(navigate?: (to: string | number) => void): void {
  if (!isNativeMobile()) return;

  // 0. Immediately enter fullscreen - hide notification/status bar
  try {
    StatusBar.hide().catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  } catch {}

  // 1. Hide splash screen smoothly after app is ready
  setTimeout(() => {
    SplashScreen.hide().catch(() => {});
    // Re-assert fullscreen after splash
    StatusBar.hide().catch(() => {});
  }, 400);

  // 2. Setup Android Hardware Back Button listener
  if (!backButtonInitialized) {
    backButtonInitialized = true;

    App.addListener('backButton', ({ canGoBack }) => {
      // A. Check if any modal or drawer back handler is active in the stack
      if (backHandlerStack.length > 0) {
        const topHandler = backHandlerStack[backHandlerStack.length - 1];
        const handled = topHandler();
        if (handled !== false) {
          haptic.tap();
          return;
        }
      }

      // B. Check active route
      const currentPath = window.location.pathname;
      const isExamRoute = currentPath.includes('/exam/');
      const isHome = currentPath === '/' || currentPath === '/v2/' || currentPath === '';

      // If in active exam, let the exam's custom handler or back prompt trigger
      if (isExamRoute) {
        // Dispatch custom event for Exam page to open exit confirmation
        const event = new CustomEvent('aether:exam-back-pressed');
        window.dispatchEvent(event);
        haptic.warning();
        return;
      }

      // If on an inner page, navigate back to home or previous page
      if (!isHome && (canGoBack || window.history.length > 1)) {
        haptic.tap();
        if (navigate) {
          navigate(-1);
        } else {
          window.history.back();
        }
        return;
      }

      // If on home dashboard: double tap back within 2s to exit app
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        haptic.tap();
        App.exitApp().catch(() => {});
      } else {
        lastBackPressTime = now;
        haptic.tap();
        toast('Press back again to exit Aether Mocks', {
          duration: 2000,
          id: 'exit-app-toast',
        });
      }
    });
  }
}
