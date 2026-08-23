import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useProfileStore } from '@/services/profileStore';

function cleanDisplayName(rawName: string | undefined): string {
  if (!rawName) return '';
  let name = rawName.trim();
  // If email format (e.g. admin@example.com), extract username before @
  if (name.includes('@')) {
    name = name.split('@')[0];
  }
  // Extract first word/name segment
  const firstWord = name.split(/[\s._-]+/)[0];
  if (!firstWord) return '';
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const SUBTITLES = [
  '1,181+ mocks from Oliveboard, Pundits & English Madhyam.',
  'Targeted section-wise practice for Quant, Reasoning & English.',
  'Detailed solutions, TCS exam timing & section analytics built-in.',
  'Track your daily streak and revise wrong questions effortlessly.',
  'One clean, distraction-free environment to conquer SSC CGL.',
];

export function DynamicHeader({ mockCount }: { mockCount?: number | null }) {
  void mockCount;
  const activeProfile = useProfileStore((s) => s.active);
  const userName = cleanDisplayName(activeProfile?.name);
  
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [subtitleIndex, setSubtitleIndex] = useState(0);

  // Time-aware primary greeting
  const timeGreeting = getTimeGreeting();

  const dynamicGreetings = [
    `${timeGreeting}${userName ? `, ${userName}` : ''}.`,
    `Ready to practice${userName ? `, ${userName}` : ''}?`,
    `Keep the streak alive${userName ? `, ${userName}` : ''} 🔥`,
    `Let's conquer your target${userName ? `, ${userName}` : ''} 🚀`,
    `Time to sharpen your speed${userName ? `, ${userName}` : ''} ⚡`,
  ];

  // Rotate greeting every 4.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setGreetingIndex((prev) => (prev + 1) % dynamicGreetings.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [dynamicGreetings.length]);

  // Rotate subtitle every 3.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setSubtitleIndex((prev) => (prev + 1) % SUBTITLES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center max-w-4xl mx-auto px-2">
      {/* Dynamic Headline — responsive text sizing & auto line height without overflow clipping */}
      <h1 className="hero-headline text-2xl sm:text-5xl lg:text-6xl font-bold tracking-[-0.025em] text-text leading-[1.12] min-h-[1.3em] flex items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={greetingIndex}
            initial={{ opacity: 0, y: 10, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(2px)' }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block bg-gradient-to-r from-text via-text to-text/80 bg-clip-text py-0.5 sm:py-1"
          >
            {dynamicGreetings[greetingIndex]}
          </motion.span>
        </AnimatePresence>
      </h1>

      {/* Dynamic Subtitle */}
      <div className="hero-sub mt-2 sm:mt-3 text-xs sm:text-base lg:text-lg text-muted font-medium tracking-[-0.01em] min-h-[1.5em] flex items-center justify-center text-center max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.p
            key={subtitleIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block px-2"
          >
            {SUBTITLES[subtitleIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
