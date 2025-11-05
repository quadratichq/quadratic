import { bonusPromptsAtom, onboardingChecklistAtom } from '@/app/atoms/bonusPromptsAtom';
import { events } from '@/app/events/events';
import { usePromptAITutorial } from '@/app/onboarding/usePromptAITutorial';
import { useWatchTutorial } from '@/app/onboarding/useWatchTutorial';
import { useAnimateOnboarding } from '@/app/ui/hooks/useAnimateOnboarding';
import { EducationIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

export const OnboardingChecklist = () => {
  const bonusPrompts = useAtomValue(bonusPromptsAtom);
  const showOnboardingChecklist = useAtomValue(onboardingChecklistAtom);
  const fetchBonusPrompts = useSetAtom(bonusPromptsAtom);

  const watchTutorial = useWatchTutorial();
  const promptAITutorial = usePromptAITutorial();

  const [demoRunning, setDemoRunning] = useState(false);

  // Use the animation hook to handle all animation logic
  const {
    containerRef,
    currentTransform,
    isInitialized,
    showIconOnly,
    showTransform,
    handleClose: handleAnimationClose,
  } = useAnimateOnboarding(showOnboardingChecklist, demoRunning);

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

    handleAnimationClose();
  }, [demoRunning, handleAnimationClose]);

  // Listen for close event from trigger button
  useEffect(() => {
    const handler = () => {
      handleClose();
    };
    events.on('onboardingChecklistClose', handler);
    return () => {
      events.off('onboardingChecklistClose', handler);
    };
  }, [handleClose]);

  if (!showOnboardingChecklist || !bonusPrompts) {
    return null;
  }

  const completedCount = bonusPrompts.filter((prompt) => prompt.received).length;
  const totalCount = bonusPrompts.length;

  const { translateX, translateY, scale, width, height } = currentTransform;

  return (
    <div
      ref={containerRef}
      className="fixed bottom-[65px] right-2 overflow-hidden rounded-lg border bg-background shadow-sm"
      style={{
        transform: showTransform ? `translate(${translateX}px, ${translateY}px) scale(${scale})` : 'none',
        transformOrigin: 'center center',
        width: isInitialized && width > 0 ? `${width}px` : 'auto',
        height: isInitialized && height > 0 ? `${height}px` : 'auto',
        opacity: isInitialized ? 1 : 0,
        pointerEvents: isInitialized ? 'auto' : 'none',
      }}
    >
      {showIconOnly ? (
        // Show just the icon during the final stage of animation - fill entire container
        <div className="flex h-full w-full items-center justify-center rounded bg-border text-muted-foreground">
          <div
            style={{
              transform: scale < 1 ? `scale(${1 / scale})` : 'none',
              transformOrigin: 'center center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EducationIcon />
          </div>
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
