import { AIUserMessageFormDisclaimer } from '@/app/ui/components/AIUserMessageForm';
import { AIAssistantMessages } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantMessages';
import { AIAssistantUserMessageForm } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantUserMessageForm';
import { useRef } from 'react';

export const AIAssistant = () => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoFocusRef = useRef(true);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative min-h-0 flex-1 overflow-auto">
        <AIAssistantMessages textareaRef={textareaRef} />
      </div>

      <div className="sticky bottom-0 z-10 bg-background px-2 py-0.5">
        <AIAssistantUserMessageForm ref={textareaRef} autoFocusRef={autoFocusRef} textareaRef={textareaRef} />
        <AIUserMessageFormDisclaimer />
      </div>
    </div>
  );
};
