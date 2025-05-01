import { Action } from '@/app/actions/actions';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';
import {
  aiAnalystChatsCountAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { AddIcon, CloseIcon, HistoryIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { memo } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

type AIAnalystHeaderProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

export const AIAnalystHeader = memo(({ textareaRef }: AIAnalystHeaderProps) => {
  const [showChatHistory, setShowChatHistory] = useRecoilState(aiAnalystShowChatHistoryAtom);
  const chatsCount = useRecoilValue(aiAnalystChatsCountAtom);
  const setCurrentChat = useSetRecoilState(aiAnalystCurrentChatAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  // TODO: decide on the right threshold
  const highlightStartFresh = messagesCount > 2 && !showChatHistory;
  const highlightHistory = messagesCount === 0 && !showChatHistory && !loading && chatsCount > 0;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="flex items-center text-sm font-bold">
          {viewActionsSpec[Action.ToggleAIAnalyst].label()}
          {showChatHistory && ' history'}
        </span>

        <div className="flex items-center gap-2">
          <TooltipPopover label="New chat">
            <Button
              variant={highlightStartFresh ? 'outline' : 'ghost'}
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

          <TooltipPopover label="Previous chats">
            <Button
              variant={showChatHistory ? 'default' : highlightHistory ? 'outline' : 'ghost'}
              size="icon-sm"
              className={cn(!showChatHistory && 'text-muted-foreground hover:text-foreground')}
              disabled={!showChatHistory && (loading || chatsCount === 0)}
              onClick={() => setShowChatHistory((prev) => !prev)}
            >
              <HistoryIcon />
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
      {highlightStartFresh && (
        <p className="relative mx-2 mb-1.5 rounded bg-primary px-2 py-1.5 text-center text-xs text-background">
          Fresh chats = better results. Try starting anew.
          <span className="absolute -top-2 right-[86px] h-0 w-0 border-b-8 border-l-8 border-r-8 border-b-primary border-l-transparent border-r-transparent" />
        </p>
      )}
      {highlightHistory && (
        <p className="relative mx-2 mb-1.5 rounded bg-secondary px-2 py-1.5 text-center text-xs text-muted-foreground">
          Previous chats are saved in history.
          <span className="absolute -top-2 right-[50px] h-0 w-0 border-b-8 border-l-8 border-r-8 border-b-secondary border-l-transparent border-r-transparent" />
        </p>
      )}
    </div>
  );
});
