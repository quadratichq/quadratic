import {
  copyAction,
  cutAction,
  downloadSelectionAsCsvAction,
  findInSheet,
  findInSheets,
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
import { useFileContext } from '@/app/ui/components/FileProvider';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import {
  CopyAsCsv,
  CopyAsPng,
  CutIcon,
  FileCopyIcon,
  FindInFileIcon,
  GoToIcon,
  PasteIcon,
  RedoIcon,
  UndoIcon,
} from '@/shared/components/Icons';
import { isMac } from '@/shared/utils/isMac';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
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
            icon={<CutIcon />}
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
            icon={<FileCopyIcon />}
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
            icon={<PasteIcon />}
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
            icon={<PasteIcon />}
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
        return <CommandPaletteListItem {...props} icon={<PasteIcon />} action={() => pasteFromClipboard('Formats')} />;
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
            icon={<GoToIcon />}
            shortcut={KeyboardSymbols.Command + 'G'}
          />
        );
      },
    },
    {
      label: findInSheet.label,
      keywords: ['search'],
      Component: (props) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => setEditorInteractionState((state) => ({ ...state, showSearch: true }))}
            icon={<FindInFileIcon />}
            shortcut="F"
            shortcutModifiers={KeyboardSymbols.Command}
          />
        );
      },
    },
    {
      label: findInSheets.label,
      keywords: ['search'],
      Component: (props) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => setEditorInteractionState((state) => ({ ...state, showSearch: { sheet_id: undefined } }))}
            icon={<FindInFileIcon />}
            shortcut="F"
            shortcutModifiers={[KeyboardSymbols.Shift, KeyboardSymbols.Command]}
          />
        );
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
            icon={<CopyAsPng />}
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
            icon={<CopyAsCsv />}
            shortcut="E"
            shortcutModifiers={[KeyboardSymbols.Command, KeyboardSymbols.Shift]}
          />
        );
      },
    },
  ],
};

export default data;
