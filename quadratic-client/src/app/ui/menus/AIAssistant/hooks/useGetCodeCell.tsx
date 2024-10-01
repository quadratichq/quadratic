import { aiAssistantContextAtom } from '@/app/atoms/aiAssistantAtom';
import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useRecoilCallback } from 'recoil';

export function useGetCodeCell() {
  const getCodeCell = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const aiAssistantContext = await snapshot.getPromise(aiAssistantContextAtom);
        const codeEditorCodeCell = await snapshot.getPromise(codeEditorCodeCellAtom);

        // Priority 1: Use AI Assistant context if available
        if (aiAssistantContext.codeCell) {
          return aiAssistantContext.codeCell;
        }
        // Priority 2: Use Code Editor cell if available
        if (codeEditorCodeCell.sheetId) {
          return codeEditorCodeCell;
        }
        // Priority 3: Fallback to current sheet and cursor position
        return {
          sheetId: sheets.current,
          pos: { ...sheets.sheet.cursor.cursorPosition },
          language: codeEditorCodeCell.language,
        };
      },
    []
  );

  return { getCodeCell };
}
