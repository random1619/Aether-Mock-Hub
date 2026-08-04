import { Maximize } from 'lucide-react';
import { ViolationOverlay } from './ViolationOverlay';

/**
 * Shown when the user escaped fullscreen during an active test (TCS behaviour).
 * Fullscreen escapes are counted in the exam store (`fsExits`); the count is
 * surfaced in the result modal like a TCS integrity report.
 */
export function FullscreenExitOverlay({ onReenter }: { onReenter: () => void }) {
  return (
    <ViolationOverlay
      label="Fullscreen exited"
      title="You exited fullscreen mode"
      body="Leaving fullscreen during the examination is a violation. It has been recorded in the integrity log. Click below to re-enter fullscreen and resume."
      actionLabel="Re-enter Fullscreen"
      actionIcon={<Maximize size={15} />}
      onAction={onReenter}
    />
  );
}
