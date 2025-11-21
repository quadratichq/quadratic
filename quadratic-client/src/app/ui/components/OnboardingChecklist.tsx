import { bonusPromptsAtom, onboardingChecklistAtom } from '@/app/atoms/bonusPromptsAtom';
import { events } from '@/app/events/events';
import { usePromptAITutorial } from '@/app/onboarding/usePromptAITutorial';
import { useShareTutorial } from '@/app/onboarding/useShareTutorial';
import { useWatchTutorial } from '@/app/onboarding/useWatchTutorial';
import { OnboardingVideoDialog } from '@/app/ui/components/OnboardingVideoDialog';
import { useAnimateOnboarding } from '@/app/ui/hooks/useAnimateOnboarding';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { CheckBoxEmptyIcon, CheckBoxIcon, ChecklistIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { Progress } from '@/shared/shadcn/ui/progress';
import { cn } from '@/shared/shadcn/utils';
import { Cross2Icon } from '@radix-ui/react-icons';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useState } from 'react';

export const OnboardingChecklist = () => {
  const bonusPrompts = useAtomValue(bonusPromptsAtom);
  const showOnboardingChecklist = useAtomValue(onboardingChecklistAtom);
  const fetchBonusPrompts = useSetAtom(bonusPromptsAtom);
  const { loggedInUser } = useRootRouteLoaderData();
  const {
    team: { isOnPaidPlan },
  } = useFileRouteLoaderData();

  const { startTutorial: watchTutorial, showVideoDialog, closeVideoDialog, completeVideoDialog } = useWatchTutorial();
  const promptAITutorial = usePromptAITutorial();
  const shareTutorial = useShareTutorial();

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
        case 'share-file':
          setDemoRunning(true);
          shareTutorial(repeat);
          break;
        case 'watch-tutorial':
          setDemoRunning(true);
          watchTutorial(repeat);
          break;
        default:
          console.warn(`Unknown category: ${category}`);
      }
    },
    [promptAITutorial, shareTutorial, watchTutorial]
  );

  const handleClose = useCallback(() => {
    if (demoRunning) {
      events.emit('tutorialTrigger', 'cancel');
      return;
    }

    handleAnimationClose();
  }, [demoRunning, handleAnimationClose]);

  useEffect(() => {
    const handleTutorialTrigger = (trigger: string) => {
      if (trigger === 'cancel' || trigger === 'complete') {
        setDemoRunning(false);
      }
    };
    events.on('tutorialTrigger', handleTutorialTrigger);
    return () => {
      events.off('tutorialTrigger', handleTutorialTrigger);
    };
  }, []);

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
    <>
      <div
        ref={containerRef}
        className="fixed bottom-[65px] right-2 overflow-hidden rounded-lg border bg-background shadow-md"
        style={{
          transform: showTransform ? `translate(${translateX}px, ${translateY}px) scale(${scale})` : 'none',
          transformOrigin: 'center center',
          width: showTransform && width > 0 ? `${width}px` : 'auto',
          height: showTransform && height > 0 ? `${height}px` : 'auto',
          opacity: isInitialized ? 1 : 0,
          pointerEvents: isInitialized ? 'auto' : 'none',
          zIndex: 1,
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
              <ChecklistIcon />
            </div>
          </div>
        ) : (
          // Show full content
          <div className="flex flex-col gap-2 p-4">
            {/* Close button */}
            <Button
              id="onboarding-checklist-close"
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <Cross2Icon />
            </Button>

            {/* Content */}
            <div className="mt-2 rounded-md p-2 text-center">
              <div className="relative mx-auto h-16 w-16">
                <Avatar
                  size="large"
                  className="mx-auto !h-16 !w-16"
                  src={loggedInUser?.picture}
                  alt={loggedInUser?.name}
                />
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-background">
                  <ChecklistIcon className="text-primary" />
                </div>
              </div>
              <h2 className="mt-2 text-lg font-semibold">Your onboarding checklist</h2>
              <p className="text-xs text-muted-foreground">
                {completedCount} / {totalCount} tasks complete
              </p>
              <Progress value={(completedCount / totalCount) * 100} className="mx-auto mt-2 h-2 w-3/4" />
            </div>

            {/* Checklist items */}
            <div className="-mx-2">
              {bonusPrompts.map((prompt) => (
                <div
                  id={`onboarding-checklist-item-${prompt.category}`}
                  key={prompt.category}
                  className="flex cursor-pointer items-center rounded-sm px-2 py-2 transition-colors hover:bg-muted/50"
                  onClick={() => handleItemClick(prompt.category, prompt.received)}
                >
                  {/* Checkmark circle */}
                  {prompt.received ? (
                    <CheckBoxIcon className="mr-2 text-primary" />
                  ) : (
                    <CheckBoxEmptyIcon className="mr-2 text-muted-foreground" />
                  )}

                  {/* Task name */}
                  <span
                    className={cn(
                      'flex-1 text-sm font-medium',
                      prompt.received && 'text-muted-foreground line-through'
                    )}
                  >
                    {prompt.name}
                  </span>

                  {/* Badge */}
                  {!isOnPaidPlan && (
                    <Badge
                      variant={!prompt.received ? 'primary' : 'outline'}
                      className={cn('ml-4', prompt.received && 'text-muted-foreground line-through')}
                    >
                      +{prompt.prompts} prompt{prompt.prompts !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showVideoDialog && <OnboardingVideoDialog close={closeVideoDialog} complete={completeVideoDialog} />}
    </>
  );
};
