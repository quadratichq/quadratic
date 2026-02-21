import { waitingOnMessageIndexAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { editorInteractionStateCanManageAIOverageAtom } from '@/app/atoms/editorInteractionStateAtom';
import { showOverageDialog } from '@/shared/atom/overageDialogAtom';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { getNextPlanSuggestion, teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtomValue, useSetAtom } from 'jotai';
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIUsageExceeded = memo(() => {
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);
  const setWaitingOnMessageIndex = useSetAtom(waitingOnMessageIndexAtom);
  const { planType, allowOveragePayments, teamMonthlyBudgetLimit } = useAtomValue(teamBillingAtom);
  const canManageAIOverage = useRecoilValue(editorInteractionStateCanManageAIOverageAtom);

  const suggestion = useMemo(
    () => getNextPlanSuggestion(planType, allowOveragePayments),
    [planType, allowOveragePayments]
  );

  // Track the initial billing state when this component first mounts (i.e., when
  // the billing limit was hit). If the billing state later changes — plan upgrade,
  // overage toggle, or budget limit increase — clear the waiting state so the user
  // can resume using AI.
  const initialBillingRef = useRef({ suggestion, teamMonthlyBudgetLimit });
  useEffect(() => {
    const initial = initialBillingRef.current;
    if (initial.suggestion === suggestion && initial.teamMonthlyBudgetLimit === teamMonthlyBudgetLimit) return;

    setWaitingOnMessageIndex(undefined);
  }, [suggestion, teamMonthlyBudgetLimit, setWaitingOnMessageIndex]);

  const { title, description, buttonText } = useMemo(() => {
    if (!suggestion) {
      return {
        title: 'Team monthly AI allowance exceeded',
        description: 'Your team has reached its AI spending limit. Adjust your budget in team settings.',
        buttonText: 'Increase overage limit',
      };
    }

    if (suggestion.type === 'enableOverage') {
      if (canManageAIOverage) {
        return {
          title: 'Team monthly AI allowance exceeded',
          description: 'Enable on-demand usage in team settings to continue using Quadratic AI.',
          buttonText: 'Enable team overage',
        };
      }
      return {
        title: 'Team monthly AI allowance exceeded',
        description: 'Ask a team editor or owner to enable on-demand usage, or view usage in team settings.',
        buttonText: 'View usage',
      };
    }

    const targetPlan = suggestion.targetPlan;
    if (targetPlan === 'PRO') {
      return {
        title: 'Monthly AI free tier exceeded',
        description: 'Upgrade to continue using Quadratic AI.',
        buttonText: 'Upgrade',
      };
    } else {
      return {
        title: 'Monthly AI allowance exceeded',
        description: 'Upgrade to a Business plan for more AI usage and on-demand billing.',
        buttonText: 'Upgrade to Business',
      };
    }
  }, [suggestion, canManageAIOverage]);

  const handleClick = useCallback(() => {
    trackEvent('[AI].UsageExceeded.clickUpgrade', { planType, suggestion: suggestion?.type ?? 'none' });

    // No suggestion (Business + overage with budget hit): open overage dialog
    if (!suggestion) {
      showOverageDialog();
      return;
    }

    // For enableOverage suggestions, open the overage dialog
    if (suggestion.type === 'enableOverage') {
      trackEvent('[UpgradeDialog].enableOverageClicked');
      showOverageDialog();
      return;
    }

    // For upgrade suggestions (Pro or Business), open the upgrade dialog
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

      <Button onClick={handleClick} className="mx-auto mt-2 w-full max-w-xs" size="sm">
        {buttonText}
      </Button>
    </div>
  );
});
