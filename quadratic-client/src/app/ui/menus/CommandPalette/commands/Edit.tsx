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
} from '@/app/actions';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  fullClipboardSupport,
  pasteFromClipboard,
} from '@/app/grid/actions/clipboard/clipboard';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { ClipboardIcon, CopyIcon, RedoIcon, ScissorsIcon, UndoIcon } from '@/app/ui/icons';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { isMac } from '@/shared/utils/isMac';

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
            action={quadraticCore.undo}
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
            action={quadraticCore.redo}
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
            action={() => pasteFromClipboard('Values')}
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
        return <CommandPaletteListItem {...props} action={() => pasteFromClipboard('Formats')} />;
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
            action={() =>
              setEditorInteractionState({ ...editorInteractionState, showCommandPalette: false, showGoToMenu: true })
            }
            // icon={<ThickArrowRightIcon />}
            shortcut={KeyboardSymbols.Command + 'G'}
          />
        );
      },
    },
  ],
};

export default data;
