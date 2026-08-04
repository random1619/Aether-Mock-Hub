import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Zap, Play, Info, Volume2, VolumeX, Bookmark, Bell } from 'lucide-react';
import { clsx } from 'clsx';
import { ThemeToggle, SearchPill } from './chrome';
import { NotificationBell } from './NotificationBell';
import { ProvidersNavDropdown } from './ProvidersNavDropdown';
import { DynamicHeader } from './DynamicHeader';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { MockAlarmModal } from '@/components/desktop/MockAlarmModal';
import { useSmoothScroll } from '@/components/layout/SmoothScroll';
import { useHeroParallax } from '@/hooks/useHeroParallax';
import { playNetflixTaDum } from '@/services/soundEffects';
import type { MockEntry } from '@/types';

interface HeroBandProps {
  search: string;
  onSearch: (v: string) => void;
  theme: 'dark' | 'light' | 'netflix';
  onToggleTheme: () => void;
  mockCount: number | null;
  onOpenInfo?: () => void;
  children?: ReactNode;
  mocks?: MockEntry[];
}

export function HeroBand({
  search,
  onSearch,
  theme,
  onToggleTheme,
  mockCount,
  onOpenInfo,
  children,
  mocks,
}: HeroBandProps) {
  const isNetflix = theme === 'netflix';
  const [scrolled, setScrolled] = useState(false);
  const [muted, setMuted] = useState(false);
  const { instance } = useSmoothScroll();
  // Root ref for the GSAP ScrollTrigger parallax scene. The hook internally
  // gates on reduced-motion and only animates elements it can find, so it's
  // safe to call unconditionally here regardless of which hero renders.
  const heroRootRef = useRef<HTMLDivElement>(null);
  useHeroParallax(heroRootRef);

  useEffect(() => {
    // Use LS scroll events when available, fall back to native scroll
    if (instance) {
      const handleScroll = (obj: { scroll: { y: number } }) => {
        setScrolled(obj.scroll.y > 40);
      };
      (instance as any).on?.('scroll', handleScroll);
      return () => { (instance as any).off?.('scroll', handleScroll); };
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [instance]);

  const handleStartMock = () => {
    if (!muted) {
      playNetflixTaDum();
    }
  };

  return (
    <header className="relative z-[9999]">
      {/* Top navbar: adapts to scroll position */}
      <nav
        data-scroll-sticky
        className={clsx(
          'sticky top-0 z-[9999] h-14 transition-all',
          isNetflix
            ? clsx('nav-scrim', scrolled && 'scrolled')
            : 'bg-[var(--glass)] backdrop-blur-xl backdrop-saturate-150 border-b border-[var(--glass-border)]',
          isNetflix && 'duration-[400ms]',
          !isNetflix && 'duration-500',
        )}
      >
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2 shrink-0 group" aria-label="Aether home">
            {/* Apple brand squircle (default) */}
            <span
              className="brandmark-apple w-6 h-6 grid place-items-center text-white shadow-sm transition-transform group-hover:scale-105"
              style={{ borderRadius: '28%', background: 'linear-gradient(150deg,#47a5ff 0%,#0071e3 100%)' }}
            >
              <Zap size={13} strokeWidth={2.5} />
            </span>
            {/* Netflix Wordmark (netflix theme only) */}
            <span
              aria-hidden
              className="brandmark-netflix netflix-wordmark text-xl sm:text-2xl select-none"
            >
              NETFLIX
            </span>
            {!isNetflix && <span className="text-[15px] font-semibold tracking-[-0.01em] text-text">Aether</span>}
          </Link>

          {/* Navigation Links for Apple & Netflix mode */}
          {!isNetflix ? (
            <div className="hidden md:flex items-center gap-1.5 ml-2">
              <ProvidersNavDropdown isNetflix={false} />
              <Link
                to="/saved"
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"
              >
                <Bookmark size={13} className="text-info-fg" /> Saved
              </Link>
              <Link
                to="/analytics"
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"
              >
                <BarChart3 size={13} className="text-primary" /> Analytics
              </Link>
              <Link
                to="/alarms"
                className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"
              >
                <Bell size={13} className="text-warning-fg" /> Alarms
              </Link>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-4 text-sm text-[#E5E5E5] font-medium ml-4">
              <Link to="/" className="hover:text-white transition-colors duration-200 text-white font-bold">Home</Link>
              <ProvidersNavDropdown isNetflix={true} />
              <a href="#all-mocks" className="hover:text-[#b3b3b3] transition-colors duration-200">Catalog</a>
              <a href="#my-list" className="hover:text-[#b3b3b3] transition-colors duration-200">My List</a>
            </div>
          )}

          <div className="flex-1" />

          {/* Search — expandable in Netflix mode */}
          <SearchPill
            value={search}
            onChange={onSearch}
            placeholder={`Search ${mockCount ?? '…'} mocks`}
            ariaLabel="Search mock tests"
            size="sm"
            className="w-36 sm:w-64"
            isNetflix={isNetflix}
            mocks={mocks}
          />

          {/* Netflix Notification Bell */}
          {isNetflix && <NotificationBell />}

          <MockAlarmModal />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <ProfileMenu />
        </div>
      </nav>

      {/* Hero Billboard */}
      {isNetflix ? (
        <div className="hero-band relative overflow-hidden bg-gradient-to-b from-[#1c1c1c] via-[#141414] to-[#141414] pt-32 pb-24 px-4 sm:px-12 md:px-16 w-full min-h-[70vh] flex flex-col justify-end">
          {/* Multi-stop dark gradient scrim */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#141414] via-[#141414]/60 to-transparent z-0" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#141414] via-transparent to-transparent z-0" />

          {/* Maturity rating & sound badge on bottom-right */}
          <div className="absolute bottom-24 right-0 z-10 hidden sm:flex items-center gap-3">
            <button
              onClick={() => {
                const nextMuted = !muted;
                setMuted(nextMuted);
                if (!nextMuted) playNetflixTaDum();
              }}
              className="w-10 h-10 rounded-full border-[1.5px] border-white/50 bg-black/40 text-white flex items-center justify-center hover:bg-white/10 hover:border-white hover:scale-105 active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all duration-200 ease-out backdrop-blur-md mr-2"
              title={muted ? 'Unmute audio' : 'Mute audio'}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              aria-pressed={muted}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <span className="border-l-[3px] border-[#d9d9d9] bg-[#333333]/80 text-white font-bold text-sm pl-4 pr-12 py-1.5 backdrop-blur-md tracking-wider shadow-md">
              TCS 18+
            </span>
          </div>

          <div className="relative z-10 max-w-2xl" data-scroll data-scroll-speed="1.2">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#E50914] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-[2px] tracking-wider uppercase shadow-md">
                N ORIGINAL
              </span>
              <span className="text-xs text-[#A3A3A3] font-semibold uppercase tracking-widest">
                GRAND MOCK SERIES
              </span>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="hero-headline text-4xl sm:text-6xl font-black text-white leading-tight tracking-tight drop-shadow-lg"
            >
              SSC CGL GRAND MOCK 2026
            </motion.h1>

            <div className="flex items-center gap-3 mt-3 text-xs sm:text-sm text-[#A3A3A3] font-semibold">
              <span className="text-[#46d369] font-bold">98% Match</span>
              <span className="border border-white/40 text-white px-1.5 py-0.2 rounded text-[11px]">2026</span>
              <span className="border border-white/40 text-white px-1.5 py-0.2 rounded text-[11px]">Tier 2</span>
              <span>130 Mins</span>
              <span className="bg-white/10 text-white px-2 py-0.5 rounded text-[11px]">TCS Pattern</span>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="hero-sub mt-4 text-sm sm:text-base text-[#E5E5E5] line-clamp-3 leading-relaxed drop-shadow"
            >
              Full-length TCS pattern exam featuring Quantitative Abilities, Reasoning, English Language, and General Awareness modules. Includes comprehensive analytics and instant rank prediction.
            </motion.p>

            <div className="flex items-center gap-3 mt-6">
              <a
                href="#all-mocks"
                onClick={handleStartMock}
                className="bg-white hover:bg-white/75 text-black font-bold text-lg px-6 py-2.5 rounded-[4px] flex items-center gap-2 transition-all duration-200 ease-out active:scale-[0.93] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white shadow-lg"
              >
                <Play size={24} fill="currentColor" /> Play
              </a>
              {onOpenInfo && (
                <button
                  onClick={onOpenInfo}
                  className="bg-[rgba(109,109,110,0.7)] hover:bg-[rgba(109,109,110,0.4)] text-white font-bold text-lg px-6 py-2.5 rounded-[4px] flex items-center gap-2 transition-all duration-200 ease-out active:scale-[0.93] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white backdrop-blur-sm"
                >
                  <Info size={24} /> More Info
                </button>
              )}
            </div>
          </div>

          {children && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mt-10 text-left relative z-10"
            >
              {children}
            </motion.div>
          )}
        </div>
      ) : (
        /* Apple Display hero (default) */
        <div ref={heroRootRef} className="hero-band max-w-7xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-8 text-center">
          <div data-scroll data-scroll-speed="0.7">
            <DynamicHeader mockCount={mockCount} />
          </div>

          {children && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mt-8 text-left"
            >
              {children}
            </motion.div>
          )}
        </div>
      )}
    </header>
  );
}
