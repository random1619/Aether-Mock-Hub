import { clsx } from 'clsx';
import { Link } from 'react-router-dom';
import { Bookmark, Brain, CalendarCheck, Play, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui';
import { Card, CardHeader, Reveal } from '@/components/ui';
import { ActivityRings } from './ActivityRings';
import { examPath } from '@/lib/examLink';
import { REVISION_ALL_PATH } from '@/services/smartRevision';
import type { SavedQuestionRecord } from '@/types';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGamificationStore } from '@/stores/gamificationStore';
import { computeTripleRings } from '@/services/gamificationService';
import { getDb } from '@/services/attemptStore';

const GOAL_PRESETS = [10, 20, 50, 100];
const MotionLink = motion.create(Link);

interface CommandDeckProps {
  today?: { done: number; goal: number; met: boolean };
  goal: number;
  onSetGoal: (n: number) => void;
  week: Array<{ letter: string; met: boolean; isToday: boolean; done: number }>;
  wrongCount: number;
  saved: SavedQuestionRecord[];
}

/** The glanceable 4-panel command deck: daily goal & triple activity rings, week rhythm, smart revision,
    and saved questions. */
export function CommandDeck({ today: _today, goal, onSetGoal, week, wrongCount, saved }: CommandDeckProps) {
  const { theme } = useSettingsStore();
  const isOnePiece = theme === 'onepiece';
  const db = getDb();
  const { streakFreezes } = useGamificationStore();

  const ringsData = computeTripleRings(db, {
    practiceTarget: goal,
    focusTargetMinutes: 45,
    masteryTargetAccuracy: 80,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <Reveal>
        <Card className="h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <CalendarCheck size={14} className={isOnePiece ? 'text-[#FFB703]' : 'text-primary'} />
                {isOnePiece ? 'Daily Battle Quota' : 'Daily Rings & Goal'}
              </span>
              {streakFreezes > 0 && (
                <span
                  title={`${streakFreezes} Streak Freeze available to protect your streak`}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00F5D4]/15 border border-[#00F5D4]/30 text-[#00F5D4]"
                >
                  <Shield size={10} /> {streakFreezes} Freeze
                </span>
              )}
            </div>

            <ActivityRings data={ringsData} size={88} strokeWidth={7.5} />
          </div>

          <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between">
            <div className="text-[11px] font-bold text-muted">Daily Target:</div>
            <div className="flex gap-1">
              {GOAL_PRESETS.map((g) => (
                <motion.button
                  key={g}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                  onClick={() => onSetGoal(g)}
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors tabular-nums cursor-pointer',
                    goal === g
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-surface-2 text-muted hover:text-text hover:bg-surface-3',
                  )}
                  aria-pressed={goal === g}
                  aria-label={`Set daily goal to ${g} questions`}
                >
                  {g}Q
                </motion.button>
              ))}
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="h-full">
          <CardHeader
            title={isOnePiece ? 'Voyage Rhythm' : 'This Week'}
            icon={<CalendarCheck size={15} className={isOnePiece ? 'text-[#FFB703]' : undefined} />}
          />
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
          <CardHeader
            title={isOnePiece ? 'Haki Recovery' : 'Smart Revision'}
            icon={<Brain size={15} className={isOnePiece ? 'text-[#FFB703]' : undefined} />}
          />
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-warning-soft text-warning-fg">
              <Brain size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-text tabular-nums">
                {wrongCount > 0 ? `${wrongCount} to retrain` : 'Haki primed'}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {wrongCount > 0 ? 'missed battle questions' : 'no battle errors — stellar!'}
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
          <CardHeader
            title={isOnePiece ? 'Log Pose Bank' : 'Saved Questions'}
            icon={<Bookmark size={15} className={isOnePiece ? 'text-[#FFB703]' : undefined} />}
          />
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-info-soft text-info-fg">
              <Bookmark size={19} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-text tabular-nums">
                {saved.length} {isOnePiece ? 'logged' : 'saved'}
              </div>
              <div className="text-xs text-muted mt-0.5 truncate">
                {saved.length > 0 ? saved[0].examName : 'bookmark questions to review later'}
              </div>
            </div>
          </div>
          <MotionLink to="/saved" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 400, damping: 22 }} className="inline-flex mt-4">
            <Button variant="secondary" size="sm">{isOnePiece ? 'Open Log Pose' : 'Open saved'}</Button>
          </MotionLink>
        </Card>
      </Reveal>
    </div>
  );
}
