import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getCodeCell } from '@/app/helpers/codeCellLanguage';
import { xyToA1 } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { useCloseCodeEditor } from '@/app/ui/menus/CodeEditor/hooks/useCloseCodeEditor';
import { CloseIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
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
        <TooltipPopover label={`${codeCell?.label}`} side="bottom">
          <div className="flex items-center">
            <LanguageIcon language={codeCell?.id} fontSize="small" />
          </div>
        </TooltipPopover>
      </div>

      <div className="mx-2 flex flex-col truncate">
        <div className="text-sm font-medium leading-4">
          Cell {xyToA1(codeCellState.pos.x, codeCellState.pos.y)}
          {currentCodeEditorCellIsNotInActiveSheet && (
            <span className="ml-1 min-w-0 truncate">- {currentSheetNameOfActiveCodeEditorCell}</span>
          )}
        </div>
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        <TooltipPopover label={`Close`} shortcut={`Esc`} side="bottom">
          <Button
            variant="ghost"
            id="QuadraticAIResearcherCloseButtonID"
            onClick={() => closeEditor(true)}
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <CloseIcon />
          </Button>
        </TooltipPopover>
      </div>
    </div>
  );
};
