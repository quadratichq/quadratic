import { bonusPromptsAtom, onboardingChecklistAtom } from '@/app/atoms/bonusPromptsAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { cn } from '@/shared/shadcn/utils';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect } from 'react';

export const OnboardingChecklist = () => {
  const bonusPrompts = useAtomValue(bonusPromptsAtom);
  const showOnboardingChecklist = useAtomValue(onboardingChecklistAtom);
  const hideChecklist = useSetAtom(onboardingChecklistAtom);
  const fetchBonusPrompts = useSetAtom(bonusPromptsAtom);

  // Fetch bonus prompts on mount
  useEffect(() => {
    fetchBonusPrompts({ type: 'fetch' });
  }, [fetchBonusPrompts]);

  console.log({ showOnboardingChecklist, bonusPrompts });
  if (!showOnboardingChecklist || !bonusPrompts) {
    return null;
  }

  const completedCount = bonusPrompts.filter((prompt) => prompt.received).length;
  const totalCount = bonusPrompts.length;

  return (
    <div className="absolute bottom-0 right-0 rounded-lg border bg-background p-6 shadow-sm">
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
      <div className="space-y-2">
        {bonusPrompts.map((prompt) => (
          <div key={prompt.category} className="flex items-center gap-3">
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
            <span className="flex-1 text-sm">{prompt.name}</span>

            {/* Badge */}
            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">
              Earn {prompt.prompts} prompt{prompt.prompts !== 1 ? 's' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
