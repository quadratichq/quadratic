import { aiAnalystCurrentChatMessagesCountAtom } from '@/app/atoms/aiAnalystAtom';
import { useAIMessagesLeft } from '@/app/ui/hooks/useAIMessagesLeft';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { showUpgradeDialogAtom } from '@/shared/components/UpgradeDialog';
import { memo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export const AIMessageCounterBar = memo(() => {
  const { isOnPaidPlan } = useIsOnPaidPlan();

  // Don't even bother mounting the component below (and fetching its data)
  // if the user is on a paid plan
  return isOnPaidPlan ? null : <Component />;
});

const Component = () => {
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const messagesRemaining = useAIMessagesLeft();
  const setShowUpgradeDialog = useSetRecoilState(showUpgradeDialogAtom);

  // We conditionally render this component here because if we are going to show
  // show it, we want to fetch its data early so its accurate for new users
  // who will see the empty state but not this message (until they submit their
  // first prompt).
  if (messagesCount === 0) {
    return null;
  }

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
