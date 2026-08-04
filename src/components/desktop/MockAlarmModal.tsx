import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clock, Bell, Plus, Trash2, X, Play } from 'lucide-react';
import { clsx } from 'clsx';
import { useAlarmStore } from '@/services/alarmStore';
import { Link, useNavigate } from 'react-router-dom';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MockAlarmModal() {
  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // New alarm form state
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  const { alarms, addAlarm, toggleAlarm, deleteAlarm, activeFiredAlarm, setFiredAlarm } = useAlarmStore();
  const navigate = useNavigate();

  // Listen for Electron IPC alarms fired in background
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).aetherDesktop?.onAlarmFired) {
      const unsub = (window as any).aetherDesktop.onAlarmFired((alarm: any) => {
        setFiredAlarm(alarm);
      });
      return () => unsub();
    }
  }, [setFiredAlarm]);

  // Handle adding new practice alarm
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

  return (
    <>
      {/* Navbar Alarm Link Button */}
      <Link
        to="/alarms"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-text-2 hover:text-text hover:bg-surface-2 transition-all cursor-pointer"
        title="Mock Test Alarms & Practice Reminders"
      >
        <Bell size={13} className="text-warning-fg animate-pulse" />
        <span className="hidden sm:inline">Alarms</span>
        {alarms.filter((a) => a.enabled).length > 0 && (
          <span className="w-4 h-4 rounded-full bg-warning/20 text-warning-fg text-[10px] font-bold grid place-items-center">
            {alarms.filter((a) => a.enabled).length}
          </span>
        )}
      </Link>

      {/* Alarm Fired Notification Alert Overlay */}
      <AnimatePresence>
        {activeFiredAlarm && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.9 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-md p-4 rounded-3xl bg-warning/90 backdrop-blur-2xl text-white shadow-2xl border border-warning/40 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-white/20 grid place-items-center shrink-0">
                <Bell size={20} className="animate-bounce text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase tracking-wider opacity-80">Practice Alarm Fired!</div>
                <div className="text-sm font-extrabold truncate">{activeFiredAlarm.title}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => {
                  setFiredAlarm(null);
                  if (activeFiredAlarm.mockPath) {
                    navigate(activeFiredAlarm.mockPath);
                  } else {
                    navigate('/');
                  }
                }}
                className="px-3 py-1.5 rounded-full bg-white text-warning-fg text-xs font-bold hover:bg-white/90 transition-all flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Play size={12} fill="currentColor" /> Start Now
              </button>
              <button
                onClick={() => setFiredAlarm(null)}
                className="p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-white"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Manager */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[10000] overflow-y-auto grid place-items-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg my-auto rounded-3xl bg-bg-raised border border-[var(--glass-border)] shadow-2xl p-6 overflow-hidden z-10"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--glass-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-warning-soft grid place-items-center text-warning-fg">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-text">Mock Practice Alarms</h2>
                    <p className="text-xs text-muted">Desktop study reminders & scheduled exam alerts</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                  {alarms.length} Scheduled Alarms
                </span>
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-all cursor-pointer shadow-sm"
                >
                  <Plus size={14} /> Add Alarm
                </button>
              </div>

              {/* Add New Alarm Form */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleCreateAlarm}
                    className="mt-4 p-4 rounded-2xl bg-surface-2 border border-[var(--glass-border)] space-y-3 overflow-hidden"
                  >
                    <div>
                      <label className="block text-xs font-medium text-muted mb-1">Alarm Title / Target</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Morning Quant Practice 100 Qs"
                        required
                        className="w-full h-9 px-3 rounded-xl bg-bg-raised border border-[var(--glass-border)] text-text text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-muted mb-1">Time (24-hour format)</label>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          required
                          className="w-full h-9 px-3 rounded-xl bg-bg-raised border border-[var(--glass-border)] text-text text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-muted mb-1.5">Repeat Days</label>
                      <div className="flex flex-wrap gap-1.5">
                        {DAYS_OF_WEEK.map((day) => {
                          const active = selectedDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(day)}
                              className={clsx(
                                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer',
                                active ? 'bg-primary text-white shadow-xs' : 'bg-surface text-muted hover:text-text'
                              )}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted hover:text-text cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm cursor-pointer"
                      >
                        Save Alarm
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Alarms List */}
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-1">
                {alarms.length === 0 ? (
                  <div className="p-8 text-center text-muted">
                    <p className="text-sm font-medium">No alarms scheduled</p>
                    <p className="text-xs mt-1">Add a practice reminder to stay consistent with your daily targets.</p>
                  </div>
                ) : (
                  alarms.map((alarm) => (
                    <div
                      key={alarm.id}
                      className={clsx(
                        'flex items-center justify-between p-3.5 rounded-2xl border transition-all',
                        alarm.enabled
                          ? 'bg-surface-2 border-[var(--glass-border)]'
                          : 'bg-surface/40 border-transparent opacity-60'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-xl font-extrabold text-text font-mono shrink-0">
                          {alarm.time}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-text truncate">{alarm.title}</div>
                          <div className="text-[11px] text-muted truncate mt-0.5">
                            {alarm.days.join(', ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Toggle switch */}
                        <button
                          onClick={() => toggleAlarm(alarm.id)}
                          className={clsx(
                            'w-10 h-6 rounded-full p-1 transition-colors cursor-pointer',
                            alarm.enabled ? 'bg-primary' : 'bg-surface-3'
                          )}
                        >
                          <div
                            className={clsx(
                              'w-4 h-4 rounded-full bg-white transition-transform',
                              alarm.enabled ? 'translate-x-4' : 'translate-x-0'
                            )}
                          />
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => deleteAlarm(alarm.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-danger-fg hover:bg-danger-soft transition-colors cursor-pointer"
                          title="Delete Alarm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
