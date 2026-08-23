import { useEffect, useRef } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bookmark, BarChart3, Clock3, Bell, Sparkles, LayoutGrid, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useSettingsStore } from '@/stores/settingsStore';
import { ProvidersNavDropdown } from '@/components/dashboard/ProvidersNavDropdown';
import { SPRING_DRAWER } from '@/lib/motion';
import { registerBackHandler } from '@/services/nativeMobile';
import { acquireScrollLock } from '@/services/scrollLock';

/** Slide-over drawer for mobile hamburger — providers + secondary links.
 *  Uses spring drawer physics, backdrop blur, and focus trap via inert.
 */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocused.current = document.activeElement as HTMLElement;
    const focusPanel = () => {
      const first = panelRef.current?.querySelector<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])');
      first?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>('button, a, [tabindex]:not([tabindex="-1"])');
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    const focusTimer = window.setTimeout(focusPanel, 0);
    const releaseScrollLock = acquireScrollLock();
    const unregBack = registerBackHandler(() => {
      onClose();
      return true;
    });

    return () => {
      unregBack();
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey, true);
      releaseScrollLock();
      lastFocused.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            aria-hidden
            className="md:hidden fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className={clsx(
              'md:hidden fixed inset-y-0 left-0 z-[9999] w-[84%] max-w-[320px] flex flex-col overflow-hidden shadow-2xl',
              isNetflix ? 'bg-[#181818] border-r border-[#2a2a2a]' : 'bg-bg-raised border-r border-[var(--glass-border)]',
            )}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={SPRING_DRAWER as any}
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' } as any}
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-[var(--glass-border)] shrink-0">
              <Link to="/" onClick={onClose} className="flex items-center gap-2">
                <span className="w-7 h-7 grid place-items-center rounded-[28%] text-white" style={{ background: 'linear-gradient(150deg,#47a5ff 0%,#0071e3 100%)' }}>
                  <Zap size={14} />
                </span>
                <span className="text-[15px] font-bold tracking-[-0.01em]">Aether</span>
              </Link>
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="w-11 h-11 grid place-items-center rounded-2xl bg-surface-2 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' } as any}>
              <div className="space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted px-2 mb-1">Navigate</div>
                {[
                  { to: '/', label: 'Home', icon: LayoutGrid, end: true },
                  { to: '/showcase', label: 'Showcase', icon: Sparkles },
                  { to: '/activity', label: 'Activity', icon: Clock3 },
                  { to: '/saved', label: 'Saved', icon: Bookmark },
                  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
                  { to: '/alarms', label: 'Alarms', icon: Bell },
                ].map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end as any}
                    onClick={onClose}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold active:scale-[0.98] transition-all',
                        isActive ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-text hover:bg-surface-3',
                      )
                    }
                  >
                    <Icon size={18} />
                    {label}
                  </NavLink>
                ))}
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted px-2">Providers</div>
                <div className="px-2">
                  <ProvidersNavDropdown isNetflix={isNetflix} />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--glass-border)] text-xs text-muted">
              1,000+ mocks • Offline ready on Android
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
