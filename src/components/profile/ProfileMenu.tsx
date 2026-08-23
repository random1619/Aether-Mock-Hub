import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, KeyRound, LogOut, Moon, Settings as SettingsIcon, Sun, UserPlus, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { useProfileStore } from '@/services/profileStore';
import { changePassword } from '@/services/profileStore';
import { passwordStrengthError } from '@/services/credentials';
import { useSettingsStore } from '@/stores/settingsStore';

/* Account menu for the nav bar (only rendered while logged in — the LoginGate
   owns the logged-out state). Shows the active login id's avatar + name; the
   dropdown can switch id (each requires its own password, handled by signing
   out to the login panel), change the active id's password, or sign out. */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  const { theme } = useSettingsStore();
  const isNetflix = theme === 'netflix';
  return (
    <span
      className={clsx(
        "grid place-items-center text-white font-bold shrink-0 shadow-sm transition-all",
        isNetflix ? "rounded-full bg-gradient-to-tr from-[#E50914] to-[#b20710]" : "rounded-full bg-primary"
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function ProfileMenu() {
  const { active, profiles, logout } = useProfileStore();
  const { theme, setTheme } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* Close on outside click / Escape. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!active) return null;

  const otherProfiles = profiles.filter((p) => p.id !== active.id);

  /* Switching to another id (or creating one) requires that id's password /
   * full create flow, which the LoginGate owns — sign out to reach it. */
  const goToLogin = () => {
    setOpen(false);
    logout();
  };

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <Link
        to="/settings"
        aria-label={`Signed in as ${active.name}. Go to user settings.`}
        className="flex items-center gap-2 h-8 pl-1 pr-2 rounded-full text-text hover:bg-surface-2 transition-colors group cursor-pointer"
      >
        <Avatar name={active.name} />
        <span className="text-[13px] font-medium max-w-[7rem] truncate hidden sm:inline group-hover:text-primary transition-colors">{active.name}</span>
      </Link>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open account menu"
        className="p-1 rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
      >
        <ChevronDown size={13} className={clsx('transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Account"
            className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl bg-bg-raised border border-[var(--glass-border)] shadow-2xl overflow-hidden z-[9999]"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Active identity — links to user settings */}
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center justify-between gap-3 hover:bg-surface-2 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={active.name} size={36} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-text truncate group-hover:text-primary transition-colors">{active.name}</div>
                  <div className="text-[11px] text-muted">User Settings & Preferences</div>
                </div>
              </div>
              <span className="w-7 h-7 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0 group-hover:scale-110 transition-transform">
                <SettingsIcon size={14} />
              </span>
            </Link>

            {/* Appearance — pick the full design scheme. Apple light/dark stay
                available alongside the Netflix scheme; selection persists. */}
            <div className="px-4 pt-2.5 pb-2 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">
                Appearance
              </div>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Appearance theme">
                {(
                  [
                    { value: 'light' as const, label: 'Light', icon: Sun },
                    { value: 'dark' as const, label: 'Dark', icon: Moon },
                    { value: 'netflix' as const, label: 'Netflix', icon: null },
                  ]
                ).map((opt) => {
                  const isActive = theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setTheme(opt.value)}
                      aria-pressed={isActive}
                      className={clsx(
                        'flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-xl text-[11px] font-semibold transition-all',
                        isActive
                          ? 'bg-primary-soft text-primary ring-1 ring-primary/40'
                          : 'bg-surface-2 text-muted hover:text-text hover:bg-surface-3',
                      )}
                    >
                      {opt.value === 'netflix' ? (
                        <span
                          aria-hidden
                          className="w-5 h-5 grid place-items-center rounded-[5px] text-white text-[11px] font-black"
                          style={{ background: 'linear-gradient(180deg,#f6121d,#b20710)' }}
                        >
                          N
                        </span>
                      ) : (
                        opt.icon && <opt.icon size={16} />
                      )}
                      {opt.label}
                      {isActive && <Check size={12} className="text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Other login ids (switching requires their password → login panel) */}
            {otherProfiles.length > 0 && (
              <>
                <div className="px-4 pt-2 pb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <Users size={12} />
                  Switch login id
                </div>
                <div className="max-h-40 overflow-y-auto pb-1">
                  {otherProfiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={goToLogin}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-surface-2 transition-colors"
                    >
                      <Avatar name={p.name} size={26} />
                      <span className="flex-1 min-w-0 text-sm font-medium text-text truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Change password */}
            <div className="border-t border-[var(--glass-border)] p-2">
              {changingPw ? (
                <ChangePasswordForm
                  id={active.id}
                  onDone={() => setChangingPw(false)}
                  onCancel={() => setChangingPw(false)}
                />
              ) : (
                <button
                  onClick={() => setChangingPw(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text hover:bg-surface-2 transition-colors"
                >
                  <span className="w-[30px] h-[30px] grid place-items-center rounded-full bg-surface-2 text-primary">
                    <KeyRound size={15} />
                  </span>
                  Change password
                </button>
              )}
            </div>

            {/* Add id + sign out */}
            <div className="border-t border-[var(--glass-border)] p-2 space-y-1">
              <button
                onClick={goToLogin}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary-soft transition-colors"
              >
                <span className="w-[30px] h-[30px] grid place-items-center rounded-full bg-primary-soft">
                  <UserPlus size={15} />
                </span>
                Add / switch login id
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition-colors"
              >
                <span className="w-[30px] h-[30px] grid place-items-center rounded-full bg-danger/10">
                  <LogOut size={15} />
                </span>
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Inline change-password: verify current, then set the new one. */
function ChangePasswordForm({ id, onDone, onCancel }: { id: string; onDone: () => void; onCancel: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const weak = passwordStrengthError(next);
    if (weak) {
      setError(weak);
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const good = await changePassword(id, current, next);
      if (!good) {
        setError('Current password is incorrect');
        return;
      }
      setOk(true);
      setTimeout(onDone, 900);
    } catch (e) {
      // Rate-limit (ThrottleError) or crypto-availability message.
      setError(e instanceof Error ? e.message : 'Could not update password');
    } finally {
      setBusy(false);
    }
  };

  if (ok) {
    return (
      <div className="px-3 py-2 flex items-center gap-2 text-sm font-medium text-success">
        <Check size={16} /> Password updated
      </div>
    );
  }

  return (
    <div className="px-2 pb-1 space-y-2">
      <input
        type="password"
        value={current}
        autoFocus
        onChange={(e) => {
          setCurrent(e.target.value);
          setError(null);
        }}
        placeholder="Current password"
        aria-label="Current password"
        className="w-full h-9 px-3 rounded-lg bg-surface-2 text-sm text-text placeholder:text-muted focus:outline-none focus:shadow-[var(--focus-ring)]"
      />
      <input
        type="password"
        value={next}
        onChange={(e) => {
          setNext(e.target.value);
          setError(null);
        }}
        placeholder="New password"
        aria-label="New password"
        className="w-full h-9 px-3 rounded-lg bg-surface-2 text-sm text-text placeholder:text-muted focus:outline-none focus:shadow-[var(--focus-ring)]"
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Confirm new password"
        aria-label="Confirm new password"
        className="w-full h-9 px-3 rounded-lg bg-surface-2 text-sm text-text placeholder:text-muted focus:outline-none focus:shadow-[var(--focus-ring)]"
      />
      {error && <p className="text-[11px] text-danger px-1">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="flex-1 h-8 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Update'}
        </button>
        <button onClick={onCancel} className="h-8 px-3 rounded-lg bg-surface-2 text-xs font-medium text-text hover:bg-surface-3 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
