import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Zap, Play, Info, Volume2, VolumeX, Bookmark, Bell, Clock3, Menu } from 'lucide-react';
import { clsx } from 'clsx';
import { ThemeToggle, SearchPill } from './chrome';
import { NotificationBell } from './NotificationBell';
import { ProvidersNavDropdown } from './ProvidersNavDropdown';
import { DynamicHeader } from './DynamicHeader';
import { ProfileMenu } from '@/components/profile/ProfileMenu';
import { MockAlarmModal } from '@/components/desktop/MockAlarmModal';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { useSmoothScroll } from '@/components/layout/SmoothScroll';
import { useHeroParallax } from '@/hooks/useHeroParallax';
import { playNetflixTaDum } from '@/services/soundEffects';
import type { MockEntry } from '@/types';

interface HeroBandProps {
  search: string;
  onSearch: (v: string) => void;
  theme: 'dark' | 'light' | 'netflix' | 'onepiece';
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
  const isOnePiece = theme === 'onepiece';
  const [scrolled, setScrolled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    <header className="relative z-[9999] isolate">
      {/* Top navbar: adapts to scroll position */}
      <nav
        data-scroll-sticky
        className={clsx(
          'sticky top-0 z-[9999] transition-all min-h-safe-nav',
          isNetflix
            ? clsx('nav-scrim', scrolled && 'scrolled')
            : 'bg-[var(--glass)] backdrop-blur-xl backdrop-saturate-150 border-b border-[var(--glass-border)]',
          isNetflix && 'duration-[400ms]',
          !isNetflix && 'duration-500',
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' } as any}
      >
        <div className="max-w-7xl mx-auto h-14 px-3 sm:px-6 flex items-center gap-2.5 sm:gap-6">
          {/* Mobile hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="md:hidden w-10 h-10 -ml-1 grid place-items-center rounded-xl bg-surface-2 active:scale-95 transition-transform shrink-0"
          >
            <Menu size={18} />
          </button>
          <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
          <Link to="/" className="flex items-center gap-2 shrink-0 group" aria-label="Aether home">
            {/* Apple / One Piece brand squircle */}
            <span
              className="brandmark-apple w-6 h-6 grid place-items-center text-white shadow-sm transition-transform group-hover:scale-105"
              style={{
                borderRadius: '28%',
                background: isOnePiece
                  ? 'linear-gradient(135deg, #FFB703 0%, #FF334B 100%)'
                  : 'linear-gradient(150deg,#47a5ff 0%,#0071e3 100%)',
              }}
            >
              {isOnePiece ? <span className="text-xs leading-none">☠️</span> : <Zap size={13} strokeWidth={2.5} />}
            </span>
            {/* Wordmark */}
            {isOnePiece ? (
              <span
                aria-hidden
                className="brandmark-onepiece text-lg sm:text-xl select-none font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#FFB703] via-[#FFD600] to-[#FF334B]"
              >
                GRAND LINE
              </span>
            ) : isNetflix ? (
              <span
                aria-hidden
                className="brandmark-netflix netflix-wordmark text-xl sm:text-2xl select-none"
              >
                NETFLIX
              </span>
            ) : (
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-text">Aether</span>
            )}
          </Link>

          {/* Navigation Links for Apple, One Piece & Netflix mode */}
          {isOnePiece ? (
            <div className="hidden md:flex items-center gap-1 ml-2">
              <ProvidersNavDropdown isNetflix={false} />
              <Link to="/showcase" className="px-3 py-1.5 rounded-full text-xs font-bold text-[#FFB703] hover:bg-[#FFB703]/10 transition-all flex items-center gap-1.5">✦ Grand Line</Link>
              <Link to="/saved" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-[#FFB703] hover:bg-surface-2 transition-all flex items-center gap-1.5"><Bookmark size={13} className="text-[#FFB703]" /> Log Pose</Link>
              <Link to="/activity" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"><Clock3 size={13} className="text-[#10B981]" /> Battles</Link>
              <Link to="/analytics" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"><BarChart3 size={13} className="text-[#FF334B]" /> Haki Stats</Link>
              <Link to="/alarms" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"><Bell size={13} className="text-[#FFB703]" /> Alarms</Link>
            </div>
          ) : !isNetflix ? (
            <div className="hidden md:flex items-center gap-1 ml-2">
              <ProvidersNavDropdown isNetflix={false} />
              <Link to="/showcase" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5">✦ Showcase</Link>
              <Link to="/activity" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"><Clock3 size={13} className="text-success-fg" /> Activity</Link>
              <Link to="/saved" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"><Bookmark size={13} className="text-info-fg" /> Saved</Link>
              <Link to="/analytics" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"><BarChart3 size={13} className="text-primary" /> Analytics</Link>
              <Link to="/alarms" className="px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all flex items-center gap-1.5"><Bell size={13} className="text-warning-fg" /> Alarms</Link>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-1.5 ml-3">
              <Link to="/" className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/15 text-white transition-all shadow-xs">Home</Link>
              <ProvidersNavDropdown isNetflix={true} />
              <Link to="/showcase" className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5">✦ Showcase</Link>
              <Link to="/activity" className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"><Clock3 size={13} className="text-[#46d369]" /> Activity</Link>
              <Link to="/saved" className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"><Bookmark size={13} className="text-[#E50914]" /> My List</Link>
              <Link to="/analytics" className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"><BarChart3 size={13} className="text-[#54b9c5]" /> Stats</Link>
            </div>
          )}

          <div className="hidden sm:block flex-1" />

          {/* Desktop search */}
          <SearchPill
            value={search}
            onChange={onSearch}
            placeholder={`Search ${mockCount ?? '…'} mocks`}
            ariaLabel="Search mock tests"
            size="sm"
            className="hidden sm:flex flex-1 min-w-0 max-w-[260px] sm:w-64"
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
      {/* APK Mobile search — full-width 48dp, thumb-friendly, below nav */}
      <div className="sm:hidden px-3 py-3 bg-surface/95 backdrop-blur-xl border-b border-border shadow-sm">
        <SearchPill
          value={search}
          onChange={onSearch}
          placeholder={`Search ${mockCount ?? '…'} mocks`}
          ariaLabel="Search mock tests"
          size="md"
          className="w-full [&_input]:h-12 [&_input]:text-[15px] [&_input]:pl-11 [&_input]:rounded-full [&_input]:shadow-sm [&_input]:border [&_input]:border-border"
          isNetflix={isNetflix}
          mocks={mocks}
        />
      </div>

      {/* Hero Billboard - One Piece Grand Line / Netflix / Apple Display */}
      {isOnePiece ? (
        <div className="hero-band relative overflow-hidden bg-gradient-to-b from-[#0B1323] via-[#070B14] to-[#070B14] pt-12 pb-6 sm:pt-28 sm:pb-20 px-4 sm:px-12 md:px-16 w-full min-h-[38vh] sm:min-h-[66vh] flex flex-col justify-end border-b border-[var(--glass-border)]">
          {/* Grand Line Cosmic / Sea lighting */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,183,3,0.18),transparent_70%)] z-0" />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_90%_20%,rgba(255,51,75,0.14),transparent_50%)] z-0" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#070B14] via-transparent to-transparent z-0" />

          {/* Pirate King Crest on bottom-right */}
          <div className="absolute bottom-20 right-8 z-10 hidden lg:flex flex-col items-end gap-2 pointer-events-none select-none opacity-90">
            <div className="border border-[#FFB703]/30 bg-[#0D1524]/90 rounded-2xl p-4 backdrop-blur-md shadow-2xl flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FFB703] to-[#FF334B] grid place-items-center text-2xl shadow-lg">
                ☠️
              </div>
              <div className="text-left">
                <div className="text-xs font-extrabold text-[#FFB703] tracking-widest uppercase">PIRATE KING TIER</div>
                <div className="text-sm font-black text-white">SSC CGL 2026 PINNACLE</div>
                <div className="text-[11px] text-muted">Haki Mastery · 390/390</div>
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-2xl" data-scroll data-scroll-speed="1.2">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="bg-gradient-to-r from-[#FFB703] to-[#FF334B] text-black text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider uppercase shadow-md flex items-center gap-1">
                <span>☠️</span> GRAND LINE VOYAGE
              </span>
              <span className="text-xs text-[#FFB703] font-bold uppercase tracking-widest">
                CONQUEROR'S SSC MOCK SERIES
              </span>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="hero-headline text-3xl sm:text-5xl lg:text-6xl font-black text-white leading-tight tracking-tight drop-shadow-lg"
            >
              CONQUER THE GRAND LINE OF SSC 2026
            </motion.h1>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 text-xs sm:text-sm font-semibold">
              <span className="text-[#FFB703] font-black">👑 Max Bounty: 390 Marks</span>
              <span className="border border-[#FFB703]/40 text-[#FFB703] px-2 py-0.5 rounded-full text-[11px] font-bold">⚡ Gear 5 Speed</span>
              <span className="border border-white/20 text-white px-2 py-0.5 rounded-full text-[11px]">TCS Conqueror Engine</span>
              <span className="bg-[#FF334B]/20 text-[#FF334B] px-2 py-0.5 rounded-full text-[11px] font-bold">Tier 2 Ready</span>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="hero-sub mt-4 text-xs sm:text-sm sm:text-base text-text-2 line-clamp-3 leading-relaxed drop-shadow"
            >
              Master Quantitative Abilities, Advanced Reasoning, English Comprehension, and General Studies with authentic TCS battle simulation. Rise to the top of the leaderboard.
            </motion.p>

            <div className="flex items-center gap-3 mt-6">
              <a
                href="#all-mocks"
                className="bg-gradient-to-r from-[#FFB703] via-[#FFD600] to-[#FF8F00] hover:brightness-110 text-black font-black text-sm sm:text-base px-5 sm:px-7 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 ease-out active:scale-95 shadow-[0_4px_20px_rgba(255,183,3,0.35)]"
              >
                <Play size={20} fill="currentColor" /> Set Sail &amp; Battle
              </a>
              <Link
                to="/saved"
                className="bg-surface-2/80 hover:bg-surface-3 text-white border border-[var(--glass-border)] font-bold text-sm sm:text-base px-4 sm:px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all duration-200 ease-out active:scale-95 backdrop-blur-sm"
              >
                <Bookmark size={18} className="text-[#FFB703]" /> Log Pose
              </Link>
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
      ) : isNetflix ? (
        <div className="hero-band relative overflow-hidden bg-gradient-to-b from-[#181818] via-[#0e0e0e] to-[#0e0e0e] pt-14 pb-6 sm:pt-32 sm:pb-24 px-4 sm:px-12 md:px-16 w-full min-h-[38vh] sm:min-h-[70vh] flex flex-col justify-end border-b border-[var(--glass-border)]">
          {/* Multi-stop dark gradient scrim with ambient crimson wash */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#0e0e0e] via-[#0e0e0e]/70 to-transparent z-0" />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_85%_10%,rgba(229,9,20,0.18),transparent_60%)] z-0" />
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent z-0" />

          {/* Maturity rating & sound badge on bottom-right — Apple frosted glass styling */}
          <div className="absolute bottom-24 right-0 z-10 hidden sm:flex items-center gap-3">
            <button
              onClick={() => {
                const nextMuted = !muted;
                setMuted(nextMuted);
                if (!nextMuted) playNetflixTaDum();
              }}
              className="w-11 h-11 rounded-full border border-white/30 bg-black/40 text-white flex items-center justify-center hover:bg-white/15 hover:scale-105 active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all duration-200 ease-out backdrop-blur-md"
              title={muted ? 'Unmute audio' : 'Mute audio'}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              aria-pressed={muted}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <span className="rounded-full border border-white/25 bg-black/50 text-white font-bold text-xs px-4 py-2 backdrop-blur-md tracking-wider shadow-md">
              TCS 18+
            </span>
          </div>

          <div className="relative z-10 max-w-2xl" data-scroll data-scroll-speed="1.2">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-[#E50914] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wider uppercase shadow-md flex items-center gap-1">
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

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mt-3 text-xs sm:text-sm text-[#A3A3A3] font-semibold">
              <span className="text-[#46d369] font-bold">98% Match</span>
              <span className="border border-white/25 bg-white/5 text-white px-2.5 py-0.5 rounded-full text-[11px]">2026</span>
              <span className="border border-white/25 bg-white/5 text-white px-2.5 py-0.5 rounded-full text-[11px]">Tier 2</span>
              <span className="text-white/80">130 Mins</span>
              <span className="bg-white/10 text-white border border-white/15 px-2.5 py-0.5 rounded-full text-[11px]">TCS Pattern</span>
            </div>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="hero-sub mt-4 text-sm sm:text-base text-[#E5E5E5] line-clamp-3 leading-relaxed drop-shadow"
            >
              Full-length TCS pattern exam featuring Quantitative Abilities, Reasoning, English Language, and General Awareness modules. Includes comprehensive analytics and instant rank prediction.
            </motion.p>

            {/* Apple Pill Action Buttons for Netflix */}
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <a
                href="#all-mocks"
                onClick={handleStartMock}
                className="bg-white hover:bg-white/90 text-black font-extrabold text-sm sm:text-base px-6 sm:px-8 py-2.5 sm:py-3 rounded-full flex items-center gap-2.5 transition-all duration-200 ease-out active:scale-95 shadow-[0_4px_24px_rgba(255,255,255,0.35)]"
              >
                <Play size={20} fill="currentColor" /> Play
              </a>
              {onOpenInfo && (
                <button
                  onClick={onOpenInfo}
                  className="bg-white/15 hover:bg-white/25 text-white border border-white/20 hover:border-white/35 font-bold text-sm sm:text-base px-5 sm:px-7 py-2.5 sm:py-3 rounded-full flex items-center gap-2 transition-all duration-200 ease-out active:scale-95 backdrop-blur-xl shadow-md"
                >
                  <Info size={20} /> More Info
                </button>
              )}
              <Link
                to="/saved"
                className="bg-white/10 hover:bg-white/20 text-white border border-white/15 font-semibold text-sm sm:text-base px-4 sm:px-6 py-2.5 sm:py-3 rounded-full hidden sm:flex items-center gap-2 transition-all duration-200 ease-out active:scale-95 backdrop-blur-md"
              >
                <Bookmark size={18} className="text-[#E50914]" /> My List
              </Link>
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
        /* Apple Display hero (default) - APK compact */
        <div ref={heroRootRef} className="hero-band max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-6 sm:pb-8 text-center">
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
