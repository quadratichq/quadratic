import { editorInteractionStateCanManageBillingAtom } from '@/app/atoms/editorInteractionStateAtom';
import { showSettingsDialog } from '@/shared/atom/settingsDialogAtom';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { getNextPlanSuggestion, teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtomValue, useSetAtom } from 'jotai';
import { memo, useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const AIUsageExceeded = memo(() => {
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);
  const { planType, allowOveragePayments } = useAtomValue(teamBillingAtom);
  const canManageBilling = useRecoilValue(editorInteractionStateCanManageBillingAtom);

  const suggestion = useMemo(
    () => getNextPlanSuggestion(planType, allowOveragePayments),
    [planType, allowOveragePayments]
  );

  const { title, description, buttonText } = useMemo(() => {
    if (!suggestion) {
      return {
        title: 'Monthly AI limit reached',
        description: 'You have reached your AI usage limit for this month.',
        buttonText: 'View usage',
      };
    }

    if (suggestion.type === 'enableOverage') {
      if (canManageBilling) {
        return {
          title: 'Team monthly AI allowance exceeded',
          description: 'Enable on-demand usage in team settings to continue using Quadratic AI.',
          buttonText: 'Increase overage limit',
        };
      }
      return {
        title: 'Team monthly AI allowance exceeded',
        description: 'Ask your team owner to enable on-demand usage, or view usage in team settings.',
        buttonText: 'View usage',
      };
    }

    const targetPlan = suggestion.targetPlan;
    if (targetPlan === 'PRO') {
      return {
        title: 'Monthly AI free tier exceeded',
        description: 'Upgrade to a Pro plan to continue using Quadratic AI.',
        buttonText: 'Upgrade to Pro',
      };
    } else {
      return {
        title: 'Monthly AI allowance exceeded',
        description: 'Upgrade to a Business plan for more AI usage and on-demand billing.',
        buttonText: 'Upgrade to Business',
      };
    }
  }, [suggestion, canManageBilling]);

  const handleClick = useCallback(() => {
    trackEvent('[AI].UsageExceeded.clickUpgrade', { planType, suggestion: suggestion?.type ?? 'none' });

    // For enableOverage suggestions, open the settings dialog with team billing tab and highlight
    if (suggestion?.type === 'enableOverage') {
      trackEvent('[UpgradeDialog].enableOverageClicked');
      showSettingsDialog('team', { highlightOverage: true });
      return;
    }

    // For other suggestions, open the upgrade dialog
    setShowUpgradeDialog({ open: true, eventSource: 'AIUsageExceeded', suggestion });
  }, [planType, suggestion, setShowUpgradeDialog]);

  return (
    <div
      className={
        'mx-2 my-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-center text-sm dark:border-yellow-800 dark:bg-yellow-950/50'
      }
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>

      <Button onClick={handleClick} className="mt-2 w-full" size="sm">
        {buttonText}
      </Button>
    </div>
  );
});
