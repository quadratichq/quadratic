import {
  aiAnalystCurrentChatMessagesAtom,
  aiAnalystCurrentChatMessagesCountAtom,
  aiAnalystShowInternalContextAtom,
} from '@/app/atoms/aiAnalystAtom';
import { colors } from '@/app/theme/colors';
import { Markdown } from '@/app/ui/components/Markdown';
import { AIAnalystToolCard } from '@/app/ui/menus/AIAnalyst/AIAnalystToolCard';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

type AIAnalystMessagesProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
};

export function AIAnalystMessages({ textareaRef }: AIAnalystMessagesProps) {
  const showInternalContext = useRecoilValue(aiAnalystShowInternalContextAtom);
  const messages = useRecoilValue(aiAnalystCurrentChatMessagesAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);

  const [div, setDiv] = useState<HTMLDivElement | null>(null);
  const ref = useCallback((node: HTMLDivElement | null) => {
    setDiv(node);
    node?.scrollTo({
      top: node.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const handleUserInteraction = useCallback(() => {
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

  useEffect(() => {
    if (messagesCount === 0) {
      setShouldAutoScroll(true);
    }
  }, [messagesCount]);

  if (messagesCount === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="select-text overflow-y-auto outline-none"
      spellCheck={false}
      onKeyDown={(e) => {
        if (((e.metaKey || e.ctrlKey) && e.key === 'a') || ((e.metaKey || e.ctrlKey) && e.key === 'c')) {
          // Allow a few commands, but nothing else
        } else {
          e.preventDefault();
        }
      }}
      onWheel={handleUserInteraction}
      onPointerDown={handleUserInteraction}
      // Disable Grammarly
      data-gramm="false"
      data-gramm_editor="false"
      data-enable-grammarly="false"
    >
      {messages.map((message, index) => {
        if (!showInternalContext && message.contextType !== 'userPrompt') {
          return null;
        }

        return (
          <div
            key={`${index}-${message.role}-${message.contextType}`}
            style={{
              backgroundColor: message.contextType === 'userPrompt' ? 'white' : colors.lightGray,
              borderRadius: '0.5rem',
            }}
          >
            {message.role === 'user' ? (
              message.contextType === 'userPrompt' ? (
                <AIAnalystUserMessageForm
                  initialPrompt={message.content}
                  initialContext={message.context}
                  messageIndex={index}
                  textareaRef={textareaRef}
                />
              ) : (
                <Markdown className="mx-2 flex select-text flex-col gap-2 whitespace-pre-wrap break-words text-sm">
                  {message.content}
                </Markdown>
              )
            ) : (
              <>
                <Markdown className="mx-2 flex select-text flex-col gap-2 whitespace-pre-wrap break-words text-sm">
                  {message.content}
                </Markdown>

                {message.toolCalls?.map((toolCall) => (
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
    </div>
  );
}
