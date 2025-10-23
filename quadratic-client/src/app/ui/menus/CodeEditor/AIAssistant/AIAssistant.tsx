import { aiAssistantMessagesCountAtom } from '@/app/atoms/codeEditorAtom';
import { AIMessageCounterBar } from '@/app/ui/components/AIMessageCounterBar';
import { AIAssistantMessages } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantMessages';
import { AIAssistantUserMessageForm } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantUserMessageForm';
import { memo, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAssistant = memo(() => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoFocusRef = useRef(true);
  const messagesCount = useRecoilValue(aiAssistantMessagesCountAtom);

  return (
    <div className="grid h-full grid-rows-[1fr_auto]">
      <AIAssistantMessages textareaRef={textareaRef} />

      <div className="flex h-full flex-col justify-end px-2 pb-1.5 pt-0.5">
        <AIAssistantUserMessageForm
          ref={textareaRef}
          autoFocusRef={autoFocusRef}
          textareaRef={textareaRef}
          messageIndex={messagesCount}
          uiContext="assistant-new-chat"
        />
        <AIMessageCounterBar />
      </div>
    </div>
  );
});
