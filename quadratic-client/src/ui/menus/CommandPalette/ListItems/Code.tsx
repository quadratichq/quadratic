import { sheets } from '@/grid/controller/Sheets';
import { quadraticCore } from '@/web-workers/quadraticCore/quadraticCore';
import { rerunAction, rerunCellAction, rerunSheetAction } from '../../../../actions';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: rerunCellAction.label,
    isAvailable: rerunCellAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            const cursor = sheets.sheet.cursor.cursorPosition;
            quadraticCore.rerunCodeCells(sheets.sheet.id, cursor.x, cursor.y, sheets.getCursorPosition());
          }}
          shortcut="Enter"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: rerunSheetAction.label,
    isAvailable: rerunSheetAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={() => quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition())}
          shortcut="Enter"
          shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: rerunAction.label,
    isAvailable: rerunAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={() => quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition())}
          shortcut="Enter"
          shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Alt, KeyboardSymbols.Command]}
        />
      );
    },
  },
];

export default ListItems;
