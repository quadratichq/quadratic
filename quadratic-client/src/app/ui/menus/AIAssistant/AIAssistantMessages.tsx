import { aiAssistantMessagesAtom } from '@/app/atoms/aiAssistantAtom';
import { colors } from '@/app/theme/colors';
import { Anthropic, OpenAI } from '@/app/ui/icons';
import { AICodeBlockParser } from '@/app/ui/menus/AIAssistant/AICodeBlockParser';
import { isAnthropicModel } from '@/app/ui/menus/AIAssistant/useAIRequestToAPI';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Avatar } from '@/shared/components/Avatar';
import { useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import './AIAssistantMessages.css';

export function AIAssistantMessages() {
  const messages = useRecoilValue(aiAssistantMessagesAtom);
  const { loggedInUser: user } = useRootRouteLoaderData();

  const aiResponseRef = useRef<HTMLDivElement>(null);
  // Scroll to the bottom of the AI content when component mounts
  useEffect(() => {
    if (aiResponseRef.current) {
      aiResponseRef.current.scrollTop = aiResponseRef.current.scrollHeight;
    }
  }, []);
  return (
    <div
      ref={aiResponseRef}
      className="select-text overflow-y-auto whitespace-pre-wrap px-2 text-sm outline-none"
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
      <div id="ai-streaming-output" className="pb-2">
        {messages
          // .filter((message) => debug || !message.internalContext) TODO: Uncomment this before merging
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
