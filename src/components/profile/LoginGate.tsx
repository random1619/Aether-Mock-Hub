import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, LogIn, ShieldQuestion, UserPlus, Zap } from 'lucide-react';
import { useProfileStore, securityQuestionsFor, checkSecurityAnswers, resetPassword } from '@/services/profileStore';
import { SECURITY_QUESTIONS, passwordStrengthError } from '@/services/credentials';

/* HARD login gate. The app is inaccessible until a profile (login id) is
   active — there is NO guest mode. When logged out this renders a full-screen
   auth panel INSTEAD of the app (children never mount).

   Flows (all local; passwords/answers are PBKDF2-hashed, never plaintext):
     • LOGIN   — pick an id → enter its password. Wrong password → error.
     • CREATE  — name → password + confirm → answer 4 security questions.
     • RECOVER — "Forgot password?" → answer the id's 4 security questions →
                 set a new password (progress is kept). */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type View =
  | { kind: 'list' }
  | { kind: 'login'; id: string; name: string }
  | { kind: 'create' }
  | { kind: 'recover'; id: string; name: string };

export function LoginGate({ children }: { children: ReactNode }) {
  const { active, profiles, login, addProfile } = useProfileStore();
  const [view, setView] = useState<View>({ kind: 'list' });

  const loggedOut = active === null;
  if (!loggedOut) return <>{children}</>;

  return (
    <div
      className="min-h-screen page-surface flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Aether"
    >
      <motion.div
        className="w-full max-w-md bg-bg-raised rounded-3xl shadow-2xl overflow-hidden border border-[var(--glass-border)]"
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      >
        {/* Brand header */}
        <div className="px-7 pt-8 pb-4 text-center">
          <div
            className="mx-auto w-14 h-14 grid place-items-center text-white shadow-md mb-3"
            style={{ borderRadius: '28%', background: 'linear-gradient(150deg,#47a5ff 0%,#0071e3 100%)' }}
          >
            <Zap size={26} strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-text">
            {view.kind === 'create'
              ? 'Create your login id'
              : view.kind === 'recover'
                ? 'Reset password'
                : 'Sign in to Aether'}
          </h1>
          <p className="text-sm text-muted mt-1">
            {view.kind === 'recover'
              ? `Answer ${view.name}'s security questions to set a new password.`
              : 'Your scores, bookmarks, and streaks stay private to your login id.'}
          </p>
        </div>

        <div className="px-5 pb-6">
          <AnimatePresence mode="wait" initial={false}>
            {view.kind === 'list' && (
              <ListView key="list" profiles={profiles} onPick={(id, name) => setView({ kind: 'login', id, name })} onCreate={() => setView({ kind: 'create' })} />
            )}
            {view.kind === 'login' && (
              <LoginView
                key={`login-${view.id}`}
                id={view.id}
                name={view.name}
                onBack={() => setView({ kind: 'list' })}
                onRecover={() => setView({ kind: 'recover', id: view.id, name: view.name })}
                login={login}
              />
            )}
            {view.kind === 'create' && (
              <CreateView
                key="create"
                onBack={profiles.length ? () => setView({ kind: 'list' }) : undefined}
                addProfile={addProfile}
              />
            )}
            {view.kind === 'recover' && (
              <RecoverView
                key={`recover-${view.id}`}
                id={view.id}
                onBack={() => setView({ kind: 'login', id: view.id, name: view.name })}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

/* Shared bits */
function Panel({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-text transition-colors mb-3">
      <ArrowLeft size={13} /> Back
    </button>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  onEnter,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onEnter?: () => void;
  ariaLabel: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.();
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full h-11 pl-4 pr-11 rounded-xl bg-surface-2 text-sm text-text placeholder:text-muted focus:outline-none focus:shadow-[var(--focus-ring)]"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-md text-muted hover:text-text transition-colors"
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-danger mt-2 px-1">{children}</p>;
}

/* View: pick a login id */
function ListView({
  profiles,
  onPick,
  onCreate,
}: {
  profiles: Array<{ id: string; name: string }>;
  onPick: (id: string, name: string) => void;
  onCreate: () => void;
}) {
  return (
    <Panel>
      {profiles.length > 0 && (
        <div className="mb-4">
          <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Your login ids</div>
          <div className="max-h-48 overflow-y-auto rounded-2xl border border-[var(--glass-border)]">
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => onPick(p.id, p.name)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left border-b border-[var(--glass-border)] last:border-b-0"
              >
                <span className="w-10 h-10 grid place-items-center rounded-full bg-primary text-white text-sm font-bold shrink-0">
                  {initials(p.name)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-text truncate">{p.name}</span>
                  <span className="block text-[11px] text-muted">Tap to sign in</span>
                </span>
                <LogIn size={16} className="text-muted shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={onCreate}
        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm"
      >
        <UserPlus size={16} />
        {profiles.length ? 'Create a new login id' : 'Create your login id'}
      </button>
    </Panel>
  );
}

/* View: enter password for an existing id */
function LoginView({
  id,
  name,
  onBack,
  onRecover,
  login,
}: {
  id: string;
  name: string;
  onBack: () => void;
  onRecover: () => void;
  login: (id: string, password: string) => Promise<string | null>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!password) {
      setError('Enter your password');
      return;
    }
    setBusy(true);
    const err = await login(id, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Panel>
      <BackButton onClick={onBack} />
      <div className="flex items-center gap-3 px-1 pb-4">
        <span className="w-11 h-11 grid place-items-center rounded-full bg-primary text-white text-sm font-bold shrink-0">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <div className="text-base font-bold text-text truncate">{name}</div>
          <div className="text-[11px] text-muted">Enter your password to continue</div>
        </div>
      </div>
      <PasswordInput
        value={password}
        onChange={(v) => {
          setPassword(v);
          setError(null);
        }}
        onEnter={submit}
        autoFocus
        placeholder="Password"
        ariaLabel={`Password for ${name}`}
      />
      <ErrorText>{error}</ErrorText>
      <button
        onClick={submit}
        disabled={busy}
        className="w-full mt-4 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <button onClick={onRecover} className="w-full mt-2 h-9 text-xs font-medium text-primary hover:underline transition-colors">
        Forgot password?
      </button>
    </Panel>
  );
}

/* ── View: create a new id (name → password → security questions) ── */
function CreateView({
  onBack,
  addProfile,
}: {
  onBack?: () => void;
  addProfile: (name: string, password: string, secqa: Array<{ q: string; a: string }>) => Promise<string | null>;
}) {
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // The user PICKS 4 distinct questions from the bank (defaults to the first
  // 4) so an attacker can't assume which questions apply to which account.
  const [questions, setQuestions] = useState<string[]>(() => SECURITY_QUESTIONS.slice(0, 4));
  const [answers, setAnswers] = useState<string[]>(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setQuestionAt = (i: number, q: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[i] = q;
      return next;
    });
  };

  const nextStep = () => {
    if (!name.trim()) {
      setError('Enter your name');
      return;
    }
    const weak = passwordStrengthError(password);
    if (weak) {
      setError(weak);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setStep(1);
  };

  const submit = async () => {
    if (new Set(questions).size !== questions.length) {
      setError('Pick 4 different questions');
      return;
    }
    if (answers.some((a) => !a.trim())) {
      setError('Answer all 4 security questions');
      return;
    }
    setBusy(true);
    const secqa = questions.map((q, i) => ({ q, a: answers[i] }));
    const err = await addProfile(name.trim(), password, secqa);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Panel>
      {onBack && <BackButton onClick={onBack} />}
      {step === 0 ? (
        <div className="space-y-3">
          <input
            value={name}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Your name (e.g. Gagan)"
            aria-label="Your name"
            className="w-full h-11 px-4 rounded-xl bg-surface-2 text-sm text-text placeholder:text-muted focus:outline-none focus:shadow-[var(--focus-ring)]"
          />
          <PasswordInput
            value={password}
            onChange={(v) => {
              setPassword(v);
              setError(null);
            }}
            placeholder="Create a password"
            ariaLabel="Create a password"
          />
          <PasswordInput
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              setError(null);
            }}
            onEnter={nextStep}
            placeholder="Confirm password"
            ariaLabel="Confirm password"
          />
          <ErrorText>{error}</ErrorText>
          <button onClick={nextStep} className="w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm">
            Continue
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 px-1 pb-3 text-xs font-semibold text-muted">
            <ShieldQuestion size={14} className="text-primary" />
            Set 4 security questions — used to recover your password.
          </div>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {questions.map((q, i) => (
              <div key={i}>
                <label className="block text-xs font-medium text-text mb-1 px-1">Question {i + 1}</label>
                <select
                  value={q}
                  onChange={(e) => setQuestionAt(i, e.target.value)}
                  aria-label={`Security question ${i + 1}`}
                  className="w-full h-10 px-2 mb-1.5 rounded-lg bg-surface-2 text-[13px] text-text focus:outline-none focus:shadow-[var(--focus-ring)]"
                >
                  {SECURITY_QUESTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <input
                  value={answers[i]}
                  autoFocus={i === 0}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                    setError(null);
                  }}
                  placeholder="Your answer"
                  aria-label={`Answer to: ${q}`}
                  className="w-full h-10 px-3 rounded-lg bg-surface-2 text-sm text-text placeholder:text-muted focus:outline-none focus:shadow-[var(--focus-ring)]"
                />
              </div>
            ))}
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setStep(0)} className="h-11 px-4 rounded-xl bg-surface-2 text-sm font-medium text-text hover:bg-surface-3 transition-colors">
              Back
            </button>
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-60"
            >
              {busy ? 'Creating…' : 'Create & sign in'}
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ── View: recover via security questions → new password ─────── */
function RecoverView({ id, onBack }: { id: string; onBack: () => void }) {
  const questions = securityQuestionsFor(id);
  const [step, setStep] = useState<0 | 1>(0);
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { login } = useProfileStore();

  const verifyAnswers = async () => {
    if (answers.some((a) => !a.trim())) {
      setError('Answer all 4 questions');
      return;
    }
    setBusy(true);
    try {
      const ok = await checkSecurityAnswers(id, answers);
      if (!ok) {
        setError('One or more answers are incorrect');
        return;
      }
      setError(null);
      setStep(1);
    } catch (e) {
      // Rate-limit (ThrottleError) or crypto-availability message.
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const submitNew = async () => {
    const weak = passwordStrengthError(password);
    if (weak) {
      setError(weak);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await resetPassword(id, password);
      // Log straight in with the new password.
      const err = await login(id, password);
      if (err) setError(err);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  if (!questions.length) {
    return (
      <Panel>
        <BackButton onClick={onBack} />
        <p className="text-sm text-muted px-1">No security questions on record for this login id.</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <BackButton onClick={onBack} />
      {step === 0 ? (
        <div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {questions.map((q, i) => (
              <div key={q}>
                <label className="block text-xs font-medium text-text mb-1 px-1">
                  {i + 1}. {q}
                </label>
                <input
                  value={answers[i]}
                  autoFocus={i === 0}
                  onChange={(e) => {
                    const next = [...answers];
                    next[i] = e.target.value;
                    setAnswers(next);
                    setError(null);
                  }}
                  placeholder="Your answer"
                  aria-label={q}
                  className="w-full h-10 px-3 rounded-lg bg-surface-2 text-sm text-text placeholder:text-muted focus:outline-none focus:shadow-[var(--focus-ring)]"
                />
              </div>
            ))}
          </div>
          <ErrorText>{error}</ErrorText>
          <button
            onClick={verifyAnswers}
            disabled={busy}
            className="w-full mt-4 h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-60"
          >
            {busy ? 'Verifying…' : 'Verify answers'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted px-1">Answers verified. Set a new password.</p>
          <PasswordInput
            value={password}
            onChange={(v) => {
              setPassword(v);
              setError(null);
            }}
            autoFocus
            placeholder="New password"
            ariaLabel="New password"
          />
          <PasswordInput
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              setError(null);
            }}
            onEnter={submitNew}
            placeholder="Confirm new password"
            ariaLabel="Confirm new password"
          />
          <ErrorText>{error}</ErrorText>
          <button
            onClick={submitNew}
            disabled={busy}
            className="w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Set password & sign in'}
          </button>
        </div>
      )}
    </Panel>
  );
}
