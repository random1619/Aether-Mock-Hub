import { lazy, Suspense, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useProfileStore } from '@/services/profileStore';
import { LoginGate } from '@/components/profile/LoginGate';
import { SmoothScrollProvider } from '@/components/layout/SmoothScroll';
import { CustomCursor } from '@/components/layout/Cursor';
import { PageTransition } from '@/components/ui';
import Dashboard from '@/pages/Dashboard';
import Exam from '@/pages/Exam';
import OliveboardPage from '@/pages/providers/OliveboardPage';
import EnglishMadhyamPage from '@/pages/providers/EnglishMadhyamPage';
import RandomMocksPage from '@/pages/providers/RandomMocksPage';
import PunditsPage from '@/pages/providers/PunditsPage';
import TheSolverPage from '@/pages/providers/TheSolverPage';
import Mocks360Page from '@/pages/providers/Mocks360Page';
import StaticGkPage from '@/pages/providers/StaticGkPage';
import CurrentAffairsPdfPage from '@/pages/providers/CurrentAffairsPdfPage';
import { MobileBottomBar } from '@/components/layout/MobileBottomBar';

// Lazy-load heavy routes so recharts / large pages stay off Dashboard's critical path.
const Analytics = lazy(() => import('@/pages/Analytics'));
const SavedQuestions = lazy(() => import('@/pages/SavedQuestions'));
const Settings = lazy(() => import('@/pages/Settings'));
const Alarms = lazy(() => import('@/pages/Alarms'));
const Showcase = lazy(() => import('@/pages/Showcase'));
const Activity = lazy(() => import('@/pages/Activity'));

function RouteLoader() {
  return (
    <div className="min-h-screen grid place-items-center page-surface text-muted" role="status">
      <Loader2 className="animate-spin" size={26} aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/**
 * Wrap a route element in PageTransition so every page gets the same cross-fade
 * + rise entrance. Exam is intentionally unwrapped: it manages its own
 * full-screen chrome and question-level AnimatePresence, so an additional page
 * wrapper would double-animate the entrance and fight its focus management.
 */
function withPageTransition(node: ReactElement, opts?: { fadeOnly?: boolean }) {
  return <PageTransition fadeOnly={opts?.fadeOnly}>{node}</PageTransition>;
}

/**
 * Routes wrapped in a location-keyed AnimatePresence so every navigation
 * cross-fades + rises the new page out/in instead of hard-cutting. Must live
 * inside <BrowserRouter> (it calls useLocation). mode="wait" lets the outgoing
 * page finish its 0.14s exit before the incoming page mounts — keeping the
 * transition cheap and avoiding a two-page stack on slow routes.
 */
function AnimatedRoutes() {
  const location = useLocation();
  // Key on profileId too so a profile switch animates as a page remount rather
  // than an in-place data swap.
  const profileId = useProfileStore((s) => s.active?.id ?? null);
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={profileId + location.pathname + location.search}>
        <Route path="/" element={withPageTransition(<Dashboard />)} />
        <Route path="/exam/:encoded" element={<Exam />} />
        <Route path="/provider/oliveboard" element={withPageTransition(<OliveboardPage />)} />
        <Route path="/provider/english-madhyam" element={withPageTransition(<EnglishMadhyamPage />)} />
        <Route path="/provider/random-mocks" element={withPageTransition(<RandomMocksPage />)} />
        <Route path="/provider/pundits" element={withPageTransition(<PunditsPage />)} />
        <Route path="/provider/the-solver" element={withPageTransition(<TheSolverPage />)} />
        <Route path="/provider/360-mocks" element={withPageTransition(<Mocks360Page />)} />
        <Route path="/provider/static-gk" element={withPageTransition(<StaticGkPage />)} />
        <Route path="/provider/current-affairs-pdf" element={withPageTransition(<CurrentAffairsPdfPage />)} />
        <Route
          path="/analytics"
          element={withPageTransition(
            <Suspense fallback={<RouteLoader />}>
              <Analytics />
            </Suspense>,
          )}
        />
        <Route
          path="/saved"
          element={withPageTransition(
            <Suspense fallback={<RouteLoader />}>
              <SavedQuestions />
            </Suspense>,
          )}
        />
        <Route
          path="/settings"
          element={withPageTransition(
            <Suspense fallback={<RouteLoader />}>
              <Settings />
            </Suspense>,
          )}
        />
        <Route
          path="/alarms"
          element={withPageTransition(
            <Suspense fallback={<RouteLoader />}>
              <Alarms />
            </Suspense>,
          )}
        />
        <Route
          path="/showcase"
          element={withPageTransition(
            <Suspense fallback={<RouteLoader />}>
              <Showcase />
            </Suspense>,
          )}
        />
        <Route
          path="/activity"
          element={withPageTransition(
            <Suspense fallback={<RouteLoader />}>
              <Activity />
            </Suspense>,
          )}
        />
        <Route path="*" element={withPageTransition(<NotFound />)} />
      </Routes>
    </AnimatePresence>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center page-surface px-4">
      <div className="text-center">
        <div className="text-6xl font-extrabold text-muted opacity-40 mb-3">404</div>
        <h1 className="text-xl font-bold text-text mb-2">Page not found</h1>
        <p className="text-sm text-muted mb-6">That link doesn't point anywhere in this app.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

import { CommandPalette } from '@/components/search/CommandPalette';
import { initNativeMobile } from '@/services/nativeMobile';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function NativeMobileBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    initNativeMobile((to) => {
      if (typeof to === 'number') {
        navigate(to);
      } else {
        navigate(to);
      }
    });
  }, [navigate]);
  return null;
}

function getBasename(): string {
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol;
    const isCap = proto === 'capacitor:' || !!(window as any).Capacitor?.isNativePlatform?.();
    if (isCap) return '/';
    // Allow overriding via ?base=/ during testing
    const qs = new URLSearchParams(window.location.search);
    if (qs.get('base')) return qs.get('base') as string;
  }
  return '/v2/';
}

export default function App() {
  // Profile-keying now lives on the <Routes> inside AnimatedRoutes, so the
  // whole tree remounts on a profile switch and re-initializes every page's
  // memoized aether-db reads against the new profile's data. The data reload
  // itself happens in main.tsx's onProfileChange → reloadForProfile.
  // When logged out (active === null) LoginGate renders ONLY the login panel —
  // the Routes below never mount, so no store is exercised without a login.
  return (
    // reducedMotion="user" makes every framer-motion animation across the app
    // honor the OS "prefers-reduced-motion" setting (a11y hardening, T6).
    <MotionConfig reducedMotion="user">
      <BrowserRouter basename={getBasename()}>
        <NativeMobileBridge />
        {/* Desktop custom cursor — self-gates to fine pointers, no-ops on
            touch / reduced-motion, and never blocks clicks. */}
        <CustomCursor />
        <LoginGate>
          <SmoothScrollProvider>
            <CommandPalette />
            <AnimatedRoutes />
            <MobileBottomBar />
          </SmoothScrollProvider>
        </LoginGate>
      </BrowserRouter>
    </MotionConfig>
  );
}
