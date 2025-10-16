import { useAIMessagesLeft } from '@/app/ui/hooks/useAIMessagesLeft';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { memo } from 'react';
import { Link } from 'react-router';

export const AIMessageCounterBar = memo(() => {
  const { isOnPaidPlan } = useIsOnPaidPlan();

  // Don't even bother mounting the component below (and fetching its data)
  // if the user is on a paid plan
  return isOnPaidPlan ? null : <Component />;
});

const Component = () => {
  const messagesRemaining = useAIMessagesLeft();
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();

  // Display a dash if we don't have usage data yet
  const messagesLeftDisplay = messagesRemaining === null ? '-' : messagesRemaining;

  return (
    <div className="pt-1 text-center text-xs text-muted-foreground">
      {messagesLeftDisplay} message{messagesRemaining !== 1 ? 's' : ''} left on your plan.{' '}
      <Link to={ROUTES.TEAM_BILLING(teamUuid)} className="text-blue-600 hover:text-blue-800 hover:underline">
        Upgrade now
      </Link>
      .
    </div>
  );
};
