import { Check, ChevronDown, ListPlus, Play, Plus, ThumbsUp, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui';
import { CoverArt } from './CoverArt';
import { examPath } from '@/lib/examLink';
import type { Attempt, MockEntry } from '@/types';
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

  if (!mock) return null;

  const totalQuestions = attempt ? attempt.correct + attempt.incorrect + attempt.unattempted : null;
  const submittedAt = attempt ? new Date(attempt.submittedAt).toLocaleDateString() : null;
  const sections = attempt?.sections ?? [];

  /* ── Cinematic Netflix variant — 16:9 hero banner, metadata grid, chapters ── */
  if (isNetflix) {
    return (
      <Modal open={Boolean(mock)} onClose={onClose} maxWidth="max-w-3xl" showClose={false} panelClassName="netflix-modal-card">
        <div className="-mx-6 -mb-6 text-white">
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
              className="absolute top-4 right-4 z-20 w-9 h-9 grid place-items-center rounded-full bg-[#181818] text-white hover:bg-[#2a2a2a] active:scale-90 transition-all duration-200 ease-out"
            >
              <X size={18} />
            </button>

            {/* Title + CTAs layered on the scrim, bottom-left like Netflix */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-6 sm:px-10 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-[#E50914] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-[2px] tracking-wider uppercase shadow-md">
                  N Original
                </span>
                <span className="text-xs text-[#A3A3A3] font-semibold uppercase tracking-widest">
                  {mock.provider}
                </span>
              </div>
              <h2 className="netflix-modal-title">{mock.name}</h2>

              <div className="netflix-modal-actions flex items-center gap-2.5 mt-5">
                <Link
                  to={examPath(mock.path)}
                  className="inline-flex items-center gap-2 bg-white hover:bg-white/75 text-black font-bold px-6 py-2 text-base shadow-lg"
                >
                  <Play size={20} fill="currentColor" /> Play
                </Link>
                <button
                  onClick={onToggleDone}
                  aria-pressed={done}
                  aria-label={done ? `Mark ${mock.name} incomplete` : `Mark ${mock.name} completed`}
                  title={done ? 'Mark incomplete' : 'Mark completed'}
                  className="w-10 h-10 grid place-items-center rounded-full border-2 border-white/50 text-white hover:border-white hover:bg-white/10"
                >
                  {done ? <Check size={18} strokeWidth={3} /> : <Plus size={18} />}
                </button>
                <button
                  onClick={onToggleMyList}
                  aria-pressed={inMyList}
                  aria-label={inMyList ? `Remove ${mock.name} from My List` : `Add ${mock.name} to My List`}
                  title={inMyList ? 'Remove from My List' : 'Add to My List'}
                  className="w-10 h-10 grid place-items-center rounded-full border-2 border-white/50 text-white hover:border-white hover:bg-white/10"
                >
                  {inMyList ? <Check size={18} strokeWidth={3} /> : <ListPlus size={18} />}
                </button>
                <button
                  aria-label={`Rate ${mock.name}`}
                  title="Rate this mock"
                  className="w-10 h-10 grid place-items-center rounded-full border-2 border-white/50 text-white hover:border-white hover:bg-white/10"
                >
                  <ThumbsUp size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-10 pb-8">
            {/* Metadata strip — match %, year chip, duration, quality */}
            <div className="flex flex-wrap items-center gap-3 mt-5 text-sm font-semibold">
              {attempt && (
                <span className="text-[#46d369] font-bold">{attempt.accuracy}% Match</span>
              )}
              <span className="netflix-meta-chip">{mock.subject || 'General'}</span>
              <span className="netflix-meta-chip">{mock.category || 'Mock Test'}</span>
              {totalQuestions !== null && (
                <span className="text-[#A3A3A3]">{totalQuestions} Questions</span>
              )}
              <span className="netflix-meta-chip">HD</span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-[#E5E5E5]">
              Catalog entry from {mock.provider} in {mock.subject || 'General'}.
              {done ? ' This mock is marked completed.' : ' It is not marked completed yet.'}
            </p>

            {/* Latest attempt — high-contrast stat grid */}
            <section aria-labelledby="attempt-summary" className="mt-7">
              <h3 id="attempt-summary" className="text-base font-bold text-white">
                Latest attempt
              </h3>
              {attempt ? (
                <dl className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
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

            {/* Recorded sections — Netflix episode/chapter list */}
            {sections.length > 0 && (
              <section aria-labelledby="sections" className="mt-7">
                <div className="flex items-center justify-between">
                  <h3 id="sections" className="text-base font-bold text-white">
                    Sections
                  </h3>
                  <ChevronDown size={18} className="text-[#808080]" aria-hidden />
                </div>
                <ul className="mt-3 rounded-[4px] overflow-hidden border border-[#2f2f2f]">
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
      <div className="space-y-6 text-text">
        <div className="rounded-lg bg-surface-2 p-5 sm:p-7">
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-text-2">
            <span>{mock.provider}</span>
            <span aria-hidden>•</span>
            <span>{mock.subject || 'General'}</span>
            <span aria-hidden>•</span>
            <span>{mock.category || 'Mock test'}</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-text-2">
            Catalog entry from {mock.provider} in {mock.subject || 'General'}.
            {done ? ' This mock is marked completed.' : ' It is not marked completed yet.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to={examPath(mock.path)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-hover">
              <Play size={17} fill="currentColor" /> Start mock
            </Link>
            <button onClick={onToggleDone} aria-pressed={done} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 font-semibold hover:bg-surface-2">
              <Check size={17} /> {done ? 'Mark incomplete' : 'Mark completed'}
            </button>
            <button onClick={onToggleMyList} aria-pressed={inMyList} className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 font-semibold hover:bg-surface-2">
              <ListPlus size={17} /> {inMyList ? 'Remove from My List' : 'Add to My List'}
            </button>
          </div>
        </div>

        <section aria-labelledby="attempt-summary">
          <h3 id="attempt-summary" className="text-base font-bold">Latest attempt</h3>
          {attempt ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-md bg-surface-2 p-3"><dt className="text-muted">Score</dt><dd className="mt-1 font-semibold">{attempt.score}/{attempt.maxScore}</dd></div>
              <div className="rounded-md bg-surface-2 p-3"><dt className="text-muted">Accuracy</dt><dd className="mt-1 font-semibold">{attempt.accuracy}%</dd></div>
              <div className="rounded-md bg-surface-2 p-3"><dt className="text-muted">Questions</dt><dd className="mt-1 font-semibold">{totalQuestions}</dd></div>
              <div className="rounded-md bg-surface-2 p-3"><dt className="text-muted">Submitted</dt><dd className="mt-1 font-semibold">{submittedAt}</dd></div>
            </dl>
          ) : <p className="mt-2 text-sm text-muted">No completed attempts have been recorded for this mock.</p>}
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
