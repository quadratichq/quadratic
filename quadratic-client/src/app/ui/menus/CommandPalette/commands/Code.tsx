import { rerunAction, rerunCellAction, rerunSheetAction } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

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
            action={() =>
              quadraticCore.rerunCodeCells(
                sheets.current,
                sheets.sheet.cursor.position.x,
                sheets.sheet.cursor.position.y,
                sheets.getCursorPosition()
              )
            }
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
            action={() =>
              quadraticCore.rerunCodeCells(sheets.current, undefined, undefined, sheets.getCursorPosition())
            }
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
            action={() => quadraticCore.rerunCodeCells(undefined, undefined, undefined, sheets.getCursorPosition())}
            shortcut={KeyboardSymbols.Enter}
            shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Alt, KeyboardSymbols.Command]}
          />
        );
      },
    },
  ],
};

export default commands;
