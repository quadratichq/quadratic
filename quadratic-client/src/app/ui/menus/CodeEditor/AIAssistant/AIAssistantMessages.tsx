import {
  aiAssistantCurrentChatMessagesCountAtom,
  aiAssistantLoadingAtom,
  aiAssistantMessagesAtom,
} from '@/app/atoms/codeEditorAtom';
import { debugShowAIInternalContext } from '@/app/debugFlags';
import { colors } from '@/app/theme/colors';
import { AIAssistantUserMessageForm } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantUserMessageForm';
import { AICodeBlockParser } from '@/app/ui/menus/CodeEditor/AIAssistant/AICodeBlockParser';
import { cn } from '@/shared/shadcn/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';

type AIAssistantMessagesProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export function AIAssistantMessages({ textareaRef }: AIAssistantMessagesProps) {
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
    const isScrolledToBottom = div.scrollHeight - div.scrollTop === div.clientHeight;
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
      className="select-text overflow-y-auto whitespace-pre-wrap pb-2 text-sm outline-none"
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
            className={cn(
              'flex flex-col gap-1',
              message.role === 'user' && message.contextType === 'userPrompt' ? '' : 'px-4'
            )}
            // For debugging internal context
            style={{
              backgroundColor: message.contextType === 'userPrompt' ? 'white' : colors.lightGray,
            }}
          >
            {message.role === 'user' && message.contextType === 'userPrompt' ? (
              <AIAssistantUserMessageForm
                initialPrompt={message.content}
                messageIndex={index}
                textareaRef={textareaRef}
              />
            ) : Array.isArray(message.content) ? (
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
