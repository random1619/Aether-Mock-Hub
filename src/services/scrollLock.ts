let lockCount = 0;
let previousOverflow = '';
let previousTouchAction = '';

/** Reference-counted document scroll lock for nested sheets and modals. */
export function acquireScrollLock(): () => void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    }
  };
}
