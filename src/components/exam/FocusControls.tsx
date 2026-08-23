import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Volume2, X } from 'lucide-react';
import { useGamificationStore } from '@/stores/gamificationStore';
import { startAmbientSound, stopAmbientSound, setAmbientVolume } from '@/services/focusService';
import type { AmbientSoundType } from '@/services/focusService';

export function FocusControls() {
  const { ambientSoundType, setAmbientSoundType, ambientVolume, setAmbientVolume: updateVolume } = useGamificationStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ambientSoundType !== 'off') {
      startAmbientSound(ambientSoundType, ambientVolume);
    } else {
      stopAmbientSound();
    }
    return () => {
      stopAmbientSound();
    };
  }, [ambientSoundType]);

  const handleSelectSound = (type: AmbientSoundType) => {
    setAmbientSoundType(type);
    if (type === 'off') {
      stopAmbientSound();
    } else {
      startAmbientSound(type, ambientVolume);
    }
  };

  const handleVolumeChange = (vol: number) => {
    updateVolume(vol);
    setAmbientVolume(vol);
  };

  const isPlaying = ambientSoundType !== 'off';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
          isPlaying
            ? 'bg-gradient-to-r from-[#00F5D4]/20 to-[#7B2CBF]/20 text-[#00F5D4] border border-[#00F5D4]/40 shadow-sm animate-pulse'
            : 'bg-surface-2 text-text-2 hover:text-text hover:bg-surface-3'
        }`}
        title="Focus Audio & Concentration Soundscapes"
        aria-label="Focus Audio Settings"
      >
        <Headphones size={13} className={isPlaying ? 'text-[#00F5D4]' : 'text-muted'} />
        <span className="hidden sm:inline">{isPlaying ? 'Audio Active' : 'Focus Audio'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-surface border border-[var(--glass-border)] shadow-2xl p-4 z-[9999] backdrop-blur-xl text-left"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary grid place-items-center">
                  <Headphones size={13} />
                </span>
                <span className="text-xs font-black text-text uppercase tracking-wider">
                  Deep Focus Audio
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-full bg-surface-2 grid place-items-center text-muted hover:text-text"
              >
                <X size={12} />
              </button>
            </div>

            {/* Soundscape Options */}
            <div className="space-y-1.5 my-3">
              {[
                { type: 'off' as const, label: 'Sound Off', desc: 'Silent study mode' },
                { type: 'binaural_alpha' as const, label: 'Binaural Alpha (10Hz)', desc: 'Cognitive retention & alertness' },
                { type: 'brown_noise' as const, label: 'Deep Brown Noise', desc: 'Low rumble blocks ambient room chatter' },
                { type: 'rain_library' as const, label: 'Rainy Library', desc: 'Calming pink rainfall texture' },
              ].map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleSelectSound(opt.type)}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-all flex flex-col ${
                    ambientSoundType === opt.type
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-surface-2 text-text hover:bg-surface-3'
                  }`}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className={`text-[10px] ${ambientSoundType === opt.type ? 'text-white/80' : 'text-muted'}`}>
                    {opt.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* Volume Slider */}
            {isPlaying && (
              <div className="pt-2 border-t border-border space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-muted">
                  <span className="flex items-center gap-1">
                    <Volume2 size={12} /> Volume
                  </span>
                  <span>{Math.round(ambientVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1"
                  step="0.05"
                  value={ambientVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-primary h-1.5 bg-surface-3 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
