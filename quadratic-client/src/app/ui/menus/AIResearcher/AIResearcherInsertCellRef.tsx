import { aiResearcherRefCellAtom } from '@/app/atoms/aiResearcherAtom';
import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIResearcherInsertCellRef = () => {
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const [refCell, setRefCell] = useRecoilState(aiResearcherRefCellAtom);

  const insertCellRef = useCallback(() => {
    let sheet = '';
    if (codeCell.sheetId !== sheets.sheet.id) {
      sheet = `'${sheets.sheet.name}'!`;
    }

    let a1Notation = '';
    const cursor = sheets.sheet.cursor;
    if (cursor.multiCursor) {
      cursor.multiCursor.forEach((cell, i) => {
        const start = getA1Notation(cell.left, cell.top);
        const end = getA1Notation(cell.right - 1, cell.bottom - 1);
        a1Notation += `${start}:${end}${i !== cursor.multiCursor!.length - 1 ? ',' : ''}`;
      });
    } else {
      const location = cursor.getCursor();
      a1Notation = getA1Notation(location.x, location.y);
    }

    setRefCell(`${sheet}${a1Notation}`);
  }, [codeCell.sheetId, setRefCell]);

  const [disabled, setDisabled] = useState(true);
  useEffect(() => {
    const checkDisabled = () => {
      if (
        (sheets.sheet.cursor.multiCursor && sheets.sheet.cursor.multiCursor.length > 1) ||
        sheets.sheet.cursor.columnRow !== undefined
      ) {
        setDisabled(true);
      } else {
        setDisabled(
          !sheets.sheet.cursor.multiCursor &&
            codeCell.sheetId === sheets.sheet.id &&
            codeCell.pos.x === sheets.sheet.cursor.cursorPosition.x &&
            codeCell.pos.y === sheets.sheet.cursor.cursorPosition.y
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
