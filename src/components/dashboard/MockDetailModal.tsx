import { Check, ChevronDown, ListPlus, Play, Plus, ThumbsUp, X, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { Modal } from '@/components/ui';
import { CoverArt } from './CoverArt';
import { examPath } from '@/lib/examLink';
import type { Attempt, MockEntry } from '@/types';
import { getAllAttempts } from '@/services/attemptStore';
import { useSettingsStore } from '@/stores/settingsStore';

interface MockDetailModalProps {
  mock: MockEntry | null;
  done: boolean;
  attempt: Attempt | null;
  inMyList: boolean;
  onClose: () => void;
  onToggleDone: () => void;
  onToggleMyList: () => void;
}

export function MockDetailModal({ mock, done, attempt, inMyList, onClose, onToggleDone, onToggleMyList }: MockDetailModalProps) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  const isOnePiece = theme === 'onepiece';

  if (!mock) return null;

  const allAttempts = getAllAttempts(mock.path);
  const latestAttempt = attempt || (allAttempts.length > 0 ? allAttempts[allAttempts.length - 1] : null);
  const totalQuestions = latestAttempt ? latestAttempt.correct + latestAttempt.incorrect + latestAttempt.unattempted : null;
  const submittedAt = latestAttempt ? new Date(latestAttempt.submittedAt).toLocaleDateString() : null;
  const sections = latestAttempt?.sections ?? [];

  /* ── Grand Line Voyage variant for One Piece theme ── */
  if (isOnePiece) {
    return (
      <Modal open={Boolean(mock)} onClose={onClose} maxWidth="max-w-3xl" showClose={false} panelClassName="bg-[#070B14] border border-[#FFB703]/30 text-white shadow-2xl rounded-3xl overflow-hidden">
        <div className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6 text-white">
          {/* Grand Line Hero Banner */}
          <div className="relative overflow-hidden bg-gradient-to-b from-[#0F172A] via-[#070B14] to-[#070B14] min-h-[220px] sm:min-h-[280px] flex flex-col justify-end p-5 sm:p-8 border-b border-[var(--glass-border)]">
            <CoverArt
              seed={mock.path}
              title={mock.name}
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
            {/* Scrim */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#070B14] via-[#070B14]/70 to-transparent" />
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,183,3,0.2),transparent_70%)]" />

            {/* Floating close button */}
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute top-4 right-4 z-20 w-9 h-9 grid place-items-center rounded-full bg-[#0D1524] text-white hover:bg-[#1E293B] border border-[var(--glass-border)] active:scale-90 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gradient-to-r from-[#FFB703] to-[#FF334B] text-black text-[10px] font-black px-2 py-0.5 rounded-full tracking-wider uppercase shadow">
                  ☠️ GRAND LINE TARGET
                </span>
                <span className="text-xs text-[#FFB703] font-bold uppercase tracking-widest">
                  {mock.provider}
                </span>
              </div>
              <h2 className="text-xl sm:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-md">
                {mock.name}
              </h2>

              <div className="flex flex-wrap items-center gap-2.5 mt-4 sm:mt-5">
                {attempt ? (
                  <>
                    <Link
                      to={examPath(mock.path, { mode: 'review' })}
                      className="inline-flex items-center gap-2 bg-[#46d369] text-black font-black px-4 sm:px-5 py-2.5 rounded-xl text-sm sm:text-base shadow-[0_4px_20px_rgba(70,211,105,0.35)] hover:brightness-110 active:scale-95 transition-all"
                    >
                      <BookOpen size={18} /> Review Battle
                    </Link>
                    <Link
                      to={examPath(mock.path)}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FFB703] via-[#FFD600] to-[#FF8F00] text-black font-black px-4 sm:px-5 py-2.5 rounded-xl text-sm sm:text-base shadow-[0_4px_20px_rgba(255,183,3,0.35)] hover:brightness-110 active:scale-95 transition-all"
                    >
                      <Play size={18} fill="currentColor" /> Re-attempt
                    </Link>
                  </>
                ) : (
                  <Link
                    to={examPath(mock.path)}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-[#FFB703] via-[#FFD600] to-[#FF8F00] text-black font-black px-5 py-2.5 rounded-xl text-sm sm:text-base shadow-[0_4px_20px_rgba(255,183,3,0.35)] hover:brightness-110 active:scale-95 transition-all"
                  >
                    <Play size={20} fill="currentColor" /> Embark &amp; Battle
                  </Link>
                )}
                <button
                  onClick={onToggleDone}
                  aria-pressed={done}
                  aria-label={done ? `Mark ${mock.name} incomplete` : `Mark ${mock.name} completed`}
                  title={done ? 'Conquered' : 'Mark conquered'}
                  className="w-10 h-10 grid place-items-center rounded-xl border border-[#FFB703]/30 bg-[#0D1524]/80 text-[#FFB703] hover:bg-[#1E293B] cursor-pointer"
                >
                  {done ? <Check size={18} strokeWidth={3} /> : <Plus size={18} />}
                </button>
                <button
                  onClick={onToggleMyList}
                  aria-pressed={inMyList}
                  aria-label={inMyList ? `Remove ${mock.name} from Log Pose` : `Add ${mock.name} to Log Pose`}
                  title={inMyList ? 'Remove from Log Pose' : 'Mark on Log Pose'}
                  className="w-10 h-10 grid place-items-center rounded-xl border border-[#FFB703]/30 bg-[#0D1524]/80 text-[#FFB703] hover:bg-[#1E293B] cursor-pointer"
                >
                  {inMyList ? <Check size={18} strokeWidth={3} /> : <ListPlus size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            {/* Metadata Chips */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm font-bold">
              <span className="text-[#FFB703] bg-[#FFB703]/10 px-2.5 py-1 rounded-lg border border-[#FFB703]/20">
                👑 390 Max Bounty
              </span>
              <span className="text-white bg-surface-2 px-2.5 py-1 rounded-lg border border-[var(--glass-border)]">
                ⚡ 130 Mins TCS Battle
              </span>
              <span className="text-[#10B981] bg-[#10B981]/10 px-2.5 py-1 rounded-lg border border-[#10B981]/20">
                🛡️ Tier 2 Ready
              </span>
            </div>

            {/* Performance Stats if attempted */}
            {attempt ? (
              <div className="p-4 rounded-2xl bg-[#0D1524] border border-[#FFB703]/20 space-y-3">
                <div className="text-xs font-black uppercase text-[#FFB703] tracking-wider">
                  Captain's Log (Previous Battle Record)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-2.5 rounded-xl bg-surface-2">
                    <div className="text-lg font-black text-[#FFB703]">{attempt.score.toFixed(1)}</div>
                    <div className="text-[11px] text-muted font-bold">Bounty Claimed</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2">
                    <div className="text-lg font-black text-[#10B981]">{attempt.accuracy}%</div>
                    <div className="text-[11px] text-muted font-bold">Observation Haki</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2">
                    <div className="text-lg font-black text-white">{attempt.correct}</div>
                    <div className="text-[11px] text-muted font-bold">Ryuo Hits</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface-2">
                    <div className="text-lg font-black text-[#FF334B]">{attempt.incorrect}</div>
                    <div className="text-[11px] text-muted font-bold">Countered</div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Sections / Island modules */}
            {sections.length > 0 && (
              <div>
                <h3 className="text-sm font-black text-[#FFB703] uppercase tracking-wider mb-3">
                  Battle Modules &amp; Island Stages
                </h3>
                <div className="space-y-2">
                  {sections.map((sec, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-[#0D1524] border border-[var(--glass-border)] text-xs sm:text-sm font-semibold">
                      <span className="text-white font-bold">{sec.name}</span>
                      <span className="text-muted">Q{sec.start + 1}–{sec.end + 1} ({sec.end - sec.start + 1} Qs)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  /* ── Cinematic Netflix variant — 16:9 hero banner, metadata grid, chapters ── */
  if (isNetflix) {
    return (
      <Modal open={Boolean(mock)} onClose={onClose} maxWidth="max-w-3xl" showClose={false} panelClassName="netflix-modal-card">
        <div className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6 text-white">
          {/* 16:9 hero banner with full-bleed gradient, title, and CTAs */}
          <div className="netflix-modal-hero">
            {/* Generated poster art fills the banner behind the scrim */}
            <CoverArt
              seed={mock.path}
              title={mock.name}
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />

            {/* Floating close button over the hero */}
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="absolute top-4 right-4 z-20 w-10 h-10 grid place-items-center rounded-full bg-black/60 border border-white/20 text-white hover:bg-white/20 active:scale-90 backdrop-blur-md transition-all duration-200 ease-out"
            >
              <X size={18} />
            </button>

            {/* Title + CTAs layered on the scrim, bottom-left like Netflix */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-4 sm:px-6 md:px-10 pb-4 sm:pb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#E50914] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full tracking-wider uppercase shadow-md">
                  N Original
                </span>
                <span className="text-xs text-[#A3A3A3] font-semibold uppercase tracking-widest">
                  {mock.provider}
                </span>
              </div>
              <h2 className="netflix-modal-title">{mock.name}</h2>

              {/* Apple Pill Action Buttons for Netflix Modal */}
              <div className="netflix-modal-actions flex flex-wrap items-center gap-2.5 mt-4 sm:mt-5">
                {attempt ? (
                  <>
                    <Link
                      to={examPath(mock.path, { mode: 'review' })}
                      className="inline-flex items-center gap-2 bg-[#46d369] hover:brightness-110 text-black font-extrabold px-6 py-2.5 rounded-full text-sm sm:text-base shadow-[0_4px_20px_rgba(70,211,105,0.35)] active:scale-95 transition-all"
                    >
                      <BookOpen size={18} /> Review Responses
                    </Link>
                    <Link
                      to={examPath(mock.path)}
                      className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-black font-extrabold px-6 py-2.5 rounded-full text-sm sm:text-base shadow-lg active:scale-95 transition-all"
                    >
                      <Play size={18} fill="currentColor" /> Re-attempt
                    </Link>
                  </>
                ) : (
                  <Link
                    to={examPath(mock.path)}
                    className="inline-flex items-center gap-2 bg-white hover:bg-white/90 text-black font-extrabold px-7 py-2.5 rounded-full text-sm sm:text-base shadow-[0_4px_20px_rgba(255,255,255,0.35)] active:scale-95 transition-all"
                  >
                    <Play size={20} fill="currentColor" /> Play
                  </Link>
                )}
                <button
                  onClick={onToggleDone}
                  aria-pressed={done}
                  aria-label={done ? `Mark ${mock.name} incomplete` : `Mark ${mock.name} completed`}
                  title={done ? 'Mark incomplete' : 'Mark completed'}
                  className={clsx(
                    "w-11 h-11 grid place-items-center rounded-full border transition-all active:scale-90 backdrop-blur-md",
                    done
                      ? "bg-[#46d369] text-black border-transparent shadow-[0_2px_10px_rgba(70,211,105,0.4)]"
                      : "border-white/30 bg-white/10 text-white hover:border-white hover:bg-white/20"
                  )}
                >
                  {done ? <Check size={18} strokeWidth={3} /> : <Plus size={18} />}
                </button>
                <button
                  onClick={onToggleMyList}
                  aria-pressed={inMyList}
                  aria-label={inMyList ? `Remove ${mock.name} from My List` : `Add ${mock.name} to My List`}
                  title={inMyList ? 'Remove from My List' : 'Add to My List'}
                  className={clsx(
                    "w-11 h-11 grid place-items-center rounded-full border transition-all active:scale-90 backdrop-blur-md",
                    inMyList
                      ? "bg-white text-black border-transparent shadow-md"
                      : "border-white/30 bg-white/10 text-white hover:border-white hover:bg-white/20"
                  )}
                >
                  {inMyList ? <Check size={18} strokeWidth={3} /> : <ListPlus size={18} />}
                </button>
                <button
                  aria-label={`Rate ${mock.name}`}
                  title="Rate this mock"
                  className="w-11 h-11 grid place-items-center rounded-full border border-white/30 bg-white/10 text-white hover:border-white hover:bg-white/20 active:scale-90 backdrop-blur-md transition-all"
                >
                  <ThumbsUp size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 md:px-10 pb-6 sm:pb-8">
            {/* Metadata strip — match %, year chip, duration, quality */}
            <div className="flex flex-wrap items-center gap-2.5 mt-5 text-sm font-semibold">
              {attempt && (
                <span className="text-[#46d369] font-bold bg-[#46d369]/15 px-2.5 py-0.5 rounded-full">{attempt.accuracy}% Match</span>
              )}
              <span className="netflix-meta-chip">{mock.subject || 'General'}</span>
              <span className="netflix-meta-chip">{mock.category || 'Mock Test'}</span>
              {totalQuestions !== null && (
                <span className="text-[#A3A3A3] px-2">{totalQuestions} Questions</span>
              )}
              <span className="netflix-meta-chip">TCS Engine</span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[#E5E5E5]">
              Catalog entry from {mock.provider} in {mock.subject || 'General'}.
              {done ? ' This mock is marked completed.' : ' It is not marked completed yet.'}
            </p>

            {/* Latest attempt — Apple widget stat grid */}
            <section aria-labelledby="attempt-summary" className="mt-7">
              <h3 id="attempt-summary" className="text-base font-bold text-white">
                Latest attempt
              </h3>
              {attempt ? (
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="netflix-stat-card">
                    <dt className="netflix-stat-label">Score</dt>
                    <dd className="netflix-stat-value">
                      {attempt.score}/{attempt.maxScore}
                    </dd>
                  </div>
                  <div className="netflix-stat-card">
                    <dt className="netflix-stat-label">Accuracy</dt>
                    <dd className="netflix-stat-value">{attempt.accuracy}%</dd>
                  </div>
                  <div className="netflix-stat-card">
                    <dt className="netflix-stat-label">Questions</dt>
                    <dd className="netflix-stat-value">{totalQuestions}</dd>
                  </div>
                  <div className="netflix-stat-card">
                    <dt className="netflix-stat-label">Submitted</dt>
                    <dd className="netflix-stat-value">{submittedAt}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-[#808080]">
                  No completed attempts have been recorded for this mock.
                </p>
              )}
            </section>

            {/* Recorded sections — Apple grouped rounded chapter list */}
            {sections.length > 0 && (
              <section aria-labelledby="sections" className="mt-7">
                <div className="flex items-center justify-between">
                  <h3 id="sections" className="text-base font-bold text-white">
                    Sections
                  </h3>
                  <ChevronDown size={18} className="text-[#808080]" aria-hidden />
                </div>
                <ul className="mt-3 rounded-2xl overflow-hidden border border-white/10 divide-y divide-white/10">
                  {sections.map((section, i) => (
                    <li key={`${section.name}-${section.start}`} className="netflix-chapter">
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="netflix-chapter-index">{i + 1}</span>
                        <span className="netflix-chapter-name truncate">{section.name}</span>
                      </div>
                      <span className="netflix-chapter-range shrink-0">
                        Q{section.start + 1}–{section.end + 1}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  /* ── Apple variant — clean panel, untouched by the Netflix polish ── */
  return (
    <Modal open={Boolean(mock)} onClose={onClose} title={mock.name} maxWidth="max-w-3xl">
      <div className="space-y-4 sm:space-y-6 text-text">
        <div className="rounded-xl sm:rounded-2xl bg-surface-2 p-4 sm:p-7">
          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-semibold text-text-2">
            <span>{mock.provider}</span>
            <span aria-hidden>•</span>
            <span>{mock.subject || 'General'}</span>
            <span aria-hidden>•</span>
            <span>{mock.category || 'Mock test'}</span>
          </div>
          <p className="mt-2.5 sm:mt-4 text-xs sm:text-sm leading-relaxed text-text-2">
            Catalog entry from {mock.provider} in {mock.subject || 'General'}.
            {done ? ' This mock is marked completed.' : ' It is not marked completed yet.'}
          </p>
          <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
            {attempt ? (
              <>
                <Link
                  to={examPath(mock.path, { mode: 'review' })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-md bg-answered px-4 py-2.5 sm:py-2 font-bold text-xs sm:text-sm text-white hover:brightness-110 shadow-sm"
                >
                  <BookOpen size={16} /> Review Solutions &amp; Responses
                </Link>
                <Link
                  to={examPath(mock.path)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-md bg-primary px-4 py-2.5 sm:py-2 font-bold text-xs sm:text-sm text-white hover:bg-primary-hover shadow-sm"
                >
                  <Play size={16} fill="currentColor" /> Re-attempt Mock
                </Link>
              </>
            ) : (
              <Link
                to={examPath(mock.path)}
                className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-md bg-primary px-4 py-2.5 sm:py-2 font-bold text-xs sm:text-sm text-white hover:bg-primary-hover shadow-sm"
              >
                <Play size={16} fill="currentColor" /> Start mock
              </Link>
            )}
            <button onClick={onToggleDone} aria-pressed={done} className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-md border border-border px-3.5 py-2 font-semibold text-xs sm:text-sm hover:bg-surface-3 cursor-pointer">
              <Check size={16} /> {done ? 'Mark incomplete' : 'Mark completed'}
            </button>
            <button onClick={onToggleMyList} aria-pressed={inMyList} className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-md border border-border px-3.5 py-2 font-semibold text-xs sm:text-sm hover:bg-surface-3 cursor-pointer">
              <ListPlus size={16} /> {inMyList ? 'Remove from My List' : 'Add to My List'}
            </button>
          </div>
        </div>

        <section aria-labelledby="attempt-summary">
          <div className="flex items-center justify-between">
            <h3 id="attempt-summary" className="text-sm sm:text-base font-bold">
              Attempt History ({allAttempts.length})
            </h3>
            {allAttempts.length > 0 && (
              <span className="text-[11px] font-bold text-primary">
                Latest: #{latestAttempt?.attemptNumber ?? allAttempts.length}
              </span>
            )}
          </div>

          {latestAttempt ? (
            <div className="mt-3 space-y-3">
              <dl className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm sm:grid-cols-4">
                <div className="rounded-xl sm:rounded-md bg-surface-2 p-2.5 sm:p-3"><dt className="text-muted text-[11px] sm:text-xs">Score</dt><dd className="mt-0.5 sm:mt-1 font-bold">{latestAttempt.score}/{latestAttempt.maxScore}</dd></div>
                <div className="rounded-xl sm:rounded-md bg-surface-2 p-2.5 sm:p-3"><dt className="text-muted text-[11px] sm:text-xs">Accuracy</dt><dd className="mt-0.5 sm:mt-1 font-bold">{latestAttempt.accuracy}%</dd></div>
                <div className="rounded-xl sm:rounded-md bg-surface-2 p-2.5 sm:p-3"><dt className="text-muted text-[11px] sm:text-xs">Questions</dt><dd className="mt-0.5 sm:mt-1 font-bold">{totalQuestions}</dd></div>
                <div className="rounded-xl sm:rounded-md bg-surface-2 p-2.5 sm:p-3"><dt className="text-muted text-[11px] sm:text-xs">Submitted</dt><dd className="mt-0.5 sm:mt-1 font-bold truncate">{submittedAt}</dd></div>
              </dl>

              {allAttempts.length > 1 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="px-3.5 py-2 bg-surface-2 text-[11px] font-bold text-muted uppercase tracking-wider">
                    All Past Attempts
                  </div>
                  <div className="divide-y divide-border">
                    {allAttempts.slice().reverse().map((att) => (
                      <div key={att.attemptNumber} className="flex items-center justify-between p-3 text-xs sm:text-sm gap-2">
                        <div>
                          <span className="font-bold text-text">Attempt #{att.attemptNumber}</span>
                          <span className="text-muted text-xs ml-2">({new Date(att.submittedAt).toLocaleDateString()})</span>
                          <div className="text-xs text-muted font-medium mt-0.5">
                            Score: <span className="text-text font-bold">{att.score}/{att.maxScore}</span> · Acc: <span className="font-bold text-answered">{att.accuracy}%</span>
                          </div>
                        </div>
                        <Link
                          to={examPath(mock.path, { mode: 'review', attempt: att.attemptNumber })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                        >
                          <BookOpen size={13} /> Review
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs sm:text-sm text-muted">No completed attempts have been recorded for this mock.</p>
          )}
        </section>

        {sections.length > 0 && (
          <section aria-labelledby="sections">
            <h3 id="sections" className="text-base font-bold">Recorded sections</h3>
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {sections.map((section) => <li key={`${section.name}-${section.start}`} className="flex justify-between gap-4 p-3 text-sm"><span className="font-medium">{section.name}</span><span className="text-muted">Questions {section.start + 1}–{section.end + 1}</span></li>)}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
