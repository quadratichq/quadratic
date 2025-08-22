import { AIToolCard } from '@/app/ai/toolCards/AIToolCard';
import {
  aiAssistantCurrentChatMessagesCountAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
} from '@/app/atoms/codeEditorAtom';
import { useDebugFlags } from '@/app/debugFlags/useDebugFlags';
import { AILoading } from '@/app/ui/components/AILoading';
import { ThinkingBlock } from '@/app/ui/menus/AIAnalyst/AIThinkingBlock';
import { AIAssistantUserMessageForm } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantUserMessageForm';
import { AICodeBlockParser } from '@/app/ui/menus/CodeEditor/AIAssistant/AICodeBlockParser';
import { GoogleSearchSources } from '@/app/ui/menus/CodeEditor/AIAssistant/GoogleSearchSources';
import { cn } from '@/shared/shadcn/utils';
import {
  isContentGoogleSearchInternal,
  isContentThinking,
  isInternalMessage,
  isToolResultMessage,
} from 'quadratic-shared/ai/helpers/message.helper';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

type AIAssistantMessagesProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

export const AIAssistantMessages = memo(({ textareaRef }: AIAssistantMessagesProps) => {
  const { debug, debugFlags } = useDebugFlags();
  const debugShowAIInternalContext = useMemo(() => debugFlags.getFlag('debugShowAIInternalContext'), [debugFlags]);

  const messages = useRecoilValue(aiAssistantMessagesAtom);
  const messagesCount = useRecoilValue(aiAssistantCurrentChatMessagesCountAtom);
  const loading = useRecoilValue(aiAssistantLoadingAtom);
  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    setDiv(node);
    node?.scrollTo({
      top: node.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const shouldAutoScroll = useRef(true);
  const handleScrollEnd = useCallback((e: Event) => {
    const div = e.target as HTMLDivElement;
    const isScrolledToBottom = div.scrollHeight - div.scrollTop <= div.clientHeight;
    shouldAutoScroll.current = isScrolledToBottom;
  }, []);

  useEffect(() => {
    div?.addEventListener('scrollend', handleScrollEnd);
    return () => {
      div?.removeEventListener('scrollend', handleScrollEnd);
    };
  }, [div, handleScrollEnd]);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (force || shouldAutoScroll.current) {
        div?.scrollTo({
          top: div.scrollHeight,
          behavior: 'smooth',
        });
      }
    },
    [div]
  );

  useEffect(() => {
    if (loading) {
      shouldAutoScroll.current = true;
      scrollToBottom(true);
    }
  }, [loading, scrollToBottom]);

  useEffect(() => {
    if (messagesCount === 0) {
      shouldAutoScroll.current = true;
    }
  }, [messagesCount]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  if (messagesCount === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="flex select-text flex-col gap-2 overflow-y-auto whitespace-pre-wrap p-2 text-sm outline-none"
      spellCheck={false}
      onKeyDown={(e) => {
        if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
          // Allow a few commands, but nothing else
        } else {
          e.preventDefault();
        }
      }}
      // Disable Grammarly
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
    >
      {messages.map((message, index) => {
        if (!debugShowAIInternalContext && !['userPrompt', 'webSearchInternal'].includes(message.contextType)) {
          return null;
        }

        const isCurrentMessage = index === messages.length - 1;
        const modelKey = 'modelKey' in message ? message.modelKey : undefined;

        return (
          <div
            key={`${index}-${message.role}-${message.contextType}`}
            className={cn(
              'flex flex-col gap-1',
              message.role === 'assistant' ? 'px-2' : '',
              // For debugging internal context
              ['userPrompt', 'webSearchInternal'].includes(message.contextType) ? '' : 'rounded-lg bg-gray-500 p-2'
            )}
          >
            {debug && !!modelKey && <span className="text-xs text-muted-foreground">{modelKey}</span>}

            {isInternalMessage(message) ? (
              isContentGoogleSearchInternal(message.content) ? (
                <GoogleSearchSources content={message.content} />
              ) : null
            ) : message.role === 'user' && message.contextType === 'userPrompt' ? (
              <AIAssistantUserMessageForm
                initialContent={message.content}
                textareaRef={textareaRef}
                messageIndex={index}
              />
            ) : isToolResultMessage(message) ? (
              message.content.map((result, index) => (
                <AIAssistantUserMessageForm
                  key={`${index}-${result.id}`}
                  initialContent={result.content}
                  textareaRef={textareaRef}
                  messageIndex={index}
                />
              ))
            ) : (
              <>
                {message.content.map((item, contentIndex) =>
                  isContentThinking(item) ? (
                    <ThinkingBlock
                      key={`${index}-${contentIndex}-${item.type}`}
                      isCurrentMessage={isCurrentMessage && contentIndex === message.content.length - 1}
                      isLoading={loading}
                      thinkingContent={item}
                      expandedDefault={false}
                    />
                  ) : item.type === 'text' ? (
                    <AICodeBlockParser key={`${index}-${contentIndex}-${item.type}`} input={item.text} />
                  ) : null
                )}

                {message.contextType === 'userPrompt' &&
                  message.toolCalls.map((toolCall, index) => (
                    <AIToolCard key={`${index}-${toolCall.id}-${toolCall.arguments}`} toolCall={toolCall} />
                  ))}
              </>
            )}
          </div>
        );
      })}

      <div className="px-2 py-2">
        <AILoading loading={loading} />
      </div>
    </div>
  );
});
