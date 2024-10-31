import {
  aiAnalystChatsCountAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { AddIcon, CloseIcon, HistoryIcon } from '@/shared/components/Icons';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

type AIAnalystHeaderProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export function AIAnalystHeader({ textareaRef }: AIAnalystHeaderProps) {
  const [showChatHistory, setShowChatHistory] = useRecoilState(aiAnalystShowChatHistoryAtom);
  const chatsCount = useRecoilValue(aiAnalystChatsCountAtom);
  const setCurrentChat = useSetRecoilState(aiAnalystCurrentChatAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  return (
    <div className="flex items-center justify-between p-3">
      <span className="flex items-center text-sm font-bold">
        {showChatHistory ? (
          'Chat history'
        ) : (
          <>
            Chat
            <Badge variant="outline" className="ml-2">
              Experimental
            </Badge>
          </>
        )}
      </span>

      <div className="flex items-center gap-2">
        <TooltipPopover label="Previous chats">
          <Button
            variant={showChatHistory ? 'default' : 'ghost'}
            size="icon-sm"
            className={cn(!showChatHistory && 'text-muted-foreground hover:text-foreground')}
            disabled={!showChatHistory && (loading || chatsCount === 0)}
            onClick={() => setShowChatHistory((prev) => !prev)}
          >
            <HistoryIcon />
          </Button>
        </TooltipPopover>

        <TooltipPopover label="New chat">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            disabled={loading || messagesCount === 0}
            onClick={() => {
              setCurrentChat({
                id: '',
                name: '',
                lastUpdated: Date.now(),
                messages: [],
              });
              textareaRef.current?.focus();
            }}
          >
            <AddIcon />
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
