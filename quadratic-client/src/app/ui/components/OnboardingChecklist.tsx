import { bonusPromptsAtom, onboardingChecklistAtom } from '@/app/atoms/bonusPromptsAtom';
import { usePromptAITutorial } from '@/app/onboarding/usePromptAITutorial';
import { useWatchTutorial } from '@/app/onboarding/useWatchTutorial';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect } from 'react';

export const OnboardingChecklist = () => {
  const bonusPrompts = useAtomValue(bonusPromptsAtom);
  const showOnboardingChecklist = useAtomValue(onboardingChecklistAtom);
  const hideChecklist = useSetAtom(onboardingChecklistAtom);
  const fetchBonusPrompts = useSetAtom(bonusPromptsAtom);

  const watchTutorial = useWatchTutorial();
  const promptAITutorial = usePromptAITutorial();

  // Fetch bonus prompts on mount
  useEffect(() => {
    fetchBonusPrompts({ type: 'fetch' });
  }, [fetchBonusPrompts]);

  const handleItemClick = useCallback(
    (category: string, repeat: boolean) => {
      switch (category) {
        case 'prompt-ai':
          promptAITutorial(repeat);
          break;
        case 'demo-connection':
          console.log('TODO');
          break;
        case 'watch-tutorial':
          watchTutorial(repeat);
          break;
        default:
          console.warn(`Unknown category: ${category}`);
      }
    },
    [promptAITutorial, watchTutorial]
  );

  if (!showOnboardingChecklist || !bonusPrompts) {
    return null;
  }

  const completedCount = bonusPrompts.filter((prompt) => prompt.received).length;
  const totalCount = bonusPrompts.length;

  return (
    <div id="onboarding-checklist" className="absolute bottom-0 right-0 rounded-lg border bg-background p-6 shadow-sm">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <div>Onboarding checklist</div>
          <div className="text-sm text-muted-foreground">
            {completedCount}/{totalCount}
          </div>
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => hideChecklist('dismiss')}
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
                prompt.received && prompt.prompts === 1
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
  );
};
