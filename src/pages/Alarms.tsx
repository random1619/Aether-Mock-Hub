import { useState } from 'react';
import { AppChrome } from '@/components/layout/AppChrome';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { useAlarmStore } from '@/services/alarmStore';
import { 
  Clock, Bell, Plus, Trash2, Volume2, 
  Sparkles, ShieldCheck, Laptop 
} from 'lucide-react';
import { clsx } from 'clsx';
import { playNetflixTaDum } from '@/services/soundEffects';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Alarms() {
  const { alarms, addAlarm, toggleAlarm, deleteAlarm } = useAlarmStore();
  const [showAddForm, setShowAddForm] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [testTriggered, setTestTriggered] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!(window as any).aetherDesktop;

  const handleCreateAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addAlarm({
      title: title.trim(),
      time,
      days: selectedDays.length ? selectedDays : DAYS_OF_WEEK,
      enabled: true,
    });

    setTitle('');
    setShowAddForm(false);
  };

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Test Alarm Sound & Desktop Notification
  const handleTestAlarm = () => {
    playNetflixTaDum();
    setTestTriggered(true);
    setTimeout(() => setTestTriggered(false), 3000);

    if (isElectron && (window as any).aetherDesktop?.notify) {
      (window as any).aetherDesktop.notify(
        '⏰ Test Practice Alarm',
        'Aether Desktop Alarm test succeeded! Your scheduled alarms will fire here.'
      );
    }
  };

  // Quick Preset Add
  const addPreset = (presetTitle: string, presetTime: string) => {
    addAlarm({
      title: presetTitle,
      time: presetTime,
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      enabled: true,
    });
  };

  return (
    <div className="min-h-screen page-surface flex flex-col mobile-page-shell md:pb-0">
      <AppChrome title="Mock Exam Alarms" icon={<Clock size={16} />} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Header Hero Banner */}
        <Reveal>
          <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-surface-2 border border-[var(--glass-border)] shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
            <div className="space-y-1.5 sm:space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-warning-soft text-warning-fg text-[11px] sm:text-xs font-bold">
                <Bell size={12} className="animate-pulse" /> Desktop Exam Reminders
              </div>
              <h1 className="text-xl sm:text-3xl font-extrabold text-text tracking-[-0.02em]">
                Scheduled Practice Alarms
              </h1>
              <p className="text-xs sm:text-sm text-muted">
                Never miss your daily test targets. Set alarms that fire desktop alerts, sound chimes, and system tray notifications.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0 w-full sm:w-auto">
              <Button onClick={handleTestAlarm} variant="outline" size="sm" className="gap-2 cursor-pointer w-full sm:w-auto h-9 sm:h-8 text-xs">
                <Volume2 size={14} /> {testTriggered ? 'Testing Alarm Sound…' : 'Test Sound'}
              </Button>
              <Button onClick={() => setShowAddForm(true)} variant="primary" size="sm" className="gap-2 cursor-pointer w-full sm:w-auto h-9 sm:h-8 text-xs font-bold">
                <Plus size={14} /> Add New Alarm
              </Button>
            </div>
          </div>
        </Reveal>

        {/* Desktop Status Card */}
        <Reveal delay={0.05}>
          <div className="p-3 sm:p-4 rounded-2xl bg-surface-2/60 border border-[var(--glass-border)] flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className={clsx('w-8 h-8 rounded-xl grid place-items-center text-xs font-bold shrink-0', isElectron ? 'bg-success-soft text-success-fg' : 'bg-info-soft text-info-fg')}>
                <Laptop size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-text flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span>{isElectron ? 'Electron Active' : 'Browser Mode Active'}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-primary-soft text-primary text-[10px]">
                    {isElectron ? 'EXE' : 'Web'}
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-muted truncate">
                  {isElectron
                    ? 'Alarms monitor in background & fire in System Tray.'
                    : 'Alarms trigger while browser tab remains active.'}
                </div>
              </div>
            </div>
            {isElectron && <ShieldCheck size={16} className="text-success-fg shrink-0" />}
          </div>
        </Reveal>

        {/* Quick Presets */}
        <Reveal delay={0.1}>
          <Card>
            <CardHeader title="One-Click Study Presets" icon={<Sparkles size={15} />} />
            <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto sm:overflow-visible scrollbar-none pt-2">
              <div className="flex sm:grid sm:grid-cols-3 gap-2.5 sm:gap-3 min-w-max sm:min-w-0">
                <button
                  onClick={() => addPreset('Morning Quant Warmup', '08:30')}
                  className="w-[15rem] sm:w-auto p-3 sm:p-3.5 rounded-2xl bg-surface-2/70 hover:bg-surface-2 border border-[var(--glass-border)] text-left transition-all group cursor-pointer shrink-0 sm:shrink"
                >
                  <div className="text-xs font-bold text-text flex items-center justify-between gap-2">
                    <span className="truncate">Morning Quant</span>
                    <span className="font-mono text-primary font-extrabold shrink-0">08:30 AM</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-muted mt-0.5">20 target questions</div>
                </button>

                <button
                  onClick={() => addPreset('Afternoon Reasoning Drill', '14:00')}
                  className="w-[15rem] sm:w-auto p-3 sm:p-3.5 rounded-2xl bg-surface-2/70 hover:bg-surface-2 border border-[var(--glass-border)] text-left transition-all group cursor-pointer shrink-0 sm:shrink"
                >
                  <div className="text-xs font-bold text-text flex items-center justify-between gap-2">
                    <span className="truncate">Afternoon Reasoning</span>
                    <span className="font-mono text-info-fg font-extrabold shrink-0">02:00 PM</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-muted mt-0.5">Speed & accuracy drill</div>
                </button>

                <button
                  onClick={() => addPreset('Evening Full Mains Mock', '19:00')}
                  className="w-[15rem] sm:w-auto p-3 sm:p-3.5 rounded-2xl bg-surface-2/70 hover:bg-surface-2 border border-[var(--glass-border)] text-left transition-all group cursor-pointer shrink-0 sm:shrink"
                >
                  <div className="text-xs font-bold text-text flex items-center justify-between gap-2">
                    <span className="truncate">Evening Full Mock</span>
                    <span className="font-mono text-warning-fg font-extrabold shrink-0">07:00 PM</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-muted mt-0.5">Full exam simulation</div>
                </button>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Add New Alarm Form Modal/Card */}
        {showAddForm && (
          <Reveal delay={0.12}>
            <form onSubmit={handleCreateAlarm} className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-surface-2 border border-[var(--glass-border)] space-y-3 sm:space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-text">Create Practice Alarm</h3>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-xs text-muted hover:text-text cursor-pointer p-1">Close</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-muted mb-1">Alarm Name / Target</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. English Grammar Drill"
                    required
                    className="w-full h-10 px-3 rounded-xl bg-bg-raised border border-[var(--glass-border)] text-text text-xs sm:text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] sm:text-xs font-medium text-muted mb-1">Time (24-Hour)</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-xl bg-bg-raised border border-[var(--glass-border)] text-text text-xs sm:text-sm focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] sm:text-xs font-medium text-muted mb-1.5">Repeat Days</label>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const active = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={clsx(
                          'h-8 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer select-none',
                          active ? 'bg-primary text-white shadow-xs' : 'bg-surface text-muted hover:text-text'
                        )}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--glass-border)]">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="font-bold">
                  Save Alarm
                </Button>
              </div>
            </form>
          </Reveal>
        )}

        {/* Scheduled Alarms List */}
        <Reveal delay={0.15}>
          <Card>
            <CardHeader
              title="Configured Alarms"
              icon={<Bell size={16} />}
              action={<span className="text-xs text-muted font-semibold">{alarms.length} Alarms</span>}
            />

            <div className="space-y-3 pt-2">
              {alarms.length === 0 ? (
                <div className="p-12 text-center text-muted">
                  <p className="text-base font-semibold text-text">No practice alarms configured</p>
                  <p className="text-xs mt-1">Click "Add New Alarm" above or pick a quick preset.</p>
                </div>
              ) : (
                alarms.map((alarm) => (
                  <div
                    key={alarm.id}
                    className={clsx(
                      'flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all gap-3',
                      alarm.enabled
                        ? 'bg-surface-2 border-[var(--glass-border)] shadow-xs'
                        : 'bg-surface/30 border-transparent opacity-60'
                    )}
                  >
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        <div className="text-xl sm:text-2xl font-black text-text font-mono tracking-tight shrink-0">
                          {alarm.time}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-text truncate">{alarm.title}</div>
                          <div className="text-xs text-muted truncate mt-0.5 flex items-center gap-2">
                            <span>{alarm.days.join(', ')}</span>
                            <span>•</span>
                            <span className={alarm.enabled ? 'text-success-fg font-semibold' : 'text-muted'}>
                              {alarm.enabled ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                      </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Toggle switch */}
                      <button
                        onClick={() => toggleAlarm(alarm.id)}
                        className={clsx(
                          'w-11 h-6 rounded-full p-1 transition-colors cursor-pointer',
                          alarm.enabled ? 'bg-primary' : 'bg-surface-3'
                        )}
                        aria-label="Toggle alarm"
                      >
                        <div
                          className={clsx(
                            'w-4 h-4 rounded-full bg-white transition-transform',
                            alarm.enabled ? 'translate-x-5' : 'translate-x-0'
                          )}
                        />
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => deleteAlarm(alarm.id)}
                        className="p-2 rounded-xl text-muted hover:text-danger-fg hover:bg-danger-soft transition-colors cursor-pointer"
                        title="Delete Alarm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </Reveal>
      </main>
    </div>
  );
}
