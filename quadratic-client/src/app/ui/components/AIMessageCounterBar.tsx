import { useAIUsage } from '@/app/ui/hooks/useAIUsage';
import { useIsOnPaidPlan } from '@/app/ui/hooks/useIsOnPaidPlan';
import { memo } from 'react';

interface AIMessageCounterBarProps {
  messageIndex?: number;
  showEmptyChatPromptSuggestions?: boolean;
}

export const AIMessageCounterBar = memo(
  ({ messageIndex = 0, showEmptyChatPromptSuggestions = false }: AIMessageCounterBarProps) => {
    const { isOnPaidPlan } = useIsOnPaidPlan();
    const { data, messagesRemaining } = useAIUsage();

    // Only show for free plans, when we have usage data, and NOT in initial/empty chat state
    if (isOnPaidPlan || !data || messagesRemaining === null || (showEmptyChatPromptSuggestions && messageIndex === 0)) {
      return null;
    }

    const handleUpgradeClick = () => {
      window.open('/team/settings', '_blank');
    };

    return (
      <div className="flex items-center justify-between px-2 py-1 text-xs text-muted-foreground">
        <span>
          {messagesRemaining} message{messagesRemaining !== 1 ? 's' : ''} left on your Free plan.
        </span>
        <button onClick={handleUpgradeClick} className="text-blue-600 hover:text-blue-800 hover:underline">
          Upgrade now
        </button>
      </div>
    );
  }
);
