import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/shared/shadcn/ui/dropdown-menu';
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt';
import { IconButton } from '@mui/material';
import { CaretDownIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { insertCellRef } from './insertCellRef';

export const CodeEditorRefButton = () => {
  const [relative, setRelative] = useLocalStorage('insertCellRefRelative', false);
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);

  const [disabled, setDisabled] = useState(true);
  useEffect(() => {
    const checkDisabled = () => {
      setDisabled(
        editorInteractionState.selectedCell.x === sheets.sheet.cursor.originPosition.x &&
          editorInteractionState.selectedCell.y === sheets.sheet.cursor.originPosition.y &&
          editorInteractionState.selectedCellSheet === sheets.sheet.id &&
          !sheets.sheet.cursor.multiCursor
      );
    };
    events.on('cursorPosition', checkDisabled);
    return () => {
      events.off('cursorPosition', checkDisabled);
    };
  });

  return (
    <div className="flex items-center code-editor-ref-button">
      <TooltipHint title={`Insert ${relative ? 'relative ' : ''}cell reference`} placement="bottom">
         <span>
           <IconButton
            disabled={disabled}
            size="small"
            color="primary"
             onClick={() => insertCellRef(editorInteractionState, relative)}
           >
             <AddLocationAltIcon fontSize="small" />
           </IconButton>
         </span>
      </TooltipHint>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            style={{ padding: 0, marginLeft: "-0.3rem"}}
            size="small"
            disabled={disabled}
          >
            <CaretDownIcon />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={!relative} onClick={() => setRelative(false) }>Insert absolute cell references</DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={relative} onClick={() => setRelative(true) }>Insert relative cell references</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
