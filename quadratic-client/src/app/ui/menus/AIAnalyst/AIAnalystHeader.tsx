import { Action } from '@/app/actions/actions';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import {
  aiAnalystChatsCountAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatUserMessagesCountAtom,
  aiAnalystLoadingAtom,
  aiAnalystShowChatHistoryAtom,
  aiAnalystWaitingOnMessageIndexAtom,
  showAIAnalystAtom,
} from '@/app/atoms/aiAnalystAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { AIAnalystDebugChatInput } from '@/app/ui/menus/AIAnalyst/AIAnalystDebugChatInput';
import { AddIcon, CloseIcon, FastForwardIcon, HistoryIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { aiToolsSpec, type AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useMemo } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

type AIAnalystHeaderProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

const THRESHOLD = import.meta.env.VITE_AI_ANALYST_START_NEW_CHAT_MSG_THRESHOLD
  ? parseInt(import.meta.env.VITE_AI_ANALYST_START_NEW_CHAT_MSG_THRESHOLD || '15', 10)
  : 15;

export const AIAnalystHeader = memo(({ textareaRef }: AIAnalystHeaderProps) => {
  const { debugFlags } = useDebugFlags();
  const debugAIAnalystChatEditing = useMemo(
    () => (debugFlags.getFlag('debugAIAnalystChatEditing') ? true : undefined),
    [debugFlags]
  );

  const [showChatHistory, setShowChatHistory] = useRecoilState(aiAnalystShowChatHistoryAtom);
  const chatsCount = useRecoilValue(aiAnalystChatsCountAtom);
  const setCurrentChat = useSetRecoilState(aiAnalystCurrentChatAtom);
  const setWaitingOnMessageIndex = useSetRecoilState(aiAnalystWaitingOnMessageIndexAtom);
  const currentUserMessagesCount = useRecoilValue(aiAnalystCurrentChatUserMessagesCountAtom);
  const setShowAIAnalyst = useSetRecoilState(showAIAnalystAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  const showStartFreshMsg = useMemo(
    () => currentUserMessagesCount >= THRESHOLD && !showChatHistory,
    [currentUserMessagesCount, showChatHistory]
  );
  const showHistoryMsg = useMemo(
    () => currentUserMessagesCount === 0 && !showChatHistory && !loading && chatsCount > 0,
    [currentUserMessagesCount, showChatHistory, loading, chatsCount]
  );

  const handleExecuteAllToolCalls = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const currentChat = await snapshot.getPromise(aiAnalystCurrentChatAtom);
        for (const message of currentChat.messages) {
          if ('toolCalls' in message) {
            for (const toolCall of message.toolCalls) {
              try {
                const args = toolCall.arguments ? JSON.parse(toolCall.arguments) : {};
                aiToolsSpec[toolCall.name as AITool].responseSchema.parse(args);
                const result = await aiToolsActions[toolCall.name as AITool](args, {
                  source: 'AIAnalyst',
                  chatId: '',
                  messageIndex: -1,
                });
                console.log(result);
              } catch (error) {
                console.error(error);
              }
            }
          }
        }
      },
    []
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="flex items-center text-sm font-bold">
          {viewActionsSpec[Action.ToggleAIAnalyst].label()}
          {showChatHistory && ' history'}
        </span>

        <div className="flex items-center gap-2">
          {debugAIAnalystChatEditing && (
            <TooltipPopover label="Execute all tool calls">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                disabled={loading || (currentUserMessagesCount === 0 && !showChatHistory)}
                onClick={handleExecuteAllToolCalls}
              >
                <FastForwardIcon />
              </Button>
            </TooltipPopover>
          )}

          <TooltipPopover label="New chat">
            <Button
              variant={showStartFreshMsg ? 'outline' : 'ghost'}
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              disabled={loading || (currentUserMessagesCount === 0 && !showChatHistory)}
              onClick={() => {
                trackEvent('[AIAnalyst].startNewChat', { messageCount: currentUserMessagesCount });
                setCurrentChat({
                  id: '',
                  name: '',
                  lastUpdated: Date.now(),
                  messages: [],
                });
                setWaitingOnMessageIndex(undefined);
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

      <AIAnalystDebugChatInput />
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
