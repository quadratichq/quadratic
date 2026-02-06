import { Action } from '@/app/actions/actions';
import { viewActionsSpec } from '@/app/actions/viewActionsSpec';
import {
  aiStore,
  chatsCountAtom,
  currentChatAtom,
  currentChatNameAtom,
  currentChatUserMessagesCountAtom,
  loadingAtom,
  showAIAnalystWithEffectsAtom,
  showChatHistoryAtom,
  waitingOnMessageIndexAtom,
} from '@/app/ai/atoms/aiAnalystAtoms';
import { aiToolsActions } from '@/app/ai/tools/aiToolsActions';
import { agentModeAtom } from '@/app/atoms/agentModeAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { AIAnalystDebugChatInput } from '@/app/ui/menus/AIAnalyst/AIAnalystDebugChatInput';
import { AddIcon, CloseIcon, FastForwardIcon, HistoryIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { aiToolsSpec, type AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

interface AIAnalystHeaderProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}
export const AIAnalystHeader = memo(({ textareaRef }: AIAnalystHeaderProps) => {
  const { debugFlags } = useDebugFlags();
  const debugAIAnalystChatEditing = useMemo(
    () => (debugFlags.getFlag('debugAIAnalystChatEditing') ? true : undefined),
    [debugFlags]
  );
  const agentMode = useRecoilValue(agentModeAtom);
  const [showChatHistory, setShowChatHistory] = useAtom(showChatHistoryAtom);
  const chatsCount = useAtomValue(chatsCountAtom);
  const setCurrentChat = useSetAtom(currentChatAtom);
  const setWaitingOnMessageIndex = useSetAtom(waitingOnMessageIndexAtom);
  const currentUserMessagesCount = useAtomValue(currentChatUserMessagesCountAtom);
  const setShowAIAnalyst = useSetAtom(showAIAnalystWithEffectsAtom);
  const loading = useAtomValue(loadingAtom);

  const handleExecuteAllToolCalls = useCallback(async () => {
    const currentChat = aiStore.get(currentChatAtom);
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
  }, []);

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
              variant={'ghost'}
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
              variant={showChatHistory ? 'default' : 'ghost'}
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

      <AIAnalystDebugChatInput />
    </div>
  );
});

function RenamableHeaderTitle({ showChatHistory }: { showChatHistory: boolean }) {
  const currentChat = useAtomValue(currentChatAtom);
  const currentChatName = useAtomValue(currentChatNameAtom);
  const setCurrentChatName = useSetAtom(currentChatNameAtom);
  const [isRenaming, setIsRenaming] = useState(false);
  const escapePressedRef = useRef(false);

  const defaultLabel = useMemo(() => viewActionsSpec[Action.ToggleAIAnalyst].label(), []);

  const headerTitle = useMemo(() => {
    if (showChatHistory) {
      return `Chat history`;
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
