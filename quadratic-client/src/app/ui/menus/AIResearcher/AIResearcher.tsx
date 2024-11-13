import { codeEditorEscapePressedAtom, codeEditorLoadingAtom } from '@/app/atoms/codeEditorAtom';
import { AIUserMessageFormDisclaimer } from '@/app/ui/components/AIUserMessageForm';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIResearcherHeader } from '@/app/ui/menus/AIResearcher/AIResearcherHeader';
import { AIResearcherInsertCellRef } from '@/app/ui/menus/AIResearcher/AIResearcherInsertCellRef';
import { AIResearcherOutput } from '@/app/ui/menus/AIResearcher/AIResearcherOutput';
import { AIResearcherUserMessageForm } from '@/app/ui/menus/AIResearcher/AIResearcherUserMessageForm';
import { useAIResearcherPanelWidth } from '@/app/ui/menus/AIResearcher/hooks/useAIResearcherPanelWidth';
import { CircularProgress } from '@mui/material';
import { useCallback, useRef } from 'react';
import { useRecoilCallback, useRecoilValue } from 'recoil';

export const AIResearcher = () => {
  const codeEditorLoading = useRecoilValue(codeEditorLoadingAtom);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { panelWidth, setPanelWidth } = useAIResearcherPanelWidth();

  const handleKeyDown = useRecoilCallback(
    ({ set }) =>
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          set(codeEditorEscapePressedAtom, true);
        }
      },
    []
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

  if (codeEditorLoading) {
    return (
      <div className="flex justify-center">
        <CircularProgress style={{ width: '18px', height: '18px' }} />
      </div>
    );
  }

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

        <div className="px-2 py-0.5">
          <AIResearcherUserMessageForm ref={textareaRef} autoFocus={true} textareaRef={textareaRef} />
          <AIUserMessageFormDisclaimer />
        </div>

        <AIResearcherOutput />
      </div>
    </div>
  );
};
