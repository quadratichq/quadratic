import { aiAssistantContextAtom } from '@/app/atoms/aiAssistantAtom';
import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';

export function useGetCodeCell() {
  const codeEditorCodeCell = useRecoilValue(codeEditorCodeCellAtom);
  const aiAssistantContext = useRecoilValue(aiAssistantContextAtom);

  const getCodeCell = useCallback(() => {
    if (aiAssistantContext.codeCell) {
      return aiAssistantContext.codeCell;
    }
    if (codeEditorCodeCell.sheetId) {
      return codeEditorCodeCell;
    }
    return {
      sheetId: sheets.current,
      pos: { ...sheets.sheet.cursor.cursorPosition },
      language: codeEditorCodeCell.language,
    };
  }, [aiAssistantContext.codeCell, codeEditorCodeCell]);

  return { getCodeCell };
}
