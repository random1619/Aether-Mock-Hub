import { X } from 'lucide-react';
import { useExamStore } from '@/stores/examStore';
import { Modal, Button } from '@/components/ui';

/**
 * TCS iON Instructions modal — dense bilingual list matching what the real
 * exam shows before "I have read and understood the instructions".
 * Reaching this from the header during an active exam does NOT pause the timer.
 */
export function InstructionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const meta = useExamStore((s) => s.meta);
  const phase = useExamStore((s) => s.phase);

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-3xl" showClose={false}>
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-tcs-border mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-tcs-muted font-bold">
            Staff Selection Commission
          </div>
          <h2 className="text-lg font-bold text-tcs-text mt-0.5">
            {meta?.name || 'Mock Examination'} — Instructions
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close instructions"
          className="w-8 h-8 grid place-items-center rounded-sm text-tcs-muted hover:text-tcs-text hover:bg-tcs-panel transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="text-sm text-tcs-text space-y-2.5 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
        <p className="font-bold text-tcs-text">
          Please read the following instructions carefully. / कृपया निम्नलिखित निर्देशों को ध्यान से पढ़ें।
        </p>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            Total duration of this examination is {meta?.durationMinutes ?? 60} minutes. The clock
            starts when you click <em>I am ready to begin</em> and continues even if you close this
            window.
          </li>
          <li>
            The Question Palette on the right shows the status of every question:
            <ul className="list-disc list-inside ml-4 mt-1 space-y-0.5">
              <li><span className="inline-block w-3 h-3 bg-tcs-notvisited mr-1.5 align-middle" /> Grey — Not Visited</li>
              <li><span className="inline-block w-3 h-3 bg-tcs-notanswered mr-1.5 align-middle" /> Red — Not Answered</li>
              <li><span className="inline-block w-3 h-3 bg-tcs-answered mr-1.5 align-middle" /> Green — Answered</li>
              <li><span className="inline-block w-3 h-3 bg-tcs-marked mr-1.5 align-middle" /> Violet — Marked for Review</li>
              <li>
                <span className="inline-block w-3 h-3 bg-tcs-marked mr-1.5 align-middle relative">
                  <span className="absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full bg-tcs-answer-dot" />
                </span>
                Violet with green dot — Answered &amp; Marked for Review (will be evaluated)
              </li>
            </ul>
          </li>
          <li>Each correct answer earns full marks; each incorrect answer attracts a penalty of 0.25 × marks.</li>
          <li>
            To answer a question, click the option button; to change it, click another option or use
            <em> Clear Response</em>.
          </li>
          <li>
            Click <em>Save &amp; Next</em> to save your answer and proceed. Your answer is saved even
            if you navigate via the palette directly.
          </li>
          <li>
            Use <em>Mark for Review &amp; Next</em> to flag a question you want to revisit. Marked
            questions still count their answer in evaluation.
          </li>
          <li>
            Switch between sections anytime using the section tabs above the question area.
          </li>
          <li>
            Keyboard shortcuts: <em>←</em> / <em>→</em> move between questions, <em>↑</em> / <em>↓</em>{' '}
            change the selected option, and keys <em>1</em>–<em>6</em> pick an option directly.
          </li>
          <li>
            Exiting fullscreen during the test is a violation and is recorded. The result page shows
            the violation count.
          </li>
          <li>The exam auto-submits when time runs out. You may also click <em>Submit</em> at any time.</li>
        </ol>
        <p className="text-tcs-muted text-xs mt-4">
          Note: This mock mimics the actual SSC CBT (TCS iON) exam interface for practice purposes.
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-tcs-border flex justify-end">
        <Button variant="primary" onClick={onClose}>
          {phase === 'welcome' ? 'Close' : 'Back to Test'}
        </Button>
      </div>
    </Modal>
  );
}
