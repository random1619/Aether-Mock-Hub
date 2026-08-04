import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { FROSTED_NAV, ThemeToggle, ProvidersNavDropdown } from '@/components/dashboard';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
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

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={clsx(
      FROSTED_NAV,
      theme === 'netflix' && isScrolled && 'bg-black border-transparent'
    )}>
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline transition-colors shrink-0"
          >
            <ArrowLeft size={14} /> Home
          </Link>
          <span aria-hidden className="text-border-strong">/</span>
          <span className="text-[13px] font-semibold text-text truncate flex items-center gap-1.5">
            {icon && <span className="text-primary">{icon}</span>}
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <div className="hidden sm:block">
            <ProvidersNavDropdown isNetflix={theme === 'netflix'} />
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <ProfileMenu />
        </div>
      </div>
    </nav>
  );
}
