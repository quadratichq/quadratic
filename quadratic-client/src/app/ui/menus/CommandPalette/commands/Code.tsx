import { rerunAction, rerunCellAction, rerunSheetAction } from '@/app/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
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
                sheets.sheet.id,
                sheets.sheet.cursor.cursorPosition.x,
                sheets.sheet.cursor.cursorPosition.y,
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
              quadraticCore.rerunCodeCells(sheets.sheet.id, undefined, undefined, sheets.getCursorPosition())
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
