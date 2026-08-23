import { NavLink, useLocation } from 'react-router-dom';
import { LayoutGrid, Bookmark, BarChart3, Clock3, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { useSettingsStore } from '@/stores/settingsStore';

/** iOS-like bottom tab bar — only renders on mobile (md:hidden).
 *  5 primary tabs + safe-area inset for iPhone home indicator.
 *  Uses NavLink isActive for filled state, springs on tap.
 */
export function MobileBottomBar() {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const isOnePiece = theme === 'onepiece';
  const { pathname } = useLocation();
  if (pathname.startsWith('/exam')) return null;
  // APK perfect: 5 primary tabs max for thumb reachability on 320–412px screens.
  // Showcase & Alarms moved to top drawer/profile to keep 5-tab limit and 48dp targets.
  const tabs = isOnePiece
    ? ([
        { to: '/', label: 'Voyage', icon: LayoutGrid },
        { to: '/saved', label: 'Log Pose', icon: Bookmark },
        { to: '/analytics', label: 'Haki Stats', icon: BarChart3 },
        { to: '/activity', label: 'Battles', icon: Clock3 },
        { to: '/alarms', label: 'Alarms', icon: Bell },
      ] as const)
    : ([
        { to: '/', label: 'Home', icon: LayoutGrid },
        { to: '/saved', label: 'Saved', icon: Bookmark },
        { to: '/analytics', label: 'Stats', icon: BarChart3 },
        { to: '/activity', label: 'Activity', icon: Clock3 },
        { to: '/alarms', label: 'Alarms', icon: Bell },
      ] as const);

  return (
    <nav
      aria-label="Primary"
      className={clsx(
        'md:hidden fixed bottom-0 inset-x-0 z-[998] border-t',
        'flex items-center justify-between px-2 pt-1.5',
        isOnePiece
          ? 'bg-[#070B14]/95 backdrop-blur-xl border-[var(--glass-border)]'
          : isNetflix
          ? 'bg-[#141414]/95 backdrop-blur-xl border-[#2a2a2a]'
          : 'bg-[var(--glass)] backdrop-blur-[20px] backdrop-saturate-[180%] border-[var(--glass-border)] supports-[backdrop-filter:blur(0)]:bg-[var(--glass)]',
      )}
      style={{
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        paddingTop: '0.4rem',
      } as any}
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            clsx(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 px-1 rounded-2xl text-[10px] font-bold tracking-wide transition-all active:scale-[0.92] min-h-[48px] min-w-0',
              isActive
                ? isOnePiece
                  ? 'text-[#FFB703] bg-[#FFB703]/15 shadow-sm border border-[#FFB703]/30'
                  : isNetflix
                  ? 'text-white bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                  : 'text-primary bg-primary-soft shadow-sm'
                : isOnePiece
                  ? 'text-[#94A3B8] active:text-[#FFB703] active:bg-white/5'
                  : isNetflix
                  ? 'text-[#8a8a8a] active:text-white active:bg-white/5'
                  : 'text-muted active:text-text active:bg-surface-2',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={22} strokeWidth={isActive ? 2.6 : 2} className="shrink-0" />
              <span className="leading-none text-[10px] truncate w-full text-center">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
