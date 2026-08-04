import { AppWindow } from 'lucide-react';
import { ViolationOverlay } from './ViolationOverlay';

/**
 * Shown when the user returns after switching tabs / losing window focus
 * during an active test. Every occurrence is counted in the exam store
 * (`tabSwitches`) and surfaced in the result modal's integrity log.
 */
export function FocusLostOverlay({ count, onResume }: { count: number; onResume: () => void }) {
  return (
    <ViolationOverlay
      label="Exam focus lost"
      title="You left the exam window"
      body={
        <>
          Switching tabs or applications during the examination is a violation. It has been
          recorded in the integrity log{count > 0 ? ` (${count} time${count === 1 ? '' : 's'} so far)` : ''}.
        </>
      }
      actionLabel="Return to Exam"
      actionIcon={<AppWindow size={15} />}
      onAction={onResume}
    />
  );
}
