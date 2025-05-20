import { sheets } from '@/app/grid/controller/Sheets';
import { convertReactColorToString } from '@/app/helpers/convertColor';
import { focusGrid } from '@/app/helpers/focusGrid';
import { QColorPicker } from '@/app/ui/components/qColorPicker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
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
import '@szhsin/react-menu/dist/index.css';
import mixpanel from 'mixpanel-browser';
import type { JSX } from 'react';
import type { ColorResult } from 'react-color';

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
              mixpanel.track('[Sheets].delete');
              sheets.userDeleteSheet(sheets.current);
              setTimeout(focusGrid);
            }}
          >
            Delete
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            mixpanel.track('[Sheets].duplicate');
            sheets.duplicate();
            focusGrid();
          }}
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-4">Change color</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="color-picker-dropdown-menu">
            <QColorPicker
              onChangeComplete={(change: ColorResult) => {
                const color = convertReactColorToString(change);
                sheets.sheet.color = color;
                quadraticCore.setSheetColor(sheets.current, color, sheets.getCursorPosition());
                handleClose();
                focusGrid();
              }}
              onClear={() => {
                sheets.sheet.color = undefined;
                quadraticCore.setSheetColor(sheets.current, undefined, sheets.getCursorPosition());
                handleClose();
                focusGrid();
              }}
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
