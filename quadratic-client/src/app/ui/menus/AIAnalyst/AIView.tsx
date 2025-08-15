import { aiAnalystCurrentChatMessagesCountAtom, aiAnalystShowChatHistoryAtom } from '@/app/atoms/aiAnalystAtom';
import { AIUserMessageFormDisclaimer } from '@/app/ui/components/AIUserMessageFormDisclaimer';
import { AIAnalystChatHistory } from '@/app/ui/menus/AIAnalyst/AIAnalystChatHistory';
import { AIAnalystGetChatName } from '@/app/ui/menus/AIAnalyst/AIAnalystGetChatName';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
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
        className="flex h-full w-full flex-col overflow-hidden"
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-[800px]">
          <AIAnalystHeader textareaRef={textareaRef} />
        </div>

        {showChatHistory && <AIAnalystChatHistory />}

        {!showChatHistory && (
          <div className="mx-auto w-full flex-1 overflow-auto">
            <div className="mx-auto max-w-[800px]">
              <AIAnalystMessages textareaRef={textareaRef} />
            </div>
          </div>
        )}

        {!showChatHistory && (
          <div className="mx-auto w-[800px] px-2 py-0.5">
            <AIAnalystUserMessageForm
              ref={textareaRef}
              autoFocusRef={autoFocusRef}
              textareaRef={textareaRef}
              messageIndex={messagesCount}
            />
            <AIUserMessageFormDisclaimer />
          </div>
        )}
      </div>
    </>
  );
});
