import {
  aiAnalystLoadingAtom,
  aiAnalystMessagesAtom,
  aiAnalystMessagesCountAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { BackspaceIcon, CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { useRecoilValue, useSetRecoilState } from 'recoil';

export function AIAnalystHeader() {
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const setMessages = useSetRecoilState(aiAnalystMessagesAtom);
  const messagesCount = useRecoilValue(aiAnalystMessagesCountAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  return (
    <div className="flex items-center justify-between p-2">
      <span className="text-sm font-bold">Chat</span>

      <div className="flex items-center gap-2">
        <TooltipPopover label="Clear chat" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            disabled={loading || messagesCount === 0}
            onClick={() => setMessages([])}
          >
            <BackspaceIcon />
          </Button>
        </TooltipPopover>

        <TooltipPopover label="Close" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            disabled={loading}
            onClick={() => setShowAIAnalyst(false)}
          >
            <CloseIcon />
          </Button>
        </TooltipPopover>
      </div>
    </div>
  );
}
