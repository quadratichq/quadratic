import { aiResearcherPromptAtom, aiResearcherRefCellAtom } from '@/app/atoms/aiResearcherAtom';
import { codeEditorCodeCellAtom, codeEditorEscapePressedAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { AIUserMessageForm } from '@/app/ui/components/AIUserMessageForm';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { AIResearcherHeader } from '@/app/ui/menus/AIResearcher/AIResearcherHeader';
import { AIResearcherInsertCellRef } from '@/app/ui/menus/AIResearcher/AIResearcherInsertCellRef';
import { AIResearcherOutput } from '@/app/ui/menus/AIResearcher/AIResearcherOutput';
import { useAIResearcherPanelWidth } from '@/app/ui/menus/AIResearcher/hooks/useAIResearcherPanelWidth';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useCallback, useRef, useState } from 'react';
import { useRecoilCallback } from 'recoil';

export const AIResearcher = () => {
  const aiPanelRef = useRef<HTMLDivElement>(null);
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

  const submitPrompt = useRecoilCallback(
    ({ snapshot, set }) =>
      async (prompt: string) => {
        set(aiResearcherPromptAtom, prompt);
        const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
        const refCell = await snapshot.getPromise(aiResearcherRefCellAtom);
        const codeString = `AI("${prompt}", ${refCell})`;
        quadraticCore.setCodeCellValue({
          sheetId: codeCell.sheetId,
          x: codeCell.pos.x,
          y: codeCell.pos.y,
          language: 'AIResearcher',
          codeString,
          cursor: sheets.getCursorPosition(),
        });
      },
    []
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortController = new AbortController();
  const [loading, setLoading] = useState(false);

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

        <AIUserMessageForm
          textareaRef={textareaRef}
          autoFocus={true}
          abortController={abortController}
          loading={loading}
          setLoading={setLoading}
          submitPrompt={submitPrompt}
        />

        <AIResearcherOutput />
      </div>
    </div>
  );
};
