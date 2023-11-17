import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '@/components/GlobalSnackbarProvider';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  fullClipboardSupport,
  pasteFromClipboard,
} from '@/grid/actions/clipboard/clipboard';
import { CommandItem, CommandShortcut } from '@/shadcn/ui/command';
import { useRecoilState } from 'recoil';
import { copy, cut, paste, redo, undo } from '../../../../actions';
import { grid } from '../../../../grid/controller/Grid';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { isMac } from '../../../../utils/isMac';

const ListItems = [
  {
    isAvailable: undo.isAvailable,
    Component: () => {
      return (
        <CommandItem onSelect={grid.undo}>
          {undo.label}
          <CommandShortcut>{KeyboardSymbols.Command}Z</CommandShortcut>
        </CommandItem>
      );
    },
  },
  {
    isAvailable: redo.isAvailable,
    Component: () => {
      return (
        <CommandItem onSelect={grid.redo}>
          {redo.label}
          <CommandShortcut>
            {isMac ? KeyboardSymbols.Command + KeyboardSymbols.Shift : KeyboardSymbols.Command}
            {isMac ? 'Z' : 'Y'}
          </CommandShortcut>
        </CommandItem>
      );
    },
  },

  {
    isAvailable: cut.isAvailable,
    Component: () => {
      return (
        <CommandItem onSelect={cutToClipboard}>
          {cut.label}
          <CommandShortcut>{KeyboardSymbols.Command}X</CommandShortcut>
        </CommandItem>
      );
    },
  },

  {
    Component: () => {
      return (
        <CommandItem onSelect={copyToClipboard}>
          {copy.label}
          <CommandShortcut>{KeyboardSymbols.Command}C</CommandShortcut>
        </CommandItem>
      );
    },
  },

  {
    isAvailable: paste.isAvailable,
    Component: () => {
      return (
        <CommandItem onSelect={pasteFromClipboard}>
          {paste.label}
          <CommandShortcut>{KeyboardSymbols.Command}V</CommandShortcut>
        </CommandItem>
      );
    },
  },

  {
    isAvailable: () => fullClipboardSupport(),
    Component: () => {
      const { addGlobalSnackbar } = useGlobalSnackbar();

      return (
        <CommandItem
          onSelect={() => {
            copySelectionToPNG(addGlobalSnackbar);
          }}
        >
          Copy selection as PNG
          <CommandShortcut>{KeyboardSymbols.Command + KeyboardSymbols.Shift}C</CommandShortcut>
        </CommandItem>
      );
    },
  },
  {
    label: 'Go to',
    Component: () => {
      const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
      return (
        <CommandItem
          onSelect={() => {
            setEditorInteractionState({
              ...editorInteractionState,
              showGoToMenu: true,
            });
          }}
        >
          Go to
          <CommandShortcut>{KeyboardSymbols.Command}G</CommandShortcut>
        </CommandItem>
      );
    },
  },
];

export default ListItems;
