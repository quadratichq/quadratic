import { useAIMessagesLeft } from '@/app/ui/hooks/useAIMessagesLeft';
import { showUpgradeDialogAtom } from '@/shared/atom/showUpgradeDialogAtom';
import { teamBillingAtom } from '@/shared/atom/teamBillingAtom';
import { useAtomValue, useSetAtom } from 'jotai';
import { memo } from 'react';

export const AIMessageCounterBar = memo(() => {
  const { isOnPaidPlan } = useAtomValue(teamBillingAtom);

  // Don't even bother mounting the component below (and fetching its data)
  // if the user is on a paid plan
  return isOnPaidPlan ? null : <Component />;
});

const Component = () => {
  const messagesRemaining = useAIMessagesLeft();
  const setShowUpgradeDialog = useSetAtom(showUpgradeDialogAtom);

  // Display a dash if we don't have usage data yet
  const messagesLeftDisplay = messagesRemaining === null ? '-' : messagesRemaining;

  return (
    <div className="pt-1 text-center text-xs text-muted-foreground">
      {messagesLeftDisplay} message{messagesRemaining !== 1 ? 's' : ''} left on your Free plan.{' '}
      <button
        className="text-primary hover:underline"
        onClick={() => {
          setShowUpgradeDialog({ open: true, eventSource: 'AIMessageCounterBar' });
        }}
      >
        Upgrade now
      </button>
      .
    </div>
  );
};
