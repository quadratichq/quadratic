import { useAIModel } from '@/app/ai/hooks/useAIModel';
import {
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { editorInteractionStateSettingsAtom } from '@/app/atoms/editorInteractionStateAtom';
import { debugShowAIInternalContext } from '@/app/debugFlags';
import { Markdown } from '@/app/ui/components/Markdown';
import { AIAnalystExamplePrompts } from '@/app/ui/menus/AIAnalyst/AIAnalystExamplePrompts';
import { AIAnalystToolCard } from '@/app/ui/menus/AIAnalyst/AIAnalystToolCard';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import type { MessageContentItem } from '@/app/ui/menus/AIAnalyst/AIThinkingBlock';
import { ThinkingBlock } from '@/app/ui/menus/AIAnalyst/AIThinkingBlock';
import { apiClient } from '@/shared/api/apiClient';
import { ThumbDownIcon, ThumbUpIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import mixpanel from 'mixpanel-browser';
import { getLastUserPromptMessageIndex } from 'quadratic-shared/ai/helpers/message.helper';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

type AIAnalystMessagesProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export function AIAnalystMessages({ textareaRef }: AIAnalystMessagesProps) {
  const [, ,] = useAIModel();
  const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);

  // We don't need these anymore since each ThinkingBlock manages its own state
  // const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});
  // const [loadedMessageIndices, setLoadedMessageIndices] = useState<number[]>([]);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((div: HTMLDivElement | null) => {
    setDiv(div);
    div?.scrollTo({
      top: div.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const shouldAutoScroll = useRef(true);
  const handleScroll = useCallback((e: Event) => {
    const div = e.target as HTMLDivElement;
    // Add a small buffer (5px) to account for rounding errors and tiny scroll differences
    const isScrolledToBottom = div.scrollHeight - div.scrollTop - div.clientHeight < 5;
    shouldAutoScroll.current = isScrolledToBottom;
  }, []);

  useEffect(() => {
    // Use both scroll and scrollend events for better cross-browser support
    div?.addEventListener('scroll', handleScroll);
    div?.addEventListener('scrollend', handleScroll);
    return () => {
      div?.removeEventListener('scroll', handleScroll);
      div?.removeEventListener('scrollend', handleScroll);
    };
  }, [div, handleScroll]);

  const scrollToBottom = useCallback(
    (force = false) => {
      if (force || shouldAutoScroll.current) {
        // Use requestAnimationFrame to ensure scrolling happens in the next frame
        // This helps prevent race conditions with React re-renders
        requestAnimationFrame(() => {
          if (div) {
            div.scrollTo({
              top: div.scrollHeight,
              // Use auto for rapid text updates to avoid falling behind
              // Smooth scrolling can't keep up with fast text generation
              behavior: force ? 'auto' : 'smooth',
            });
          }
        });
      }
    },
    [div]
  );

  useEffect(() => {
    if (loading) {
      // Don't force shouldAutoScroll to true - respect current value
      // Only force initial scroll if already at bottom
      if (shouldAutoScroll.current) {
        scrollToBottom(true);
      }

      // Only observe mutations while loading
      if (div) {
        const observer = new MutationObserver(() => {
          // Only scroll if user was already at bottom
          if (shouldAutoScroll.current) {
            scrollToBottom(true);
          }
        });

        observer.observe(div, {
          childList: true,
          subtree: true,
          characterData: true,
        });

        return () => observer.disconnect();
      }
    }
  }, [loading, scrollToBottom, div]);

  useEffect(() => {
    if (messagesCount === 0) {
      shouldAutoScroll.current = true;
    }
  }, [messagesCount]);

  // Only scroll on message changes if we're loading and user was already at bottom
  useEffect(() => {
    if (loading && shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, loading, shouldAutoScroll]);

  // Don't auto-scroll when thinking blocks are expanded
  const handleThinkingToggle = useCallback(() => {
    // Removed auto-scrolling behavior
    // User can manually scroll if needed
  }, []);

  if (messagesCount === 0) {
    return <AIAnalystExamplePrompts />;
  }

  return (
    <div
      ref={ref}
      className="flex select-text flex-col gap-3 overflow-y-auto px-2 pb-8 outline-none"
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
        if (!debugShowAIInternalContext && message.contextType !== 'userPrompt') {
          return null;
        }

        const hasThinking =
          message.role === 'assistant' &&
          message.content &&
          Array.isArray(message.content) &&
          message.content.some((item) => item.type === 'anthropic_thinking');

        const isCurrentMessage = index === messages.length - 1;

        return (
          <div
            key={`${index}-${message.role}-${message.contextType}-${message.content}`}
            className={cn(
              'flex flex-col gap-3',
              message.role === 'user' && message.contextType === 'userPrompt' ? '' : 'px-2',
              // For debugging internal context
              message.contextType === 'userPrompt' ? '' : 'bg-accent'
            )}
          >
            {message.role === 'user' ? (
              message.contextType === 'userPrompt' ? (
                <AIAnalystUserMessageForm
                  initialPrompt={message.content}
                  initialContext={message.context}
                  messageIndex={index}
                  textareaRef={textareaRef}
                />
              ) : Array.isArray(message.content) ? (
                message.content.map(({ content }) => <Markdown key={content}>{content}</Markdown>)
              ) : (
                <Markdown key={message.content}>{message.content}</Markdown>
              )
            ) : (
              <>
                {message.content && Array.isArray(message.content) ? (
                  <>
                    {message.content
                      .filter((item) => item.type === 'text')
                      .map((item) => (
                        <div key={item.text}>
                          <Markdown>{item.text}</Markdown>
                        </div>
                      ))}

                    {hasThinking && (
                      <ThinkingBlock
                        messageIndex={index}
                        isCurrentMessage={isCurrentMessage}
                        isLoading={loading}
                        thinkingContent={
                          message.content.filter((item) => item.type === 'anthropic_thinking') as MessageContentItem[]
                        }
                        onToggle={handleThinkingToggle}
                      />
                    )}
                  </>
                ) : (
                  <Markdown key={message.content}>{message.content}</Markdown>
                )}

                {message.contextType === 'userPrompt' &&
                  message.toolCalls.map((toolCall) => (
                    <AIAnalystToolCard
                      key={toolCall.id}
                      name={toolCall.name}
                      args={toolCall.arguments}
                      loading={toolCall.loading}
                    />
                  ))}
              </>
            )}
          </div>
        );
      })}

      {messages.length > 0 && !loading && <FeedbackButtons />}

      <div className={cn('flex flex-row gap-1 p-2 transition-opacity', !loading && 'opacity-0')}>
        <span className="h-2 w-2 animate-bounce bg-primary" />
        <span className="h-2 w-2 animate-bounce bg-primary/60 delay-100" />
        <span className="h-2 w-2 animate-bounce bg-primary/20 delay-200" />
      </div>
    </div>
  );
}

function FeedbackButtons() {
  // true=positive, false=negative, null=neutral
  const [like, setLike] = useState<boolean | null>(null);
  const settings = useRecoilValue(editorInteractionStateSettingsAtom);

  const logFeedback = useRecoilCallback(
    ({ snapshot }) =>
      (newLike: boolean | null) => {
        // Log it to mixpanel
        mixpanel.track('[AIAnalyst].feedback', { like: newLike });

        // If they have AI analytics turned off, don't do anything else
        if (!settings.analyticsAi) {
          return;
        }

        // Otherwise, log it to our DB
        const messages = snapshot.getLoadable(aiAnalystCurrentChatMessagesAtom).getValue();
        const messageIndex = getLastUserPromptMessageIndex(messages);
        if (messageIndex < 0) return;

        const chatId = snapshot.getLoadable(aiAnalystCurrentChatAtom).getValue().id;
        apiClient.ai.feedback({
          chatId,
          messageIndex,
          like: newLike,
        });
      },
    [apiClient]
  );

  return (
    <div className="relative flex flex-row items-center px-2">
      <TooltipPopover label="Good response">
        <Button
          onClick={() => {
            setLike((prev) => {
              const newLike = prev === true ? null : true;
              logFeedback(newLike);
              return newLike;
            });
          }}
          variant="ghost"
          size="icon-sm"
          className={cn('select-none hover:text-success', like === true ? 'text-success' : 'text-muted-foreground')}
          disabled={like === false}
        >
          <ThumbUpIcon className="scale-75" />
        </Button>
      </TooltipPopover>

      <TooltipPopover label="Bad response">
        <Button
          onClick={() => {
            setLike((prev) => {
              const newLike = prev === false ? null : false;
              logFeedback(newLike);
              return newLike;
            });
          }}
          variant="ghost"
          size="icon-sm"
          className={cn(
            'select-none hover:text-destructive',
            like === false ? 'text-destructive' : 'text-muted-foreground'
          )}
          disabled={like === true}
        >
          <ThumbDownIcon className="scale-75" />
        </Button>
      </TooltipPopover>
    </div>
  );
}
