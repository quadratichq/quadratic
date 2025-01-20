import { Action } from '@/app/actions/actions';
import { copySelectionToPNG, fullClipboardSupport } from '@/app/grid/actions/clipboard/clipboard';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CopyAsPng } from '@/shared/components/Icons';

const data: CommandGroup = {
  heading: 'Edit',
  commands: [
    Action.Undo,
    Action.Redo,
    Action.Cut,
    Action.Copy,
    Action.Paste,
    Action.PasteValuesOnly,
    Action.PasteFormattingOnly,
    Action.ShowGoToMenu,
    Action.FindInCurrentSheet,
    Action.FindInAllSheets,
    Action.InsertToday,
    Action.InsertTodayTime,
    {
      label: 'Copy selection as PNG',
      isAvailable: () => fullClipboardSupport(),
      Component: (props) => {
        const { addGlobalSnackbar } = useGlobalSnackbar();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => copySelectionToPNG(addGlobalSnackbar)}
            icon={<CopyAsPng />}
            shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Command]}
            shortcut="C"
          />
        );
      },
    },
    Action.DownloadAsCsv,
  ],
};

export default data;
