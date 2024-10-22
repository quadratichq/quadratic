import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { InsertCellRefIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const CodeEditorRefButton = () => {
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);

  const [disabled, setDisabled] = useState(true);
  useEffect(() => {
    const checkDisabled = () => {
      // we do not yet support multiple multiCursors for inserting cell references
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

  const tooltip = useMemo(
    () => (!disabled ? <>Insert cell reference</> : <>Select cells on the grid to insert cell reference.</>),
    [disabled]
  );

  return (
    <div className="code-editor-ref-button flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            disabled={disabled}
            size="icon"
            className={cn(disabled ? '' : '!text-primary')}
            onClick={() => insertCellRef(codeCell.pos, codeCell.sheetId, codeCell.language, true)}
          >
            <InsertCellRefIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
};
