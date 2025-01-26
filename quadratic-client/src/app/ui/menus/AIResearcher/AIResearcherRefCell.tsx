import { aiResearcherRefCellAtom } from '@/app/atoms/aiResearcherAtom';
import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { stringToSelection } from '@/app/quadratic-rust-client/quadratic_rust_client';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/shared/shadcn/ui/tooltip';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

export const AIResearcherRefCell = () => {
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);
  const [refCell, setRefCell] = useRecoilState(aiResearcherRefCellAtom);
  const inputRef = useRef<HTMLInputElement>(null);

  const insertCellRef = useCallback(() => {
    setRefCell(sheets.getA1String(codeCell.sheetId));
  }, [codeCell.sheetId, setRefCell]);

  useEffect(() => {
    if (refCell) {
      try {
        const selection = stringToSelection(refCell, sheets.current, sheets.a1Context);
        const cellsAccessed = selection.toJsCellsAccessed();
        pixiApp.cellHighlights.fromCellsAccessed([cellsAccessed]);
      } catch (_e) {
        pixiApp.cellHighlights.clear();
      }
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
    <div
      className="m-2 flex items-center gap-2 rounded-md border-t border-border p-2 text-sm"
      onClick={(e) => {
        if (disabled) {
          e.stopPropagation();
          inputRef.current?.focus();
        }
      }}
    >
      <span className="whitespace-nowrap text-muted-foreground">Cell data:</span>

      <Input
        ref={inputRef}
        className="w-min"
        value={refCell}
        onChange={(e) => setRefCell(e.target.value)}
        onClick={(e) => e.stopPropagation()}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              insertCellRef();
            }}
          >
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
  );
};
