import { editorInteractionStateShowAIAssistantAtom } from '@/app/atoms/editorInteractionStateAtom';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAssistantHeader } from '@/app/ui/menus/AIAssistant/AIAssistantHeader';
import { AIAssistantMessages } from '@/app/ui/menus/AIAssistant/AIAssistantMessages';
import { AIAssistantUserMessageForm } from '@/app/ui/menus/AIAssistant/AIAssistantUserMessageForm';
import { useAIAssistantPanelWidth } from '@/app/ui/menus/AIAssistant/useAIAssistantPanelWidth';
import { useCallback, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAssistant = ({ autoFocus }: { autoFocus?: boolean }) => {
  const showAIAssistant = useRecoilValue(editorInteractionStateShowAIAssistantAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const { panelWidth, setPanelWidth } = useAIAssistantPanelWidth();

  const handleResize = useCallback(
    (event: MouseEvent) => {
      const panel = aiPanelRef.current;
      if (!panel) return;
      event.stopPropagation();
      event.preventDefault();

      const containerRect = panel.getBoundingClientRect();
      const newPanelWidth = event.x - containerRect.left;
      setPanelWidth(newPanelWidth);
    },
    [setPanelWidth]
  );

  if (!showAIAssistant) {
    return null;
  }

  // Designed to live in a box that takes up the full height of its container
  return (
    <div
      ref={aiPanelRef}
      className="relative hidden h-full shrink-0 overflow-hidden lg:block"
      style={{ width: `${panelWidth}px` }}
    >
      <ResizeControl position="VERTICAL" style={{ left: `${panelWidth - 2}px` }} setState={handleResize} />
      <div className="grid h-full w-full grid-rows-[auto_1fr_auto]">
        <AIAssistantHeader />
        <AIAssistantMessages />
        <AIAssistantUserMessageForm autoFocus={autoFocus} />
      </div>
    </div>
  );
};