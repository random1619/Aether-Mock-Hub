import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, Sun, Moon, Check, KeyRound, 
  LogOut, CalendarCheck, Shield, Database, Users, Sparkles
} from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useProfileStore, changePassword } from '@/services/profileStore';
import { passwordStrengthError } from '@/services/credentials';
import { useSettingsStore } from '@/stores/settingsStore';
import { getDailyGoal, setDailyGoal, getStats, getAllSavedQuestions } from '@/services/attemptStore';
import { AppChrome } from '@/components/layout';
import { Button, Card, CardHeader, Reveal } from '@/components/ui';

const GOAL_OPTIONS = [10, 20, 50, 100];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Settings() {
  const navigate = useNavigate();
  const { active, profiles, logout } = useProfileStore();
  const { theme, setTheme } = useSettingsStore();
  const isNetflix = theme === 'netflix';

  const [goal, setGoal] = useState<number>(getDailyGoal());
  const [changingPw, setChangingPw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [nextPw, setNextPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const stats = getStats();
  const savedCount = getAllSavedQuestions().length;

  if (!active) {
    return (
      <div className="min-h-screen grid place-items-center page-surface px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-text mb-2">Not Logged In</h1>
          <p className="text-sm text-muted mb-6">Please log in to view user settings.</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const otherProfiles = profiles.filter((p) => p.id !== active.id);

  const handleSetGoal = (newGoal: number) => {
    setDailyGoal(newGoal);
    setGoal(newGoal);
  };

  const handlePasswordChange = async () => {
    const weak = passwordStrengthError(nextPw);
    if (weak) {
      setPwError(weak);
      return;
    }
    if (nextPw !== confirmPw) {
      setPwError('New passwords do not match');
      return;
    }
    setPwBusy(true);
    try {
      const ok = await changePassword(active.id, currentPw, nextPw);
      if (!ok) {
        setPwError('Current password is incorrect');
        return;
      }
      setPwSuccess(true);
      setCurrentPw('');
      setNextPw('');
      setConfirmPw('');
      setTimeout(() => {
        setPwSuccess(false);
        setChangingPw(false);
      }, 1500);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed to update password');
    } finally {
      setPwBusy(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen page-surface pb-16">
      <AppChrome
        title="User Settings"
        icon={<SettingsIcon size={16} />}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Header Banner */}
        <Reveal>
          <div className="rounded-3xl bg-surface p-6 sm:p-8 ring-1 ring-[var(--glass-border)] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span
                className={clsx(
                  "w-16 h-16 grid place-items-center text-white text-xl font-bold rounded-2xl shadow-md",
                  isNetflix
                    ? "bg-gradient-to-tr from-[#E50914] to-[#b20710]"
                    : "bg-gradient-to-tr from-primary to-primary-hover"
                )}
              >
                {initials(active.name)}
              </span>
              <div>
                <h1 className="text-2xl font-bold text-text tracking-tight">{active.name}</h1>
                <p className="text-xs text-muted font-medium mt-0.5">Profile ID: {active.id}</p>
                <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success-soft text-success-fg">
                  <Shield size={11} /> Active Account
                </span>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-danger/10 text-danger text-xs font-semibold hover:bg-danger/20 transition-colors cursor-pointer"
            >
              <LogOut size={14} /> Sign Out
            </motion.button>
          </div>
        </Reveal>

        {/* Appearance Settings */}
        <Reveal delay={0.05}>
          <Card>
            <CardHeader title="Appearance Theme" icon={<Sparkles size={16} />} />
            <p className="text-xs text-muted mb-4">
              Select your preferred visual style across all mock tests and dashboard components.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { value: 'light' as const, label: 'Apple Light', desc: 'Clean, high-contrast light mode', icon: Sun },
                { value: 'dark' as const, label: 'Apple Dark', desc: 'Sleek dark theme for late sessions', icon: Moon },
                { value: 'netflix' as const, label: 'Netflix Cinema', desc: 'Cinematic red & dark layout', icon: null },
              ].map((opt) => {
                const isActive = theme === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTheme(opt.value)}
                    className={clsx(
                      'p-4 rounded-2xl text-left border flex flex-col justify-between gap-3 transition-all cursor-pointer relative',
                      isActive
                        ? 'bg-primary-soft/40 border-primary ring-2 ring-primary/30 text-text'
                        : 'bg-surface border-[var(--glass-border)] text-muted hover:text-text hover:bg-surface-2'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-xl grid place-items-center bg-surface-2 text-text">
                        {opt.value === 'netflix' ? (
                          <span className="text-xs font-black text-[#E50914]">N</span>
                        ) : (
                          opt.icon && <opt.icon size={18} />
                        )}
                      </div>
                      {isActive && <Check size={18} className="text-primary" />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-text">{opt.label}</div>
                      <div className="text-[11px] text-muted mt-0.5">{opt.desc}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </Card>
        </Reveal>

        {/* Daily Goal Preferences */}
        <Reveal delay={0.1}>
          <Card>
            <CardHeader title="Daily Practice Goal" icon={<CalendarCheck size={16} />} />
            <p className="text-xs text-muted mb-4">
              Set how many questions you target to complete each day.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {GOAL_OPTIONS.map((g) => (
                <motion.button
                  key={g}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSetGoal(g)}
                  className={clsx(
                    'px-5 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer tabular-nums',
                    goal === g
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/40'
                      : 'bg-surface-2 text-muted hover:text-text hover:bg-surface-3'
                  )}
                >
                  {g} Questions / day
                </motion.button>
              ))}
            </div>
          </Card>
        </Reveal>

        {/* Account & Password Management */}
        <Reveal delay={0.15}>
          <Card>
            <CardHeader title="Security & Credentials" icon={<KeyRound size={16} />} />
            <div className="space-y-4">
              {!changingPw ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-text">Account Password</div>
                    <p className="text-xs text-muted">Update your login password for profile {active.name}.</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setChangingPw(true)}>
                    Change Password
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-2xl bg-surface-2/60 border border-[var(--glass-border)] max-w-md">
                  <h3 className="text-sm font-bold text-text mb-2">Change Password</h3>
                  <input
                    type="password"
                    value={currentPw}
                    onChange={(e) => { setCurrentPw(e.target.value); setPwError(null); }}
                    placeholder="Current password"
                    className="w-full h-10 px-3.5 rounded-xl bg-surface border border-[var(--glass-border)] text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    type="password"
                    value={nextPw}
                    onChange={(e) => { setNextPw(e.target.value); setPwError(null); }}
                    placeholder="New password"
                    className="w-full h-10 px-3.5 rounded-xl bg-surface border border-[var(--glass-border)] text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => { setConfirmPw(e.target.value); setPwError(null); }}
                    placeholder="Confirm new password"
                    className="w-full h-10 px-3.5 rounded-xl bg-surface border border-[var(--glass-border)] text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {pwError && <p className="text-xs text-danger">{pwError}</p>}
                  {pwSuccess && <p className="text-xs text-success font-semibold">Password updated successfully!</p>}
                  <div className="flex gap-2 pt-1">
                    <Button variant="primary" size="sm" onClick={handlePasswordChange} disabled={pwBusy}>
                      {pwBusy ? 'Updating…' : 'Update Password'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setChangingPw(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Reveal>

        {/* Profile Switcher */}
        {otherProfiles.length > 0 && (
          <Reveal delay={0.2}>
            <Card>
              <CardHeader title="Switch Profile" icon={<Users size={16} />} />
              <p className="text-xs text-muted mb-4">
                Other active user profiles on this installation.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {otherProfiles.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-2xl bg-surface border border-[var(--glass-border)] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-xl grid place-items-center bg-primary text-white text-xs font-bold shrink-0">
                        {initials(p.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-text truncate">{p.name}</div>
                        <div className="text-xs text-muted truncate">ID: {p.id}</div>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={handleLogout}>
                      Switch
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>
        )}

        {/* Account Data Summary */}
        <Reveal delay={0.25}>
          <Card>
            <CardHeader title="Account Data & Storage" icon={<Database size={16} />} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center py-2">
              <div className="p-3 rounded-2xl bg-surface-2/50">
                <div className="text-2xl font-bold text-text tabular-nums">{stats.totalAttempted}</div>
                <div className="text-xs text-muted font-medium mt-1">Total Attempts</div>
              </div>
              <div className="p-3 rounded-2xl bg-surface-2/50">
                <div className="text-2xl font-bold text-text tabular-nums">{savedCount}</div>
                <div className="text-xs text-muted font-medium mt-1">Saved Questions</div>
              </div>
              <div className="p-3 rounded-2xl bg-surface-2/50 col-span-2 sm:col-span-1">
                <div className="text-2xl font-bold text-text tabular-nums">{stats.streakDays} Days</div>
                <div className="text-xs text-muted font-medium mt-1">Current Streak</div>
              </div>
            </div>
          </Card>
        </Reveal>
      </main>
    </div>
  );
}
