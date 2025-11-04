import { bonusPromptsAtom, onboardingChecklistAtom } from '@/app/atoms/bonusPromptsAtom';
import { events } from '@/app/events/events';
import { usePromptAITutorial } from '@/app/onboarding/usePromptAITutorial';
import { useWatchTutorial } from '@/app/onboarding/useWatchTutorial';
import { EducationIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';

// Animation timing constants (in milliseconds)
const ANIMATION_DURATION = 450;
const ICON_TRANSITION_TIME = ANIMATION_DURATION / 2;

export const OnboardingChecklist = () => {
  const bonusPrompts = useAtomValue(bonusPromptsAtom);
  const showOnboardingChecklist = useAtomValue(onboardingChecklistAtom);
  const hideChecklist = useSetAtom(onboardingChecklistAtom);
  const fetchBonusPrompts = useSetAtom(bonusPromptsAtom);

  const watchTutorial = useWatchTutorial();
  const promptAITutorial = usePromptAITutorial();

  const [demoRunning, setDemoRunning] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [showIconOnly, setShowIconOnly] = useState(false);
  const [fixedSize, setFixedSize] = useState<{ width: number; height: number } | null>(null);
  const [animationTransform, setAnimationTransform] = useState<{
    translateX: number;
    translateY: number;
    scale: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch bonus prompts on mount
  useEffect(() => {
    fetchBonusPrompts({ type: 'fetch' });
  }, [fetchBonusPrompts]);

  const handleItemClick = useCallback(
    (category: string, repeat: boolean) => {
      switch (category) {
        case 'prompt-ai':
          setDemoRunning(true);
          promptAITutorial(repeat);
          break;
        case 'demo-connection':
          setDemoRunning(true);
          console.log('TODO');
          break;
        case 'watch-tutorial':
          setDemoRunning(true);
          watchTutorial(repeat);
          break;
        default:
          console.warn(`Unknown category: ${category}`);
      }
    },
    [promptAITutorial, watchTutorial]
  );

  const handleClose = useCallback(() => {
    if (demoRunning) {
      events.emit('tutorialTrigger', 'cancel');
      return;
    }

    if (!containerRef.current) return;

    // Capture the current size and calculate transform values before starting animation
    const rect = containerRef.current.getBoundingClientRect();
    setFixedSize({ width: rect.width, height: rect.height });

    // Calculate transform values once
    const trigger = document.getElementById('onboarding-checklist-trigger');
    if (trigger) {
      const triggerRect = trigger.getBoundingClientRect();

      // Calculate the center of both elements
      const containerCenterX = rect.left + rect.width / 2;
      const containerCenterY = rect.top + rect.height / 2;
      const triggerCenterX = triggerRect.left + triggerRect.width / 2;
      const triggerCenterY = triggerRect.top + triggerRect.height / 2;

      // Calculate translation needed to move container center to trigger center
      const translateX = triggerCenterX - containerCenterX;
      const translateY = triggerCenterY - containerCenterY;

      // Scale down to button size (36px)
      const currentSize = Math.max(rect.width, rect.height);
      const targetSize = 36;
      const scale = targetSize / currentSize;

      setAnimationTransform({ translateX, translateY, scale });
    }

    // Start the animation
    setIsAnimatingOut(true);

    // After halfway point, switch to showing just the icon
    setTimeout(() => {
      setShowIconOnly(true);
    }, ICON_TRANSITION_TIME);

    // After animation completes, actually hide the checklist
    setTimeout(() => {
      hideChecklist('dismiss');
      setIsAnimatingOut(false);
      setShowIconOnly(false);
      setFixedSize(null);
      setAnimationTransform(null);
    }, ANIMATION_DURATION);
  }, [demoRunning, hideChecklist]);

  if (!showOnboardingChecklist || !bonusPrompts) {
    return null;
  }

  // Use stored animation transform values (calculated once at start of animation)
  const { translateX = 0, translateY = 0, scale = 1 } = animationTransform || {};

  const completedCount = bonusPrompts.filter((prompt) => prompt.received).length;
  const totalCount = bonusPrompts.length;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-[65px] right-2 z-[9999] rounded-lg border bg-background shadow-sm"
      style={{
        transform: isAnimatingOut ? `translate(${translateX}px, ${translateY}px) scale(${scale})` : 'none',
        transition: isAnimatingOut ? `transform ${ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
        overflow: 'hidden',
        width: fixedSize ? `${fixedSize.width}px` : 'auto',
        height: fixedSize ? `${fixedSize.height}px` : 'auto',
      }}
    >
      {showIconOnly ? (
        // Show just the icon during the final stage of animation - fill entire container
        <div className="flex h-full w-full items-center justify-center rounded bg-border text-muted-foreground">
          <EducationIcon />
        </div>
      ) : (
        // Show full content
        <div className="p-6">
          {/* Header */}
          <div className="mb-2 flex items-start justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <div>Onboarding checklist</div>
              <div className="text-sm text-muted-foreground">
                {completedCount}/{totalCount}
              </div>
            </h2>
            <Button
              id="onboarding-checklist-close"
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <Cross2Icon className="h-4 w-4" />
            </Button>
          </div>

          {/* Subtitle */}
          <p className="mb-4 text-sm text-muted-foreground">Complete tasks to earn free prompts.</p>

          {/* Checklist items */}
          <div className="space-y-1">
            {bonusPrompts.map((prompt) => (
              <div
                id={`onboarding-checklist-item-${prompt.category}`}
                key={prompt.category}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-muted/50"
                onClick={() => handleItemClick(prompt.category, prompt.received)}
              >
                {/* Checkmark circle */}
                <div
                  className={cn(
                    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full',
                    prompt.received ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-muted'
                  )}
                >
                  {prompt.received && <CheckIcon className="h-4 w-4" />}
                </div>

                {/* Task name */}
                <span className={cn('flex-1 text-sm', prompt.received && 'text-muted-foreground line-through')}>
                  {prompt.name}
                </span>

                {/* Badge */}
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    prompt.received
                      ? 'border-blue-600 bg-white text-blue-600 dark:bg-white dark:text-blue-600'
                      : 'border-blue-600 bg-blue-600 text-white'
                  )}
                >
                  Earn{prompt.received ? 'ed' : ''} {prompt.prompts} prompt{prompt.prompts !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
