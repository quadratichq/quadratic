import { isAnthropicModel } from '@/app/ai/hooks/useAIRequestToAPI';
import { aiAssistantMessagesAtom } from '@/app/atoms/codeEditorAtom';
import { debugShowAIAssistantInternalContext } from '@/app/debugFlags';
import { colors } from '@/app/theme/colors';
import { Anthropic, OpenAI } from '@/app/ui/icons';
import { AICodeBlockParser } from '@/app/ui/menus/CodeEditor/AIAssistant/AICodeBlockParser';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import './AIAssistantMessages.css';

export function AIAssistantMessages() {
  const messages = useRecoilValue(aiAssistantMessagesAtom);
  const { loggedInUser: user } = useRootRouteLoaderData();

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
      <div id="ai-streaming-output" className="pb-2">
        {messages
          .filter((message) => debugShowAIAssistantInternalContext || !message.internalContext)
          .map((message, index) => (
            <div
              key={index}
              style={{
                borderTop: index !== 0 ? `1px solid ${colors.lightGray}` : 'none',
                marginTop: '1rem',
                paddingTop: index !== 0 ? '1rem' : '0',
                backgroundColor: message.internalContext ? colors.lightGray : 'white',
                borderRadius: '0.5rem',
              }}
            >
              {message.role === 'user' ? (
                <>
                  <Avatar
                    src={user?.picture}
                    alt={user?.name}
                    style={{
                      backgroundColor: colors.quadraticSecondary,
                      marginBottom: '0.5rem',
                    }}
                  >
                    {user?.name}
                  </Avatar>
                  <AICodeBlockParser input={message.content} />
                </>
              ) : (
                <>
                  <Avatar
                    alt="AI Assistant"
                    style={{
                      backgroundColor: 'white',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {isAnthropicModel(message.model) ? <Anthropic /> : <OpenAI />}
                  </Avatar>
                  <AICodeBlockParser input={message.content} />
                </>
              )}
            </div>
          ))}
        <div id="ai-streaming-output-anchor" key="ai-streaming-output-anchor" />
      </div>
    </div>
  );
}
