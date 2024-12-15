import { aiResearcherRefCellAtom } from '@/app/atoms/aiResearcherAtom';
import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { ParseFormulaReturnType } from '@/app/helpers/formulaNotation';
import { parseFormula } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIResearcherInsertCellRef = () => {
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const [refCell, setRefCell] = useRecoilState(aiResearcherRefCellAtom);

  const insertCellRef = useCallback(() => {
    setRefCell(sheets.getA1String(codeCell.sheetId));
  }, [codeCell.sheetId, setRefCell]);

  useEffect(() => {
    if (refCell) {
      const parsed = JSON.parse(parseFormula(refCell, codeCell.pos.x, codeCell.pos.y)) as ParseFormulaReturnType;
      pixiApp.cellHighlights.fromFormula(parsed, codeCell.pos, codeCell.sheetId);
    } else {
      pixiApp.cellHighlights.clear();
    }
  }, [codeCell.pos, codeCell.sheetId, refCell]);

  const [disabled, setDisabled] = useState(true);
  useEffect(() => {
    const checkDisabled = () => {
      if (sheets.sheet.cursor.rangeCount() > 1) {
        setDisabled(true);
      } else {
        setDisabled(
          codeCell.sheetId === sheets.sheet.id && sheets.sheet.cursor.contains(codeCell.pos.x, codeCell.pos.y)
        );
      }
    };

    events.on('cursorPosition', checkDisabled);
    events.on('changeSheet', checkDisabled);
    return () => {
      events.off('cursorPosition', checkDisabled);
      events.off('changeSheet', checkDisabled);
    };
  }, [codeCell.pos.x, codeCell.pos.y, codeCell.sheetId]);

  return (
    <div className="mx-3 mb-3 mt-1 flex w-full flex-col gap-2">
      <div className="font-bold">Input cells:</div>

      <div className="flex items-center gap-2">
        <span className="flex min-h-9 min-w-24 items-center gap-2 rounded-md border border-gray-300 px-2 py-1.5">
          {refCell}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" disabled={disabled} onClick={insertCellRef}>
              <HighlightAltIcon />
            </Button>
          </TooltipTrigger>

          <TooltipPortal>
            <TooltipContent side="top" className="flex gap-1">
              Insert input cells
            </TooltipContent>
          </TooltipPortal>
        </Tooltip>
      </div>
    </div>
  );
};
