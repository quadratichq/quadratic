import { codeEditorEscapePressedAtom } from '@/app/atoms/codeEditorAtom';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { useAIResearcherPanelWidth } from '@/app/ui/menus/AIAssistant/hooks/useAIAssistantPanelWidth';
import { AIResearcherHeader } from '@/app/ui/menus/AIResearcher/AIResearcherHeader';
import { AIResearcherInsertCellRef } from '@/app/ui/menus/AIResearcher/AIResearcherInsertCellRef';
import { AIResearcherMessageForm } from '@/app/ui/menus/AIResearcher/AIResearcherMessageForm';
import { AIResearcherOutput } from '@/app/ui/menus/AIResearcher/AIResearcherOutput';
import { useCallback, useRef } from 'react';
import { useSetRecoilState } from 'recoil';

export const AIResearcher = () => {
  const setEscapePressed = useSetRecoilState(codeEditorEscapePressedAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const { panelWidth, setPanelWidth } = useAIResearcherPanelWidth();

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setEscapePressed(true);
      }
    },
    [setEscapePressed]
  );

  const handleResize = useCallback(
    (event: MouseEvent) => {
      const panel = aiPanelRef.current;
      if (!panel) return;
      event.stopPropagation();
      event.preventDefault();

      const containerRect = panel.getBoundingClientRect();
      const newPanelWidth = containerRect.right - event.x;
      setPanelWidth(newPanelWidth);
    },
    [setPanelWidth]
  );

  return (
    <div
      ref={aiPanelRef}
      className="relative hidden h-full shrink-0 overflow-hidden lg:block"
      style={{ width: `${panelWidth}px` }}
      onKeyDown={handleKeyDown}
    >
      <ResizeControl position="VERTICAL" style={{ left: '2px' }} setState={handleResize} />

      <div className="flex h-full w-full flex-col gap-4">
        <AIResearcherHeader />

        <AIResearcherInsertCellRef />

        <AIResearcherMessageForm autoFocus={true} />

        <AIResearcherOutput />
      </div>
    </div>
  );
};
