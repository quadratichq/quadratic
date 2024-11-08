import { AIUserMessageFormDisclaimer } from '@/app/ui/components/AIUserMessageForm';
import { AIAssistantMessages } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantMessages';
import { AIAssistantUserMessageForm } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantUserMessageForm';
import { useRef } from 'react';

export const AIAssistant = ({ autoFocus }: { autoFocus?: boolean }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="grid h-full grid-rows-[1fr_auto]">
      <AIAssistantMessages textareaRef={textareaRef} />

      <div className="flex h-full flex-col justify-end px-2 py-0.5">
        <AIAssistantUserMessageForm ref={textareaRef} autoFocus={autoFocus} textareaRef={textareaRef} />
        <AIUserMessageFormDisclaimer />
      </div>
    </div>
  );
};
