import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { Bookmark, Brain, CalendarCheck, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import { Card, CardHeader, Reveal } from '@/components/ui';
import { AccuracyRing } from './AccuracyRing';
import { examPath } from '@/lib/examLink';
import { REVISION_ALL_PATH } from '@/services/smartRevision';
import type { SavedQuestionRecord } from '@/types';

const GOAL_PRESETS = [10, 20, 50, 100];
const MotionLink = motion.create(Link);

interface CommandDeckProps {
  today: { done: number; goal: number; met: boolean };
  goal: number;
  onSetGoal: (n: number) => void;
  week: Array<{ letter: string; met: boolean; isToday: boolean; done: number }>;
  wrongCount: number;
  saved: SavedQuestionRecord[];
}

/** The glanceable 4-panel command deck: daily goal, week rhythm, smart revision,
    and (new) saved questions. */
export function CommandDeck({ today, goal, onSetGoal, week, wrongCount, saved }: CommandDeckProps) {
  const pct = goal > 0 ? Math.min(100, Math.round((today.done / goal) * 100)) : 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <Reveal>
        <Card className="h-full">
          <CardHeader title="Daily Goal" icon={<CalendarCheck size={15} />} />
          <div className="flex items-center gap-4">
            <AccuracyRing acc={pct} tone={today.met ? 'success' : pct >= 50 ? 'warning' : 'danger'} label={`Daily goal ${pct}% complete`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-text">
                {today.met && <span className="text-success">Met · </span>}
                <span className="tabular-nums">{today.done}</span>
                <span className="text-muted font-semibold">/{goal}</span>
              </div>
              <div className="text-xs text-muted mt-0.5">questions today</div>
              <div className="flex gap-1 mt-2.5">
                {GOAL_PRESETS.map((g) => (
                  <motion.button
                    key={g}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                    onClick={() => onSetGoal(g)}
                    className={clsx(
                      'px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors tabular-nums cursor-pointer',
                      goal === g
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-surface-2 text-muted hover:text-text hover:bg-surface-3',
                    )}
                    aria-pressed={goal === g}
                    aria-label={`Set daily goal to ${g} questions`}
                  >
                    {g}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="h-full">
          <CardHeader title="This Week" icon={<CalendarCheck size={15} />} />
          <div className="flex gap-1.5">
            {week.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  title={`${d.done} question${d.done === 1 ? '' : 's'}${d.met ? ' — goal met' : ''}`}
                  role="img"
                  aria-label={`${d.letter}: ${d.done} question${d.done === 1 ? '' : 's'}${d.met ? ', goal met' : ''}${d.isToday ? ', today' : ''}`}
                  className={clsx(
                    'w-full max-w-7 h-8 rounded-lg grid place-items-center text-[10px] font-bold transition-colors',
                    d.met
                      ? 'bg-success text-on-bright shadow-sm'
                      : d.done > 0
                        ? 'bg-primary-soft text-primary'
                        : 'bg-surface-2 text-muted',
                    d.isToday && 'ring-2 ring-primary/50',
                  )}
                >
                  {d.done > 0 ? d.done : ''}
                </div>
                <span className={clsx('text-[10px] font-semibold', d.isToday ? 'text-primary' : 'text-muted')}>
                  {d.letter}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.1}>
        <Card className="h-full">
          <CardHeader title="Smart Revision" icon={<Brain size={15} />} />
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-warning-soft text-warning-fg">
              <Brain size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-text tabular-nums">
                {wrongCount > 0 ? `${wrongCount} to revise` : 'All clear'}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {wrongCount > 0 ? 'wrong questions waiting' : 'no wrong questions — nice!'}
              </div>
            </div>
            {wrongCount > 0 && (
              <MotionLink
                to={examPath(REVISION_ALL_PATH)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-warning-soft text-warning-fg text-xs font-semibold hover:bg-warning/20 transition-colors shrink-0 shadow-xs"
              >
                <Play size={12} /> Revise
              </MotionLink>
            )}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.15}>
        <Card className="h-full">
          <CardHeader title="Saved Questions" icon={<Bookmark size={15} />} />
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-info-soft text-info-fg">
              <Bookmark size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-text tabular-nums">
                {saved.length} saved
              </div>
              <div className="text-xs text-muted mt-0.5 truncate">
                {saved.length > 0 ? saved[0].examName : 'bookmark questions to review later'}
              </div>
            </div>
          </div>
          <MotionLink to="/saved" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} className="inline-flex mt-4">
            <Button variant="secondary" size="sm">Open saved</Button>
          </MotionLink>
        </Card>
      </Reveal>
    </div>
  );
}
