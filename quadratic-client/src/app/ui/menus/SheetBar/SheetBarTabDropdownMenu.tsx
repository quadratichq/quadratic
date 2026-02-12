import { sheets } from '@/app/grid/controller/Sheets';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import { focusGrid } from '@/app/helpers/focusGrid';
import type { ColorResult } from '@/app/ui/components/ColorPicker';
import { ColorPicker } from '@/app/ui/components/ColorPicker';
import { ArrowDropDownIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/shadcn/ui/dropdown-menu';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import '@szhsin/react-menu/dist/index.css';
import type { JSX } from 'react';

interface Props {
  handleClose: () => void;
  handleRename: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export const SheetBarTabDropdownMenu = (props: Props): JSX.Element => {
  const { isOpen, setIsOpen, handleRename, handleClose } = props;
  const numberOfSheets = sheets.sheets.length;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={'-mr-1 h-4 w-4 data-[state=open]:bg-accent'}
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
        >
          <ArrowDropDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onPointerDown={(e) => e.stopPropagation()} onCloseAutoFocus={(e) => e.preventDefault()}>
        {numberOfSheets > 1 && (
          <DropdownMenuItem
            onClick={() => {
              trackEvent('[Sheets].delete');
              sheets.userDeleteSheet(sheets.current);
              setTimeout(focusGrid);
            }}
          >
            Delete
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            trackEvent('[Sheets].duplicate');
            sheets.duplicate();
            focusGrid();
          }}
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-4">Change color</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="color-picker-dropdown-menu">
            <ColorPicker
              onChangeComplete={(change: ColorResult) => {
                const color = convertReactColorToString(change);
                sheets.sheet.setColor(color, false);
                handleClose();
                focusGrid();
              }}
              onClear={() => {
                sheets.sheet.setColor(undefined, false);
                handleClose();
                focusGrid();
              }}
              onClose={handleClose}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem
          onClick={() => {
            handleClose();
            handleRename();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          Rename
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          disabled={sheets.getFirst().id === sheets.current}
          onClick={() => {
            sheets.moveSheet({ id: sheets.current, delta: -1 });
            focusGrid();
          }}
        >
          Move left
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={sheets.getLast().id === sheets.current}
          onClick={() => {
            sheets.moveSheet({ id: sheets.current, delta: 1 });
            focusGrid();
          }}
        >
          Move right
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
