import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  fullClipboardSupport,
  pasteFromClipboard,
} from '@/grid/actions/clipboard/clipboard';
import { PasteSpecial } from '@/quadratic-core/quadratic_core';
import { useFileContext } from '@/ui/components/FileProvider';
import { ClipboardIcon, CopyIcon, RedoIcon, ScissorsIcon, UndoIcon } from '@/ui/icons';
import { useRecoilState } from 'recoil';
import {
  copyAction,
  cutAction,
  downloadSelectionAsCsvAction,
  pasteAction,
  pasteActionFormats,
  pasteActionValues,
  redoAction,
  undoAction,
} from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import { grid } from '../../../../grid/controller/Grid';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { isMac } from '../../../../utils/isMac';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const data: CommandGroup = {
  heading: 'Edit',
  commands: [
    {
      label: undoAction.label,
      isAvailable: undoAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={grid.undo}
            icon={<UndoIcon />}
            shortcut={KeyboardSymbols.Command + 'Z'}
          />
        );
      },
    },
    {
      label: redoAction.label,
      isAvailable: redoAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={grid.redo}
            icon={<RedoIcon />}
            shortcutModifiers={isMac ? [KeyboardSymbols.Command, KeyboardSymbols.Shift] : [KeyboardSymbols.Command]}
            shortcut={isMac ? 'Z' : 'Y'}
          />
        );
      },
    },

    {
      label: cutAction.label,
      isAvailable: cutAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={cutToClipboard}
            icon={<ScissorsIcon />}
            label={cutAction.label}
            shortcut={KeyboardSymbols.Command + 'X'}
          />
        );
      },
    },

    {
      label: copyAction.label,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={copyToClipboard}
            icon={<CopyIcon />}
            shortcut={KeyboardSymbols.Command + 'C'}
          />
        );
      },
    },

    {
      label: pasteAction.label,
      isAvailable: pasteAction.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={pasteFromClipboard}
            icon={<ClipboardIcon />}
            shortcut={KeyboardSymbols.Command + 'V'}
          />
        );
      },
    },

    {
      label: pasteActionValues.label,
      isAvailable: pasteActionValues.isAvailable,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={() => pasteFromClipboard(PasteSpecial.Values)}
            shortcut="V"
            shortcutModifiers={[KeyboardSymbols.Command, KeyboardSymbols.Shift]}
          />
        );
      },
    },
    {
      label: pasteActionFormats.label,
      isAvailable: pasteActionFormats.isAvailable,
      Component: (props) => {
        return <CommandPaletteListItem {...props} action={() => pasteFromClipboard(PasteSpecial.Formats)} />;
      },
    },
    {
      label: 'Copy selection as PNG',
      isAvailable: () => fullClipboardSupport(),
      Component: (props) => {
        const { addGlobalSnackbar } = useGlobalSnackbar();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => copySelectionToPNG(addGlobalSnackbar)}
            // icon={<ImageIcon />}
            shortcutModifiers={[KeyboardSymbols.Command, KeyboardSymbols.Shift]}
            shortcut="C"
          />
        );
      },
    },
    {
      label: downloadSelectionAsCsvAction.label,
      Component: (props) => {
        const { name: fileName } = useFileContext();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              downloadSelectionAsCsvAction.run({ fileName });
            }}
            shortcut="E"
            shortcutModifiers={[KeyboardSymbols.Command, KeyboardSymbols.Shift]}
          />
        );
      },
    },
    {
      label: 'Go to cell',
      Component: (props) => {
        const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => setEditorInteractionState({ ...editorInteractionState, showGoToMenu: true })}
            // icon={<ThickArrowRightIcon />}
            shortcut={KeyboardSymbols.Command + 'G'}
          />
        );
      },
    },
  ],
};

export default data;
