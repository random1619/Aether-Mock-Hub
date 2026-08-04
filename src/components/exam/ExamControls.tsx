import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useExamStore } from '@/stores/examStore';
import { Button } from '@/components/ui';

/**
 * TCS iON bottom action bar.
 * Order:  Previous | Save & Next | Mark for Review & Next | Clear Response   …   Submit
 * Colour: Save&Next green, Mark violet, Clear orange — exactly TCS.
 */
export function ExamControls({ onSubmit }: { onSubmit: () => void }) {
  const currentIdx = useExamStore((s) => s.currentIdx);
  const questions = useExamStore((s) => s.questions);
  const isSectionalMode = useExamStore((s) => s.isSectionalMode);
  const meta = useExamStore((s) => s.meta);
  const currentSectionIdx = useExamStore((s) => s.currentSectionIdx);
  const prev = useExamStore((s) => s.prev);
  const saveNext = useExamStore((s) => s.saveNext);
  const markAndNext = useExamStore((s) => s.markAndNext);
  const clearAndStay = useExamStore((s) => s.clearAndStay);
  const answers = useExamStore((s) => s.answers);

  let min = 0;
  let max = questions.length - 1;
  if (isSectionalMode && meta) {
    const sec = meta.sections[currentSectionIdx];
    min = sec.start;
    max = sec.end;
  }

  const hasAnswer = answers[currentIdx] !== undefined;

  return (
    <div className="flex items-stretch justify-between gap-2 flex-wrap">
      {/* Left cluster */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          leftIcon={<ChevronLeft size={15} />}
          onClick={prev}
          disabled={currentIdx === min}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={clearAndStay}
          disabled={!hasAnswer}
          className="hover:brightness-110 shadow-sm"
          style={{ background: 'var(--tcs-clear)', color: 'var(--tcs-clear-fg)', borderColor: 'transparent' }}
        >
          Clear Response
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={markAndNext}
          className="hover:brightness-110 shadow-sm"
          style={{ background: 'var(--tcs-mark)', color: 'var(--tcs-mark-fg)', borderColor: 'transparent' }}
        >
          Mark for Review &amp; Next
        </Button>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          rightIcon={<ChevronRight size={15} />}
          onClick={saveNext}
          disabled={currentIdx === max}
          style={{ background: 'var(--tcs-save)', color: 'var(--tcs-save-fg)', borderColor: 'transparent' }}
          className="font-bold hover:brightness-110 shadow-sm"
        >
          Save &amp; Next
        </Button>
        <Button
          variant="secondary"
          size="md"
          rightIcon={<Send size={14} />}
          onClick={onSubmit}
          className="font-bold hover:brightness-110 shadow-sm"
          style={{ background: 'var(--tcs-submit)', color: 'var(--tcs-submit-fg)', borderColor: 'transparent' }}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
