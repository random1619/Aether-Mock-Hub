import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Clock3, Menu } from 'lucide-react';
import { FROSTED_NAV, ThemeToggle, ProvidersNavDropdown } from '@/components/dashboard';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { useSettingsStore } from '@/stores/settingsStore';
import { clsx } from 'clsx';

interface AppChromeProps {
  /** Current page title shown after the Home breadcrumb. */
  title: ReactNode;
  /** Optional leading icon next to the title (rendered in brand color). */
  icon?: ReactNode;
  /** Optional extra actions inserted before the theme toggle. */
  actions?: ReactNode;
}

/**
 * Shared frosted-glass top bar used by every non-dashboard page (Analytics,
 * Saved, Provider). Sticky, translucent, Apple design language.
 */
export function AppChrome({ title, icon, actions }: AppChromeProps) {
  const { theme, toggleTheme } = useSettingsStore();
  const [isScrolled, setIsScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
    <nav
      className={clsx(
        FROSTED_NAV,
        'min-h-safe-nav',
        theme === 'netflix' && isScrolled && 'bg-black border-transparent'
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' } as any}
    >
      <div className="max-w-7xl mx-auto h-14 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="md:hidden w-9 h-9 grid place-items-center rounded-xl bg-surface-2 active:scale-95 shrink-0">
            <Menu size={16} />
          </button>
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1 text-[13px] text-primary hover:underline transition-colors shrink-0"
          >
            <ArrowLeft size={14} /> Home
          </Link>
          <Link to="/" className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-2 text-primary shrink-0" aria-label="Home">
            <ArrowLeft size={16} />
          </Link>
          <span aria-hidden className="hidden sm:inline text-border-strong">/</span>
          <span className="text-[13px] font-semibold text-text truncate flex items-center gap-1.5">
            {icon && <span className="text-primary hidden min-[380px]:inline">{icon}</span>}
            <span className="truncate max-w-[110px] min-[380px]:max-w-[160px] sm:max-w-none">{title}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}
          <Link to="/showcase" className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text"><Sparkles size={12} /> Showcase</Link>
          <Link to="/activity" className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-text"><Clock3 size={12} /> Activity</Link>
          <div className="hidden sm:block">
            <ProvidersNavDropdown isNetflix={theme === 'netflix'} />
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <ProfileMenu />
        </div>
      </div>
    </nav>
    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
