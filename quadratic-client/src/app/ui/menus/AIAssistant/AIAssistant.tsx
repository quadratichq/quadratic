import { showAIAssistantAtom } from '@/app/atoms/aiAssistantAtom';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAssistantContext } from '@/app/ui/menus/AIAssistant/AIAssistantContext';
import { AIAssistantHeader } from '@/app/ui/menus/AIAssistant/AIAssistantHeader';
import { AIAssistantMessages } from '@/app/ui/menus/AIAssistant/AIAssistantMessages';
import { AIAssistantUserMessageForm } from '@/app/ui/menus/AIAssistant/AIAssistantUserMessageForm';
import { useAIAssistantPanelWidth } from '@/app/ui/menus/AIAssistant/hooks/useAIAssistantPanelWidth';
import { useCallback, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAssistant = ({ autoFocus }: { autoFocus?: boolean }) => {
  const showAIAssistant = useRecoilValue(showAIAssistantAtom);
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
      <div className="grid h-full w-full grid-rows-[auto_1fr_auto_auto]">
        <AIAssistantHeader />
        <AIAssistantMessages />
        <AIAssistantContext />
        <AIAssistantUserMessageForm autoFocus={autoFocus} />
      </div>
    </div>
  );
};
