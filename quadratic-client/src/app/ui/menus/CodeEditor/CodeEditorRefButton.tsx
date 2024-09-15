import {
  editorInteractionStateModeAtom,
  editorInteractionStateSelectedCellAtom,
  editorInteractionStateSelectedCellSheetAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { insertCellRef } from '@/app/ui/menus/CodeEditor/insertCellRef';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import { IconButton } from '@mui/material';
import { CaretDownIcon } from '@radix-ui/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';

export const CodeEditorRefButton = () => {
  const [relative, setRelative] = useLocalStorage('insertCellRefRelative', false);
  const selectedCell = useRecoilValue(editorInteractionStateSelectedCellAtom);
  const selectedCellSheet = useRecoilValue(editorInteractionStateSelectedCellSheetAtom);
  const mode = useRecoilValue(editorInteractionStateModeAtom);

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
            selectedCell.x === sheets.sheet.cursor.cursorPosition.x &&
            selectedCell.y === sheets.sheet.cursor.cursorPosition.y &&
            selectedCellSheet === sheets.sheet.id
        );
      }
    };
    events.on('cursorPosition', checkDisabled);
    events.on('changeSheet', checkDisabled);
    return () => {
      events.off('cursorPosition', checkDisabled);
      events.off('changeSheet', checkDisabled);
    };
  }, [selectedCell.x, selectedCell.y, selectedCellSheet]);

  const tooltip = useMemo(
    () =>
      !disabled ? (
        <>Insert {relative ? 'relative ' : ''}cell reference</>
      ) : (
        <>Select cells on the grid to insert cell reference.</>
      ),
    [disabled, relative]
  );

  return (
    <div className="code-editor-ref-button flex items-center">
      <TooltipHint title={tooltip} placement="bottom">
        <span>
          <IconButton
            disabled={disabled}
            size="small"
            color="primary"
            onClick={() => insertCellRef(selectedCell, selectedCellSheet, mode, relative)}
          >
            <HighlightAltIcon fontSize="small" />
          </IconButton>
        </span>
      </TooltipHint>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton style={{ padding: 0, marginLeft: '-0.3rem' }} size="small" disabled={disabled}>
            <CaretDownIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={!relative} onClick={() => setRelative(false)}>
            Absolute cell reference
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={relative} onClick={() => setRelative(true)}>
            Relative cell reference
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
