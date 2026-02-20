import { currentChatAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { editorInteractionStateShowFeedbackMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { HelpIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useSetAtom } from 'jotai';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback } from 'react';
import { useSetRecoilState } from 'recoil';
import { ToolCard } from './ToolCard';

export const ContactUs = memo(({ toolCall: { loading }, className }: { toolCall: AIToolCall; className: string }) => {
  const setShowFeedbackMenu = useSetRecoilState(editorInteractionStateShowFeedbackMenuAtom);
  const setCurrentChat = useSetAtom(currentChatAtom);

  const handleContactClick = useCallback(() => {
    trackEvent('[AI].ContactUsToolContact');
    setShowFeedbackMenu(true);
  }, [setShowFeedbackMenu]);

  const handleNewChatClick = useCallback(() => {
    trackEvent('[AI].contactUsToolNewChat');
    setCurrentChat({
      id: '',
      name: '',
      lastUpdated: Date.now(),
      messages: [],
    });
  }, [setCurrentChat]);

  const icon = <HelpIcon />;
  const label = 'Things not working as expected?';

  if (loading) {
    return <ToolCard icon={icon} label={label} isLoading className={className} />;
  }

  return (
    <div
      className={`flex min-w-0 select-none flex-col gap-1 rounded border border-border bg-background p-3 text-sm shadow-sm ${className}`}
    >
      <div className="flex items-center gap-1">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center">{icon}</div>
        <div className="flex-1">
          <div className="font-bold">{label}</div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Tell us what’s wrong and we’ll get in touch. Or, consider starting fresh with AI.
      </p>

      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="default" onClick={handleContactClick}>
          Contact us
        </Button>
        <Button size="sm" variant="outline" onClick={handleNewChatClick}>
          Start a new chat
        </Button>
      </div>
    </div>
  );
});
