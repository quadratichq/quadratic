import { AIAssistantMessages } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantMessages';
import { AIAssistantUserMessageForm } from '@/app/ui/menus/CodeEditor/AIAssistant/AIAssistantUserMessageForm';

export const AIAssistant = ({ autoFocus }: { autoFocus?: boolean }) => {
  // Designed to live in a box that takes up the full height of its container
  return (
    <div className="grid h-full grid-rows-[1fr_auto]">
      <AIAssistantMessages />

      <AIAssistantUserMessageForm autoFocus={autoFocus} />
    </div>
  );
};
