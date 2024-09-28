import { Action } from '@/app/actions/actions';
import { copySelectionToPNG, fullClipboardSupport } from '@/app/grid/actions/clipboard/clipboard';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CopyAsPng } from '@/shared/components/Icons';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

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
