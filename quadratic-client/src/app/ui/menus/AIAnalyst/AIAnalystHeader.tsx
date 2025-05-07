import { Action } from '@/app/actions/actions';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';
import {
  aiAnalystChatsCountAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatUserMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystShowChatHistoryAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import env from '@/env';
import { AddIcon, CloseIcon, HistoryIcon } from '@/shared/components/Icons';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import mixpanel from 'mixpanel-browser';
import { memo, useMemo } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

type AIAnalystHeaderProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

export const AIAnalystHeader = memo(({ textareaRef }: AIAnalystHeaderProps) => {
  const [showChatHistory, setShowChatHistory] = useRecoilState(aiAnalystShowChatHistoryAtom);
  const chatsCount = useRecoilValue(aiAnalystChatsCountAtom);
  const setCurrentChat = useSetRecoilState(aiAnalystCurrentChatAtom);
  const currentUserMessages = useRecoilValue(aiAnalystCurrentChatUserMessagesCountAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const [numberOfTimesHistoryHasBeenClicked, setNumberOfTimesHistoryHasBeenClicked] = useLocalStorage(
    'aiAnalystHistoryClicksCount',
    0
  );

  const showStartFreshMsg = useMemo(
    () => currentUserMessages >= env.AI_ANALYST_START_NEW_CHAT_MSG_THRESHOLD && !showChatHistory,
    [currentUserMessages, showChatHistory]
  );
  const showHistoryMsg = useMemo(
    () =>
      numberOfTimesHistoryHasBeenClicked < 15 &&
      currentUserMessages === 0 &&
      !showChatHistory &&
      !loading &&
      chatsCount > 0,
    [numberOfTimesHistoryHasBeenClicked, currentUserMessages, showChatHistory, loading, chatsCount]
  );

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
              variant={showStartFreshMsg ? 'outline' : 'ghost'}
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              disabled={loading || currentUserMessages === 0}
              onClick={() => {
                mixpanel.track('[AIAnalyst].startNewChat', { messageCount: currentUserMessages });
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
              variant={showChatHistory ? 'default' : showHistoryMsg ? 'outline' : 'ghost'}
              size="icon-sm"
              className={cn(!showChatHistory && 'text-muted-foreground hover:text-foreground')}
              disabled={!showChatHistory && (loading || chatsCount === 0)}
              onClick={() => {
                setShowChatHistory((prev) => !prev);
                setNumberOfTimesHistoryHasBeenClicked((prev) => prev + 1);
              }}
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
      {showStartFreshMsg && (
        <SubheaderMessage caretPosFromRight={86}>Long chat? New topic? Fresh chats = better results.</SubheaderMessage>
      )}
      {showHistoryMsg && (
        <SubheaderMessage caretPosFromRight={49}>Previous chats are saved in history.</SubheaderMessage>
      )}
    </div>
  );
});

function SubheaderMessage({ children, caretPosFromRight }: { children: React.ReactNode; caretPosFromRight: number }) {
  return (
    <p className="relative mx-2 mb-1.5 rounded border border-border bg-background px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">
      {children}
      <span
        className={`absolute -top-[8px] h-0 w-0 border-b-8 border-l-8 border-r-8 border-b-border border-l-transparent border-r-transparent`}
        style={{ right: `${caretPosFromRight}px` }}
      />
      <span
        className={`absolute -top-[6px] h-0 w-0 border-b-8 border-l-8 border-r-8 border-b-background border-l-transparent border-r-transparent`}
        style={{ right: `${caretPosFromRight}px` }}
      />
    </p>
  );
}
