import { Action } from '@/app/actions/actions';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import {
  aiAnalystChatsCountAtom,
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatNameAtom,
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
import { Input } from '@/shared/shadcn/ui/input';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom } from 'jotai';
import { aiToolsSpec, type AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useRecoilCallback, useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

const THRESHOLD = import.meta.env.VITE_AI_ANALYST_START_NEW_CHAT_MSG_THRESHOLD
  ? parseInt(import.meta.env.VITE_AI_ANALYST_START_NEW_CHAT_MSG_THRESHOLD || '15', 10)
  : 15;

interface AIAnalystHeaderProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const AIAnalystHeader = memo(({ textareaRef }: AIAnalystHeaderProps) => {
  const { debugFlags } = useDebugFlags();
  const debugAIAnalystChatEditing = useMemo(
    () => (debugFlags.getFlag('debugAIAnalystChatEditing') ? true : undefined),
    [debugFlags]
  );
  const [agentMode] = useAtom(agentModeAtom);
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
    // TODO: enable this by removing false
    () => false && currentUserMessagesCount === 0 && !showChatHistory && !loading && chatsCount > 0,
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
    <div className="flex w-full flex-col">
      <div className="flex w-full items-center justify-between overflow-hidden px-4 py-2">
        <RenamableHeaderTitle showChatHistory={showChatHistory} />

        <div className="flex shrink-0 items-center gap-2">
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

          {!agentMode && (
            <TooltipPopover label="Close" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                disabled={loading}
                onClick={() => setShowAIAnalyst(false)}
                data-testid="close-ai-analyst"
              >
                <CloseIcon />
              </Button>
            </TooltipPopover>
          )}
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

function RenamableHeaderTitle({ showChatHistory }: { showChatHistory: boolean }) {
  const currentChat = useRecoilValue(aiAnalystCurrentChatAtom);
  const currentChatName = useRecoilValue(aiAnalystCurrentChatNameAtom);
  const setCurrentChatName = useSetRecoilState(aiAnalystCurrentChatNameAtom);
  const [isRenaming, setIsRenaming] = useState(false);
  const escapePressedRef = useRef(false);

  const defaultLabel = useMemo(() => viewActionsSpec[Action.ToggleAIAnalyst].label(), []);

  const headerTitle = useMemo(() => {
    if (showChatHistory) {
      return `${defaultLabel} history`;
    }
    return currentChatName.trim() || defaultLabel;
  }, [showChatHistory, currentChatName, defaultLabel]);

  const canRename = useMemo(() => !showChatHistory && !!currentChat.id, [showChatHistory, currentChat.id]);

  const handleStartRenaming = useCallback(() => {
    if (!canRename) return;
    setIsRenaming(true);
    escapePressedRef.current = false;
  }, [canRename]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsRenaming(false);

      // Don't save if escape was pressed
      if (escapePressedRef.current) {
        escapePressedRef.current = false;
        return;
      }

      const newName = e.target.value.trim();

      // Don't do anything if the name didn't change
      if (newName === currentChatName.trim()) {
        return;
      }

      // Update the chat name
      setCurrentChatName(newName);
    },
    [currentChatName, setCurrentChatName]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      escapePressedRef.current = true;
      e.currentTarget.blur();
    }
  }, []);

  return (
    <div className="w-0 min-w-0 flex-1 pr-2">
      {isRenaming ? (
        <Input
          className="h-auto border-0 px-1 py-0 text-sm font-bold focus-visible:ring-1"
          autoFocus
          defaultValue={currentChatName.trim() || defaultLabel}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          onClick={handleStartRenaming}
          disabled={!canRename}
          className={cn(
            '-mx-1 block max-w-full truncate text-left text-sm font-bold',
            canRename && 'rounded px-1 hover:cursor-pointer hover:bg-accent'
          )}
        >
          {headerTitle}
        </button>
      )}
    </div>
  );
}

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
