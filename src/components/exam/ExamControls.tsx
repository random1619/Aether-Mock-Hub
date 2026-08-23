import { ChevronLeft, ChevronRight, Send, ArrowRightCircle } from 'lucide-react';
import { useExamStore } from '@/stores/examStore';
import { Button } from '@/components/ui';
import { haptic } from '@/services/nativeMobile';
import { getGroupBounds } from '@/services/cglPattern';

/**
 * TCS iON bottom action bar.
 * Order: Previous | Save & Next | Mark for Review & Next | Clear Response … Submit / Submit Section
 * Colour: Save&Next green, Mark violet, Clear orange — exactly TCS.
 */
export function ExamControls({
  onSubmit,
  onSubmitSection,
}: {
  onSubmit: () => void;
  onSubmitSection?: () => void;
}) {
  const currentIdx = useExamStore((s) => s.currentIdx);
  const questions = useExamStore((s) => s.questions);
  const isSectionalMode = useExamStore((s) => s.isSectionalMode);
  const sectionalTimerEnabled = useExamStore((s) => s.sectionalTimerEnabled);
  const meta = useExamStore((s) => s.meta);
  const currentSectionIdx = useExamStore((s) => s.currentSectionIdx);
  const lockedSections = useExamStore((s) => s.lockedSections);
  const prev = useExamStore((s) => s.prev);
  const saveNext = useExamStore((s) => s.saveNext);
  const markAndNext = useExamStore((s) => s.markAndNext);
  const clearAndStay = useExamStore((s) => s.clearAndStay);
  const answers = useExamStore((s) => s.answers);

  let min = 0;
  let max = questions.length - 1;
  if (isSectionalMode && meta) {
    if (sectionalTimerEnabled && meta.sections[currentSectionIdx]?.groupId) {
      const b = getGroupBounds(currentSectionIdx, meta.sections);
      min = b.start;
      max = b.end;
    } else {
      const sec = meta.sections[currentSectionIdx];
      if (sec) {
        min = sec.start;
        max = sec.end;
      }
    }
  }

  const hasAnswer = answers[currentIdx] !== undefined;

  // Determine if there are more sections to attempt
  const totalSections = meta?.sections.length || 1;
  const isLastSection =
    !sectionalTimerEnabled ||
    totalSections <= 1 ||
    lockedSections.size >= totalSections - 1 ||
    currentSectionIdx === totalSections - 1;

  const handleSubmitClick = () => {
    haptic.heavy();
    if (!isLastSection && onSubmitSection) {
      onSubmitSection();
    } else {
      onSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Mobile-optimized Action Grid (thumb-friendly 2-tier layout) */}
      <div className="sm:hidden flex flex-col gap-2">
        {/* Tier 1: Secondary Controls (Previous, Clear, Mark for Review) */}
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<ChevronLeft size={15} />}
            onClick={() => {
              prev();
              haptic.tap();
            }}
            disabled={currentIdx === min}
            className="min-h-[44px] text-xs font-bold px-2 justify-center shadow-xs active:scale-95 transition-transform"
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              clearAndStay();
              haptic.tap();
            }}
            disabled={!hasAnswer}
            className="min-h-[44px] text-xs font-bold px-2 justify-center hover:brightness-110 shadow-xs active:scale-95 transition-all"
            style={{ background: 'var(--tcs-clear)', color: 'var(--tcs-clear-fg)', borderColor: 'transparent' }}
          >
            Clear
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              markAndNext();
              haptic.tap();
            }}
            className="min-h-[44px] text-xs font-bold px-2 justify-center hover:brightness-110 shadow-xs active:scale-95 transition-all truncate"
            style={{ background: 'var(--tcs-mark)', color: 'var(--tcs-mark-fg)', borderColor: 'transparent' }}
            title="Mark for Review & Next"
          >
            Mark &amp; Next
          </Button>
        </div>

        {/* Tier 2: Primary CTAs (Save & Next + Submit Section / Submit) */}
        <div className="grid grid-cols-5 gap-2">
          <Button
            variant="secondary"
            size="md"
            rightIcon={<ChevronRight size={17} />}
            onClick={() => {
              saveNext();
              haptic.tap();
            }}
            disabled={currentIdx === max}
            style={{ background: 'var(--tcs-save)', color: 'var(--tcs-save-fg)', borderColor: 'transparent' }}
            className="col-span-3 min-h-[50px] text-base font-extrabold justify-center shadow-md hover:brightness-105 active:scale-[0.98] transition-all"
          >
            Save &amp; Next
          </Button>
          <Button
            variant="secondary"
            size="md"
            rightIcon={isLastSection ? <Send size={14} /> : <ArrowRightCircle size={14} />}
            onClick={handleSubmitClick}
            className="col-span-2 min-h-[50px] text-xs sm:text-sm font-bold justify-center shadow-md hover:brightness-105 active:scale-[0.98] transition-all"
            style={{ background: 'var(--tcs-submit)', color: 'var(--tcs-submit-fg)', borderColor: 'transparent' }}
          >
            {isLastSection ? 'Submit' : 'Next Sec'}
          </Button>
        </div>
      </div>

      {/* Desktop Flex Bar */}
      <div className="hidden sm:flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            leftIcon={<ChevronLeft size={15} />}
            onClick={() => {
              prev();
              haptic.tap();
            }}
            disabled={currentIdx === min}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              clearAndStay();
              haptic.tap();
            }}
            disabled={!hasAnswer}
            className="hover:brightness-110 shadow-sm"
            style={{ background: 'var(--tcs-clear)', color: 'var(--tcs-clear-fg)', borderColor: 'transparent' }}
          >
            Clear Response
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              markAndNext();
              haptic.tap();
            }}
            className="hover:brightness-110 shadow-sm"
            style={{ background: 'var(--tcs-mark)', color: 'var(--tcs-mark-fg)', borderColor: 'transparent' }}
          >
            Mark for Review &amp; Next
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            rightIcon={<ChevronRight size={15} />}
            onClick={() => {
              saveNext();
              haptic.tap();
            }}
            disabled={currentIdx === max}
            style={{ background: 'var(--tcs-save)', color: 'var(--tcs-save-fg)', borderColor: 'transparent' }}
            className="font-bold hover:brightness-110 shadow-sm"
          >
            Save &amp; Next
          </Button>
          <Button
            variant="secondary"
            size="md"
            rightIcon={isLastSection ? <Send size={14} /> : <ArrowRightCircle size={14} />}
            onClick={handleSubmitClick}
            className="font-bold hover:brightness-110 shadow-sm"
            style={{ background: 'var(--tcs-submit)', color: 'var(--tcs-submit-fg)', borderColor: 'transparent' }}
          >
            {isLastSection ? 'Submit Exam' : 'Submit Section'}
          </Button>
        </div>
      </div>
    </div>
  );
}
