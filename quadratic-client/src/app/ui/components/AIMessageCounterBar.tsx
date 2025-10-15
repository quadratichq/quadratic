import { useAIUsage } from '@/app/ui/hooks/useAIUsage';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { memo } from 'react';
import { Link } from 'react-router';

export const AIMessageCounterBar = memo(() => {
  const { isOnPaidPlan } = useIsOnPaidPlan();
  const { data, messagesRemaining } = useAIUsage();
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();

  // Only show for free plans, when we have usage data, and NOT in initial/empty chat state
  if (isOnPaidPlan || !data || messagesRemaining === null) {
    return null;
  }

  return (
    <div className="pt-1 text-center text-xs text-muted-foreground">
      {messagesRemaining} message{messagesRemaining !== 1 ? 's' : ''} left on your Free plan.{' '}
      <Link to={ROUTES.TEAM_BILLING(teamUuid)} className="text-blue-600 hover:text-blue-800 hover:underline">
        Upgrade now
      </Link>
      .
    </div>
  );
});
