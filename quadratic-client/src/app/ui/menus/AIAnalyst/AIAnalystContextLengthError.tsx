import { aiAnalystCurrentChatAtom } from '@/app/atoms/aiAnalystAtom';
import { WarningIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { memo, useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

interface AIAnalystContextLengthErrorProps {
  message: string;
}

export const AIAnalystContextLengthError = memo(({ message }: AIAnalystContextLengthErrorProps) => {
  const setCurrentChat = useSetRecoilState(aiAnalystCurrentChatAtom);

  const handleNewChatClick = useCallback(() => {
    trackEvent('[AI].contextLengthErrorNewChat');
    setCurrentChat({
      id: '',
      name: '',
      lastUpdated: Date.now(),
      messages: [],
    });
  }, [setCurrentChat]);

  return (
    <div className="-mx-2 flex min-w-0 select-none flex-col gap-2 rounded border border-border p-3 text-sm">
      <div className="flex items-center gap-2">
        <WarningIcon className="shrink-0" />
        <span className="font-medium">{message}</span>
      </div>

      <p className="text-muted-foreground">
        Starting a new chat will clear the conversation history and free up space for the AI to respond.
      </p>

      <div className="mt-1">
        <Button size="sm" variant="default" onClick={handleNewChatClick}>
          Start a new chat
        </Button>
      </div>
    </div>
  );
});
