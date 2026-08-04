/* BATTERY WATCH — low-battery warnings during an active exam.
   Renderer-side because Chromium's Battery Status API exposes the
   charge LEVEL; Electron's powerMonitor only reports AC/battery
   transitions (handled in the main process). Warnings fire through
   the desktop bridge as native notifications — silent in browsers. */

/** Poll interval. The Battery API's levelchange events are unreliable
    across platforms, so polling is the steady fallback. */
const POLL_MS = 60_000;
/** Thresholds (fraction of full charge) at which a warning fires once. */
const WARN_LEVEL = 0.25;
const CRITICAL_LEVEL = 0.1;

interface BatteryLike {
  charging: boolean;
  level: number; // 0..1
}

let _timer: ReturnType<typeof setInterval> | null = null;
let _battery: BatteryLike | null = null;
let _warned = false;
let _criticalWarned = false;

function notify(title: string, body: string): void {
  try {
    (window as any).aetherDesktop?.notify?.(title, body);
  } catch {
    /* non-Electron */
  }
}

function check(): void {
  const b = _battery;
  if (!b) return;
  // Plugging back in re-arms the warnings for the next discharge cycle.
  if (b.charging) {
    _warned = false;
    _criticalWarned = false;
    return;
  }
  const pct = Math.round(b.level * 100);
  if (b.level <= CRITICAL_LEVEL && !_criticalWarned) {
    _criticalWarned = true;
    notify('Battery Critical', `${pct}% left — plug in your charger NOW, the exam is still running.`);
  } else if (b.level <= WARN_LEVEL && !_warned) {
    _warned = true;
    notify('Battery Low', `${pct}% left — plug in your charger soon.`);
  }
}

/** Start watching. No-op without the Battery API or when already running. */
export function startBatteryWatch(): void {
  stopBatteryWatch();
  const nav = navigator as any;
  if (typeof nav.getBattery !== 'function') return;
  nav.getBattery().then((b: BatteryLike) => {
    _battery = b;
    check(); // immediate check — don't wait a full minute to warn at 8%
  }).catch(() => { /* Battery API blocked — skip silently */ });
  _timer = setInterval(check, POLL_MS);
}

/** Stop watching and clear warning state (call on exam end/reset). */
export function stopBatteryWatch(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  _battery = null;
  _warned = false;
  _criticalWarned = false;
}
