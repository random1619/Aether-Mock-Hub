import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useRef } from 'react';
import { Zap, Layers, Gauge, Sparkles, ArrowRight, Play, Target, Clock3, Trophy, BookOpen, Shield, Boxes } from 'lucide-react';
import { Reveal, RevealStagger, RevealItem } from '@/components/ui/Reveal';
import { AppChrome } from '@/components/layout';
import { SPRING_SOFT } from '@/lib/motion';

export default function Showcase() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

  return (
    <div className="min-h-screen page-surface overflow-clip pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
      <AppChrome title="Showcase" icon={<Sparkles size={14} />} />

      {/* ── Hero — editorial, asymmetric, materialize ── */}
      <div ref={heroRef} className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-4">
        <motion.div style={{ y: heroY, opacity: heroOpacity, scale: heroScale }} className="will-change-transform">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Apple Fluid Interfaces — Live in Aether
              </div>
              <h1 className="mt-4 text-4xl sm:text-5xl lg:text-[3.2rem] font-black tracking-[-0.03em] leading-[0.95] text-text">
                Interfaces that
                <span className="block bg-gradient-to-r from-primary to-[#5ac8fa] bg-clip-text text-transparent">feel like physics.</span>
              </h1>
              <p className="mt-4 text-[17px] leading-relaxed text-muted max-w-[36rem]">
                Every spring, every rubber-band, every velocity handoff in this app follows WWDC{' '}
                <span className="font-semibold text-text">Designing Fluid Interfaces</span>. The motion starts from the
                current pixel, inherits your finger&apos;s velocity, and can be grabbed mid-flight.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white font-semibold hover:bg-primary-hover active:scale-[0.97] transition-all shadow-sm">
                  <Play size={16} fill="currentColor" /> Explore mocks
                </Link>
                <Link to="/activity" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-surface-2 text-text font-semibold hover:bg-surface-3 active:scale-[0.97] transition-all">
                  View activity <ArrowRight size={16} />
                </Link>
              </div>
              <div className="mt-6 flex items-center gap-6 text-xs text-muted">
                <span className="flex items-center gap-1.5"><Clock3 size={14} /> 60fps springs</span>
                <span className="flex items-center gap-1.5"><Target size={14} /> 1:1 tracking</span>
                <span className="flex items-center gap-1.5"><Zap size={14} /> Interruptible</span>
              </div>
            </div>

            {/* Right — live bento preview (motion blur hint at speed) */}
            <div className="relative">
              <div className="absolute -inset-6 bg-gradient-to-br from-primary/10 via-transparent to-[#5ac8fa]/10 rounded-[28px] blur-2xl" aria-hidden />
              <div className="relative grid grid-cols-2 gap-3">
                <BentoTile icon={<Gauge size={18} />} label="Response" value="pointer-down" hint="Highlight on press, not release" delay={0} />
                <BentoTile icon={<Layers size={18} />} label="Direct" value="1:1 glue" hint="Respects grab offset" delay={0.06} />
                <BentoTile icon={<Boxes size={18} />} label="Interruptible" value="from presentation" hint="Grab mid-flight" delay={0.12} />
                <BentoTile icon={<Sparkles size={18} />} label="Material" value="glass + blur" hint="Content scrolls under" delay={0.18} />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Principles — bento editorial grid ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <Reveal>
          <div className="rounded-[24px] bg-surface ring-1 ring-[var(--glass-border)] p-6 sm:p-8 overflow-hidden">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h2 className="text-2xl font-bold tracking-[-0.02em] text-text">The eight principles, built in</h2>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Purpose · Agency · Craft · Delight</span>
            </div>

            <RevealStagger className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" staggerDelay={0.06}>
              <RevealItem><PrincipleCard icon={<Target size={18} />} title="Predictable" desc="Symmetric enter/exit, anchored origins, wayfinding on every screen." /></RevealItem>
              <RevealItem><PrincipleCard icon={<Shield size={18} />} title="Forgiving" desc="Easy undo, hysteresis on taps, no destructive confirm spam." /></RevealItem>
              <RevealItem><PrincipleCard icon={<BookOpen size={18} />} title="Familiar" desc="Metaphors + physics people already know. Trash means delete." /></RevealItem>
              <RevealItem><PrincipleCard icon={<Boxes size={18} />} title="Flexible" desc="Adapts to pointer, touch, reduced motion & contrast." /></RevealItem>
              <RevealItem><PrincipleCard icon={<Zap size={18} />} title="Simple" desc="Common path first, advanced one level deeper. Not minimal — clear." /></RevealItem>
              <RevealItem><PrincipleCard icon={<Sparkles size={18} />} title="Crafted" desc="Every spacing, timing, blur radius defended. No jitter." /></RevealItem>
              <RevealItem><PrincipleCard icon={<Trophy size={18} />} title="Purposeful" desc="If it doesn't earn attention, it doesn't ship." /></RevealItem>
              <RevealItem><PrincipleCard icon={<Gauge size={18} />} title="Delight" desc="The result of getting the other seven right — not confetti." /></RevealItem>
            </RevealStagger>
          </div>
        </Reveal>

        {/* ── Motion spec strip — concrete values Apple ships ── */}
        <Reveal delay={0.08}>
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <SpecCard title="Drawer / sheet" damp="0.8" response="0.3" note="Slight bounce — gesture carried momentum" />
            <SpecCard title="Reposition" damp="1.0" response="0.4" note="Critically damped — no overshoot" />
            <SpecCard title="Reversible" damp="mirror" response="inverse bezier" note="Outbound path = return path" />
          </div>
        </Reveal>

        {/* ── Typography specimen ── */}
        <Reveal delay={0.12}>
          <div className="mt-6 rounded-[24px] bg-text text-bg p-6 sm:p-8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] opacity-60"><Layers size={14} /> Typography specimen</div>
            <div className="mt-4 grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-50">Display — tight leading, negative tracking</div>
                <div className="mt-2 text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-[0.95]">Aether Mocks</div>
                <div className="mt-1 text-lg opacity-70 leading-relaxed">1,181+ mocks · Oliveboard · Pundits · English Madhyam</div>
              </div>
              <div className="rounded-2xl bg-white/10 p-5 backdrop-blur">
                <div className="text-xs font-bold uppercase tracking-wide opacity-60">Motion mapping (Motion/Framer)</div>
                <pre className="mt-2 text-xs leading-relaxed opacity-90 overflow-x-auto">{`animate(el, { y: 0 },\n  { type:'spring',\n    bounce: 0,        // damping 1.0\n    duration: 0.36 })  // response\n\n// flick → bounce: 0.18`}</pre>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ── Glass material demo — sticky translucent bar over scrolling content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        <Reveal>
          <div className="rounded-[24px] overflow-hidden ring-1 ring-[var(--glass-border)] bg-bg-raised">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 h-12 bg-[var(--glass)] backdrop-blur-[20px] backdrop-saturate-[180%] border-b border-[var(--glass-border)]">
              <span className="text-sm font-bold tracking-[-0.01em]">Translucent material</span>
              <span className="text-xs text-muted">Content scrolls underneath — not an opaque strip</span>
            </div>
            <div className="p-5 space-y-3 text-sm leading-relaxed text-muted max-h-48 overflow-auto">
              <p>Materials convey hierarchy. Heavier material separates structural regions; lighter draws focus to interactive elements. Never stack a light translucent surface on another — legibility collapses.</p>
              <p>Bigger surfaces read as thicker: stronger blur + deeper shadow than small chips. Context-aware shadow separates busy content.</p>
              <p>For glass/blur surfaces, animate blur radius and scale together on enter so the surface reads as a real material arriving, not an opacity fade.</p>
              <p className="opacity-60">Scroll this box — the bar stays translucent above it, just like the nav.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function BentoTile({ icon, label, value, hint, delay }: { icon: React.ReactNode; label: string; value: string; hint: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING_SOFT as any, delay }}
      className="rounded-2xl bg-surface ring-1 ring-[var(--glass-border)] p-4 shadow-sm"
    >
      <div className="w-9 h-9 grid place-items-center rounded-xl bg-primary text-white shadow-sm">{icon}</div>
      <div className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="text-sm font-bold text-text">{value}</div>
      <div className="text-xs text-muted mt-0.5 leading-snug">{hint}</div>
    </motion.div>
  );
}

function PrincipleCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 ring-1 ring-[var(--glass-border)] p-4 h-full">
      <div className="w-8 h-8 grid place-items-center rounded-full bg-bg-raised ring-1 ring-[var(--glass-border)] text-primary">{icon}</div>
      <div className="mt-3 text-sm font-bold text-text tracking-[-0.01em]">{title}</div>
      <div className="text-xs text-muted leading-relaxed mt-1">{desc}</div>
    </div>
  );
}

function SpecCard({ title, damp, response, note }: { title: string; damp: string; response: string; note: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 ring-1 ring-[var(--glass-border)] p-5">
      <div className="text-sm font-bold text-text">{title}</div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-bg-raised p-3 ring-1 ring-[var(--glass-border)]">
          <div className="font-bold uppercase tracking-wide text-muted">Damping</div>
          <div className="mt-1 font-mono text-sm text-text">{damp}</div>
        </div>
        <div className="rounded-xl bg-bg-raised p-3 ring-1 ring-[var(--glass-border)]">
          <div className="font-bold uppercase tracking-wide text-muted">Response</div>
          <div className="mt-1 font-mono text-sm text-text">{response}</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-muted">{note}</div>
    </div>
  );
}
