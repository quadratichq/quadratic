import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import { Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const AIResearcherHeader = () => {
  const codeCellState = useRecoilValue(codeEditorCodeCellAtom);
  const codeCell = useMemo(() => getCodeCell(codeCellState.language), [codeCellState.language]);

  const [currentSheetId, setCurrentSheetId] = useState<string>(sheets.sheet.id);
  const currentCodeEditorCellIsNotInActiveSheet = useMemo(
    () => currentSheetId !== codeCellState.sheetId,
    [currentSheetId, codeCellState.sheetId]
  );
  const currentSheetNameOfActiveCodeEditorCell = useMemo(
    () => sheets.getById(codeCellState.sheetId)?.name,
    [codeCellState.sheetId]
  );

  useEffect(() => {
    const updateSheetName = () => setCurrentSheetId(sheets.sheet.id);
    events.on('changeSheet', updateSheetName);
    return () => {
      events.off('changeSheet', updateSheetName);
    };
  }, []);

  const { closeEditor } = useCloseCodeEditor({ editorInst: null });

  return (
    <div className="flex items-center px-3 py-1">
      <div className={'relative'}>
        <TooltipHint title={`${codeCell?.label}`} placement="bottom">
          <div className="flex items-center">
            <LanguageIcon language={codeCell?.id} fontSize="small" />
          </div>
        </TooltipHint>
      </div>

      <div className="mx-2 flex flex-col truncate">
        <div className="text-sm font-medium leading-4">
          AI Researcher - Cell ({codeCellState.pos.x}, {codeCellState.pos.y})
          {currentCodeEditorCellIsNotInActiveSheet && (
            <span className="ml-1 min-w-0 truncate">- {currentSheetNameOfActiveCodeEditorCell}</span>
          )}
        </div>
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        <TooltipHint title="Close" shortcut="ESC" placement="bottom">
          <IconButton id="QuadraticCodeEditorCloseButtonID" size="small" onClick={() => closeEditor(false)}>
            <Close />
          </IconButton>
        </TooltipHint>
      </div>
    </div>
  );
};
