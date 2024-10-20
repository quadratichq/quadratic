import { showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIAnalystHeader } from '@/app/ui/menus/AIAnalyst/AIAnalystHeader';
import { AIAnalystMessages } from '@/app/ui/menus/AIAnalyst/AIAnalystMessages';
import { AIAnalystUserMessageForm } from '@/app/ui/menus/AIAnalyst/AIAnalystUserMessageForm';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { useCallback, useRef } from 'react';
import { useRecoilValue } from 'recoil';

export const AIAnalyst = () => {
  const showAIAnalyst = useRecoilValue(showAIAnalystAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const { panelWidth, setPanelWidth } = useAIAnalystPanelWidth();

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

  if (!showAIAnalyst) {
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
        <AIAnalystHeader />

        <AIAnalystMessages />

        <AIAnalystUserMessageForm autoFocus={true} />
      </div>
    </div>
  );
};
