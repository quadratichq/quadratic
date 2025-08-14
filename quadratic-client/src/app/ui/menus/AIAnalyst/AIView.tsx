import { aiAnalystCurrentChatMessagesCountAtom, aiAnalystShowChatHistoryAtom } from '@/app/atoms/aiAnalystAtom';
import { AIUserMessageFormDisclaimer } from '@/app/ui/components/AIUserMessageFormDisclaimer';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { cn } from '@/shared/shadcn/utils';
import { memo, useEffect, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIView = memo(() => {
  const showChatHistory = useRecoilValue(aiAnalystShowChatHistoryAtom);
  const messagesCount = useRecoilValue(aiAnalystCurrentChatMessagesCountAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const initialLoadRef = useRef(true);
  const autoFocusRef = useRef(false);
  useEffect(() => {
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
    } else {
      autoFocusRef.current = true;
    }
  }, []);

  return (
    <>
      <AIAnalystGetChatName />

      <div
        ref={aiPanelRef}
        className="relative hidden h-full w-full shrink-0 overflow-hidden md:block"
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
      >
        <div
          className={cn(
            'mx-auto h-full w-full',
            showChatHistory ? 'grid grid-rows-[auto_1fr]' : 'grid grid-rows-[auto_1fr_auto]'
          )}
          style={{ maxWidth: '800px' }}
        >
          <AIAnalystHeader textareaRef={textareaRef} />

          {showChatHistory ? (
            <AIAnalystChatHistory />
          ) : (
            <>
              <AIAnalystMessages textareaRef={textareaRef} />

              <div className="px-2 py-0.5">
                <AIAnalystUserMessageForm
                  ref={textareaRef}
                  autoFocusRef={autoFocusRef}
                  textareaRef={textareaRef}
                  messageIndex={messagesCount}
                />
                <AIUserMessageFormDisclaimer />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
});
