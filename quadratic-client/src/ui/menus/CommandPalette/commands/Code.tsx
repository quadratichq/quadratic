import { rerunAction, rerunCellAction, rerunSheetAction } from '../../../../actions';
import { grid } from '../../../../grid/controller/Grid';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Code',
  commands: [
    {
      label: rerunCellAction.label,
      isAvailable: rerunCellAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={grid.rerunCodeCell}
            shortcut={KeyboardSymbols.Enter}
            shortcutModifiers={[KeyboardSymbols.Command]}
          />
        );
      },
    },
    {
      label: rerunSheetAction.label,
      isAvailable: rerunSheetAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={grid.rerunSheetCodeCells}
            shortcut={KeyboardSymbols.Enter}
            shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Command]}
          />
        );
      },
    },
    {
      label: rerunAction.label,
      isAvailable: rerunAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={grid.rerunAllCodeCells}
            shortcut={KeyboardSymbols.Enter}
            shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Alt, KeyboardSymbols.Command]}
          />
        );
      },
    },
  ],
};

export default commands;
