import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import { InsertCellRefIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const CodeEditorRefButton = () => {
  const codeEditor = useRecoilValue(codeEditorCodeCellAtom);

  // todo: relative should not have been removed
  const [relative] = useState(true);
  const codeCell = useRecoilValue(codeEditorCodeCellAtom);

  const [disabled, setDisabled] = useState(true);
  useEffect(() => {
    const checkDisabled = () => {
      if (
        sheets.sheet.cursor.isMultiRange() ||
        (codeCell.sheetId === sheets.current &&
          codeCell.pos.x === sheets.sheet.cursor.position.x &&
          codeCell.pos.y === sheets.sheet.cursor.position.y)
      ) {
        setDisabled(true);
      } else {
        // for connections, we currently only support one cursor position
        if (codeCellIsAConnection(codeEditor.language)) {
          setDisabled(!sheets.sheet.cursor.isSingleSelection() && !sheets.sheet.cursor.is1dRange());
        } else {
          setDisabled(false);
        }
      }
    };
    events.on('cursorPosition', checkDisabled);
    events.on('changeSheet', checkDisabled);
    return () => {
      events.off('cursorPosition', checkDisabled);
      events.off('changeSheet', checkDisabled);
    };
  }, [codeCell.pos.x, codeCell.pos.y, codeCell.sheetId, codeEditor.language]);

  const tooltip = useMemo(
    () =>
      !disabled
        ? `Insert ${relative ? 'relative ' : ''}cell reference`
        : codeCellIsAConnection(codeEditor.language)
          ? `Select only one cell or a 1d range of cells to insert cell reference.`
          : `Select cells on the grid to insert cell reference.`,
    [codeEditor.language, disabled, relative]
  );

  return (
    <div className="code-editor-ref-button flex items-center">
      <TooltipPopover label={tooltip} side="bottom">
        <Button
          variant="ghost"
          size="icon-sm"
          className={`text-muted-foreground ${disabled ? 'opacity-50' : ''}`}
          onClick={() => {
            if (disabled) return;
            insertCellRef(codeCell.sheetId, codeCell.language, false);
          }}
        >
          <InsertCellRefIcon />
        </Button>
      </TooltipPopover>
    </div>
  );
};
