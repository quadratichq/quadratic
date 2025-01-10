import { useAIModel } from '@/app/ai/hooks/useAIModel';
import {
  aiAnalystCurrentChatAtom,
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystLoadingAtom,
} from '@/app/atoms/aiAnalystAtom';
import { debugShowAIInternalContext } from '@/app/debugFlags';
import { Markdown } from '@/app/ui/components/Markdown';
import { AIAnalystExamplePrompts } from '@/app/ui/menus/AIAnalyst/AIAnalystExamplePrompts';
import { AIAnalystToolCard } from '@/app/ui/menus/AIAnalyst/AIAnalystToolCard';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { apiClient } from '@/shared/api/apiClient';
import { ThumbDownIcon, ThumbUpIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { getPromptMessages } from 'quadratic-shared/ai/helpers/message.helper';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

type AIAnalystMessagesProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export function AIAnalystMessages({ textareaRef }: AIAnalystMessagesProps) {
  const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const loading = useRecoilValue(aiAnalystLoadingAtom);
  const [model] = useAIModel();

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((div: HTMLDivElement | null) => {
    setDiv(div);
    div?.scrollTo({
      top: div.scrollHeight,
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

  const handleFeedback = useRecoilCallback(
    ({ snapshot }) =>
      (like: boolean) => {
        const messages = snapshot.getLoadable(aiAnalystCurrentChatMessagesAtom).getValue();

        const promptMessageLength = getPromptMessages(messages).length;
        if (promptMessageLength === 0) return;

        const chatId = snapshot.getLoadable(aiAnalystCurrentChatAtom).getValue().id;
        console.log('chatId', chatId, model);
        apiClient.ai.feedback({ chatId, model, messageIndex: promptMessageLength, like });
      },
    [apiClient, model]
  );

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

        return (
          <div
            key={`${index}-${message.role}-${message.contextType}`}
            id={`${index}-${message.role}-${message.contextType}`}
            className={cn(
              'flex flex-col gap-2',
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
                message.content.map(({ content }) => <MarkdownContent key={content}>{content}</MarkdownContent>)
              ) : (
                <MarkdownContent key={message.content}>{message.content}</MarkdownContent>
              )
            ) : (
              <>
                {message.content && <MarkdownContent key={message.content}>{message.content}</MarkdownContent>}

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

      {messages.length > 0 && !loading && <FeedbackButtons handleFeedback={handleFeedback} />}

      <div className={cn('flex flex-row gap-1 px-2 transition-opacity', !loading && 'opacity-0')}>
        <span className="h-2 w-2 animate-bounce bg-primary" />
        <span className="h-2 w-2 animate-bounce bg-primary/60 delay-100" />
        <span className="h-2 w-2 animate-bounce bg-primary/20 delay-200" />
      </div>
    </div>
  );
}

function MarkdownContent({ children }: { children: string }) {
  // Classes applied in Markdown.scss
  return <Markdown>{children}</Markdown>;
}

function FeedbackButtons({ handleFeedback }: { handleFeedback: (like: boolean) => void }) {
  const [liked, setLiked] = useState<boolean | null>(null);

  return (
    <div className="relative flex flex-row items-center px-2">
      <TooltipPopover label="Good response">
        <Button
          onClick={() => {
            setLiked((val) => (val === true ? null : true));
          }}
          variant="ghost"
          size="icon-sm"
          className={cn('hover:text-success', liked === true ? 'text-success' : 'text-muted-foreground')}
          disabled={liked === false}
        >
          <ThumbUpIcon className="scale-75" />
        </Button>
      </TooltipPopover>
      <TooltipPopover label="Bad response">
        <Button
          onClick={() => {
            setLiked((val) => (val === false ? null : false));
          }}
          variant="ghost"
          size="icon-sm"
          className={cn('hover:text-destructive', liked === false ? 'text-destructive' : 'text-muted-foreground')}
          disabled={liked === true}
        >
          <ThumbDownIcon className="scale-75" />
        </Button>
      </TooltipPopover>
    </div>
  );
}
