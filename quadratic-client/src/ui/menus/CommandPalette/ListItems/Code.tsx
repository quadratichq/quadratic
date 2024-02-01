import { rerunAction, rerunCellAction, rerunSheetAction } from '../../../../actions';
import { grid } from '../../../../grid/controller/Grid';
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
          action={grid.rerunCodeCell}
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
          action={grid.rerunSheetCodeCells}
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
          action={grid.rerunAllCodeCells}
          shortcut="Enter"
          shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Alt, KeyboardSymbols.Command]}
        />
      );
    },
  },
];

export default ListItems;
