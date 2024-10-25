import { aiAssistantMessagesAtom } from '@/app/atoms/codeEditorAtom';
import { debugShowAIAssistantInternalContext } from '@/app/debugFlags';
import { colors } from '@/app/theme/colors';
import { AICodeBlockParser } from '@/app/ui/menus/CodeEditor/AIAssistant/AICodeBlockParser';
import { EditIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

export function AIAssistantMessages() {
  const messages = useRecoilValue(aiAssistantMessagesAtom);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    setDiv(node);
    node?.scrollTo({
      top: node.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const handleScroll = useCallback(() => {
    if (!div) return;
    const isScrolledToBottom = div.scrollHeight - div.scrollTop === div.clientHeight;
    setShouldAutoScroll(isScrolledToBottom);
  }, [div]);

  const scrollToBottom = useCallback(() => {
    if (!shouldAutoScroll || !div) return;
    div.scrollTo({
      top: div.scrollHeight,
      behavior: 'smooth',
    });
  }, [div, shouldAutoScroll]);
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <div
      ref={ref}
      className="select-text overflow-y-auto whitespace-pre-wrap px-2 text-sm outline-none"
      spellCheck={false}
      onKeyDown={(e) => {
        if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
          // Allow a few commands, but nothing else
        } else {
          e.preventDefault();
        }
      }}
      onScroll={handleScroll}
      // Disable Grammarly
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
    >
      {messages.map((message, index) => {
        if (!debugShowAIAssistantInternalContext && message.contextType !== 'userPrompt') {
          return null;
        }

        return (
          <div
            key={`${index}-${message.role}-${message.contextType}`}
            className={cn('group relative my-4', message.role === 'user' && 'rounded bg-accent px-2 py-2')}
            // For debugging internal context
            style={{
              ...(message.contextType !== 'userPrompt' ? { backgroundColor: colors.lightGray } : {}),
            }}
          >
            {/* TODO: Edit button for user messages */}
            {message.role === 'user' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-2 top-1 hidden text-muted-foreground group-hover:flex"
                  >
                    <EditIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edit prompt</TooltipContent>
              </Tooltip>
            )}

            {Array.isArray(message.content) ? (
              message.content.map((messageContent) => (
                <AICodeBlockParser key={messageContent.content} input={messageContent.content} />
              ))
            ) : (
              <AICodeBlockParser input={message.content} />
            )}
          </div>
        );
      })}
    </div>
  );
}
