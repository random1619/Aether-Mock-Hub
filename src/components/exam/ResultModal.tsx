import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Target, CheckCircle2, XCircle, MinusCircle, RotateCcw, LayoutDashboard, MonitorOff, AppWindow, FileDown, Brain, Flame, Clock3, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useExamStore } from '@/stores/examStore';
import { getAllAttempts, getStats, getTodayProgress } from '@/services/attemptStore';
import { isRevisionPath, revisionPathFor } from '@/services/smartRevision';
import { examPath } from '@/lib/examLink';
import type { ScoreResult } from '@/lib/scoring';
import { Modal, Button, ConfettiBurst } from '@/components/ui';

export function ResultModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const result = useExamStore((s) => s.result);
  const meta = useExamStore((s) => s.meta);
  const fsExits = useExamStore((s) => s.fsExits);
  const tabSwitches = useExamStore((s) => s.tabSwitches);
  const clockTampered = useExamStore((s) => s.clockTampered);
  const questionTimes = useExamStore((s) => s.questionTimes);
  const persistFailed = useExamStore((s) => s.persistFailed);
  const [savingPdf, setSavingPdf] = useState(false);
  // Desktop-only: the PDF is rendered + written by the Electron main process.
  const canExportPdf = typeof window !== 'undefined' && !!(window as any).aetherDesktop?.exportScorecard;
  if (!result) return null;

  /* Post-submit insights */
  const answeredCount = result.correct + result.incorrect;
  const totalUsedSec = Object.values(questionTimes).reduce((a, b) => a + b, 0);
  const avgSecPerQ = answeredCount > 0 ? Math.round(totalUsedSec / answeredCount) : 0;
  const totalAllowedSec = (meta?.durationMinutes ?? 0) * 60;

  // Score delta vs the previous attempt on THIS mock (latest entry in the
  // store is the attempt that was just saved). Revision exams are skipped —
  // their pseudo-paths don't carry comparable history.
  const isRevision = isRevisionPath(meta?.path);
  const prevAttempt = !isRevision && meta ? (() => {
    const arr = getAllAttempts(meta.path);
    return arr.length >= 2 ? arr[arr.length - 2] : null;
  })() : null;
  const scoreDelta = prevAttempt ? result.score - prevAttempt.score : null;

  // Study planner snapshot — read AFTER saveAttempt, so it's already current.
  const today = getTodayProgress();
  const streakDays = getStats().streakDays;

  const reviseWrong = () => {
    if (!meta) return;
    onClose();
    navigate(examPath(revisionPathFor(meta.path)));
  };

  const savePdf = async () => {
    if (savingPdf) return;
    setSavingPdf(true);
    try {
      const res = await (window as any).aetherDesktop.exportScorecard({
        html: buildScorecardHtml(result, meta?.name ?? 'Mock Test', fsExits, tabSwitches, clockTampered),
        // Strip characters that are illegal in filenames on Windows/macOS.
        filename: `scorecard-${(meta?.name ?? 'mock').replace(/[\\/:*?"<>|]+/g, '-')}.pdf`,
      });
      if (res && !res.canceled) toast.success('Scorecard PDF saved');
    } catch {
      toast.error('PDF export failed');
    } finally {
      setSavingPdf(false);
    }
  };

  const pct = result.maxScore > 0 ? Math.max(0, Math.round((result.score / result.maxScore) * 100)) : 0;

  const stats = [
    { label: 'Correct', value: result.correct, icon: CheckCircle2, cls: 'text-answered', bg: 'bg-answered/15' },
    { label: 'Incorrect', value: result.incorrect, icon: XCircle, cls: 'text-notanswered', bg: 'bg-notanswered/15' },
    { label: 'Skipped', value: result.unattempted, icon: MinusCircle, cls: 'text-muted', bg: 'bg-notvisited-soft' },
    { label: 'Accuracy', value: `${result.accuracy}%`, icon: Target, cls: 'text-info', bg: 'bg-info-soft' },
  ];

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-xl" showClose={false}>
      <div className="text-center pt-2">
        {pct >= 40 && <ConfettiBurst />}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-info grid place-items-center shadow-[var(--shadow-glow)] ring-4 ring-primary-soft"
        >
          <Trophy className="text-white" size={28} />
        </motion.div>
        <h2 className="text-2xl font-extrabold text-text mb-1">Test Completed!</h2>
        <p className="text-sm text-muted mb-6 truncate">{meta?.name}</p>

        {/* Score hero — ring gauge with score centered */}
        <div className="mb-6 flex items-center justify-center gap-5">
          <ScoreRing pct={pct} />
          <div className="text-left">
            <div className="text-4xl font-extrabold text-primary tabular-nums tracking-tight leading-none">
              {result.score.toFixed(1)}
              <span className="text-xl text-muted font-bold"> / {result.maxScore.toFixed(0)}</span>
            </div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted mt-2">{pct}% scored</div>
          </div>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.06 }}
              className={`${s.bg} rounded-lg p-3.5 border border-border shadow-sm`}
            >
              <s.icon size={18} className={`${s.cls} mx-auto mb-1.5`} />
              <div className={`text-xl font-extrabold tabular-nums ${s.cls}`}>{s.value}</div>
              <div className="text-xs text-muted font-medium">{s.label}</div>
            </motion.div>
          ))}
        </div>

        {persistFailed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 py-3 px-4 rounded-lg bg-warning-soft border border-warning/30 text-warning-fg text-sm font-medium text-center"
          >
            Your score could not be saved — it will be lost on reload.
            Check your browser storage (quota / private mode).
          </motion.div>
        )}

        {/* Insights row: pacing + improvement vs previous attempt */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <InsightCell
            icon={<Clock3 size={15} />}
            label="Time Used"
            value={fmtDuration(totalUsedSec)}
            sub={totalAllowedSec > 0 ? `of ${fmtDuration(totalAllowedSec)}` : undefined}
          />
          <InsightCell
            icon={<Target size={15} />}
            label="Avg / Question"
            value={answeredCount > 0 ? `${avgSecPerQ}s` : '—'}
          />
          {scoreDelta !== null ? (
            <InsightCell
              icon={scoreDelta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              label="vs Last Attempt"
              value={`${scoreDelta >= 0 ? '+' : ''}${scoreDelta.toFixed(1)}`}
              tone={scoreDelta > 0 ? 'up' : scoreDelta < 0 ? 'down' : 'flat'}
            />
          ) : (
            <InsightCell icon={<Trophy size={15} />} label="Attempt" value="First" sub="no baseline yet" />
          )}
        </div>

        {/* Sectional breakdown */}
        {result.sections.length > 1 && (
          <div className="mb-6 text-left">
            <h3 className="text-sm font-bold text-text mb-2.5">Sectional Performance</h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-muted text-xs uppercase tracking-wide">
                    <th className="text-left px-3 py-2 font-semibold">Section</th>
                    <th className="text-center px-2 py-2 font-semibold">✓</th>
                    <th className="text-center px-2 py-2 font-semibold">✗</th>
                    <th className="text-center px-2 py-2 font-semibold">—</th>
                    <th className="text-right px-3 py-2 font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {result.sections.map((sec) => (
                    <tr key={sec.name} className="border-t border-border">
                      <td className="px-3 py-2.5 font-medium text-text">{sec.name}</td>
                      <td className="px-2 py-2.5 text-center text-answered font-bold">{sec.correct}</td>
                      <td className="px-2 py-2.5 text-center text-notanswered font-bold">{sec.incorrect}</td>
                      <td className="px-2 py-2.5 text-center text-muted">{sec.unattempted}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-primary tabular-nums">
                        {sec.score.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Study planner strip: today's goal + streak after this attempt */}
        <div className={`mb-5 flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left ${
          today.met ? 'border-success/40 bg-success-soft' : 'border-border bg-surface-2'
        }`}>
          <Flame size={16} className={streakDays > 0 ? 'text-warning shrink-0' : 'text-muted shrink-0'} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-text">
              {streakDays} day{streakDays === 1 ? '' : 's'} streak
              {today.met && <span className="ml-2 text-success">· Goal met today</span>}
            </div>
            <div className="text-[11px] text-muted">
              Today: {today.done}/{today.goal} questions answered
            </div>
          </div>
          {/* Mini progress bar */}
          <div className="w-20 h-1.5 rounded-full bg-surface-3 overflow-hidden shrink-0">
            <div
              className={`h-full rounded-full transition-all ${today.met ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${Math.min(100, Math.round((today.done / today.goal) * 100))}%` }}
            />
          </div>
        </div>

        {/* Smart Revision: retry this attempt's wrong questions */}
        {result.incorrect > 0 && !isRevision && (
          <Button variant="warning" fullWidth leftIcon={<Brain size={16} />} onClick={reviseWrong} className="mb-3">
            Revise {result.incorrect} Wrong Question{result.incorrect === 1 ? '' : 's'}
          </Button>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth leftIcon={<LayoutDashboard size={16} />} onClick={() => navigate('/')}>
            Dashboard
          </Button>
          {canExportPdf && (
            <Button variant="secondary" fullWidth leftIcon={<FileDown size={16} />} disabled={savingPdf} onClick={savePdf}>
              {savingPdf ? 'Saving…' : 'Save PDF'}
            </Button>
          )}
          <Button variant="primary" fullWidth leftIcon={<RotateCcw size={16} />} onClick={onClose}>
            Review Answers
          </Button>
        </div>

        {/* Integrity log (TCS style) */}
        <div className="mt-4 pt-3 border-t border-border flex flex-col items-center gap-1.5 text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <MonitorOff size={12} className={fsExits > 0 ? 'text-warning' : 'text-muted'} />
            <span>
              Fullscreen exited <strong className={fsExits > 0 ? 'text-warning' : 'text-text'}>{fsExits}</strong> time{fsExits === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AppWindow size={12} className={tabSwitches > 0 ? 'text-warning' : 'text-muted'} />
            <span>
              Left exam window <strong className={tabSwitches > 0 ? 'text-warning' : 'text-text'}>{tabSwitches}</strong> time{tabSwitches === 1 ? '' : 's'}
            </span>
          </div>
          {clockTampered && (
            <div className="flex items-center gap-2 text-warning font-semibold">
              <Clock3 size={12} />
              <span>System clock changed during the attempt</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Circular gauge showing the overall score percentage. */
function ScoreRing({ pct }: { pct: number }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const color = pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="relative w-20 h-20 shrink-0">
      <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <motion.circle
          cx="40" cy="40" r={R} fill="none"
          stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct / 100) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-lg font-extrabold tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

/** Seconds → compact "42m 10s" / "31s" label. */
function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

/** One small stat tile in the insights row (pacing, delta, etc.). */
function InsightCell({
  icon,
  label,
  value,
  sub,
  tone = 'flat',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'up' | 'down' | 'flat';
}) {
  const toneCls = tone === 'up' ? 'text-success' : tone === 'down' ? 'text-notanswered' : 'text-text';
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-center">
      <div className="flex items-center justify-center gap-1.5 text-muted mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-extrabold tabular-nums leading-none ${toneCls}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted mt-1">{sub}</div>}
    </div>
  );
}

/* Scorecard → PDF */

/** Escape user/content strings before embedding them in the HTML document. */
function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Build a self-contained, print-friendly scorecard document. The Electron
    main process renders this in a hidden window and prints it to PDF — so it
    must carry ALL its styles inline and stay light-themed for paper. */
function buildScorecardHtml(result: ScoreResult, examName: string, fsExits: number, tabSwitches: number, clockTampered: boolean): string {
  const pct = result.maxScore > 0 ? Math.max(0, Math.round((result.score / result.maxScore) * 100)) : 0;
  const date = new Date().toLocaleString();
  const stats: Array<[string, string, string]> = [
    ['Correct', String(result.correct), '#16a34a'],
    ['Incorrect', String(result.incorrect), '#dc2626'],
    ['Skipped', String(result.unattempted), '#6b7280'],
    ['Accuracy', `${result.accuracy}%`, '#2563eb'],
  ];
  const sectionBlock = result.sections.length > 1
    ? `<h2>Sectional Performance</h2>
       <table>
         <thead><tr><th>Section</th><th class="c">Correct</th><th class="c">Incorrect</th><th class="c">Skipped</th><th class="r">Score</th></tr></thead>
         <tbody>${result.sections.map((s) => `
           <tr><td>${escHtml(s.name)}</td><td class="c ok">${s.correct}</td><td class="c bad">${s.incorrect}</td><td class="c">${s.unattempted}</td><td class="r strong">${s.score.toFixed(2)}</td></tr>`).join('')}
         </tbody>
       </table>`
    : '';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Scorecard — ${escHtml(examName)}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #111827; margin: 40px; }
  h1 { font-size: 22px; margin: 0; }
  h2 { font-size: 14px; margin: 28px 0 8px; color: #374151; }
  .sub { color: #6b7280; font-size: 12px; margin: 4px 0 24px; }
  .hero { display: flex; align-items: baseline; gap: 12px; margin: 16px 0 24px; }
  .hero .score { font-size: 44px; font-weight: 800; color: #0071e3; }
  .hero .pct { font-size: 14px; font-weight: 600; color: #6b7280; }
  .grid { display: flex; gap: 12px; }
  .stat { flex: 1; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
  .stat .v { font-size: 22px; font-weight: 800; }
  .stat .l { font-size: 11px; color: #6b7280; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; }
  th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; color: #6b7280; }
  .c { text-align: center; } .r { text-align: right; }
  .ok { color: #16a34a; font-weight: 700; } .bad { color: #dc2626; font-weight: 700; } .strong { font-weight: 700; }
  .foot { margin-top: 32px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; }
</style></head>
<body>
  <h1>Aether Mocks — Scorecard</h1>
  <div class="sub">${escHtml(examName)} · ${escHtml(date)}</div>
  <div class="hero">
    <span class="score">${result.score.toFixed(1)} / ${result.maxScore.toFixed(0)}</span>
    <span class="pct">${pct}% scored</span>
  </div>
  <div class="grid">${stats.map(([l, v, c]) => `
    <div class="stat"><div class="v" style="color:${c}">${v}</div><div class="l">${l}</div></div>`).join('')}
  </div>
  ${sectionBlock}
  <div class="foot">Fullscreen exited ${fsExits} time${fsExits === 1 ? '' : 's'} · Left exam window ${tabSwitches} time${tabSwitches === 1 ? '' : 's'}${clockTampered ? ' · ⚠ System clock changed during the attempt' : ''} · Generated by Aether Mocks</div>
</body></html>`;
}
