import { useRecoilState } from 'recoil';
import { copy, cut, paste, redo, undo } from '../../../../actions';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  fullClipboardSupport,
  pasteFromClipboard,
} from '../../../../grid/actions/clipboard/clipboard';
import { grid } from '../../../../grid/controller/Grid';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { isMac } from '../../../../utils/isMac';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: undo.label,
    isAvailable: undo.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={grid.undo}
          shortcut="Z"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: redo.label,
    isAvailable: redo.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={grid.redo}
          shortcut={isMac ? 'Z' : 'Y'}
          shortcutModifiers={isMac ? [KeyboardSymbols.Command, KeyboardSymbols.Shift] : [KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: cut.label,
    isAvailable: cut.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={cutToClipboard}
          shortcut="X"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: copy.label,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={copyToClipboard}
          shortcut="C"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: paste.label,
    isAvailable: paste.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={pasteFromClipboard}
          shortcut="V"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: 'Copy selection as PNG',
    isAvailable: () => fullClipboardSupport(),
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { addGlobalSnackbar } = useGlobalSnackbar();
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            copySelectionToPNG(addGlobalSnackbar);
          }}
          shortcut="C"
          shortcutModifiers={[KeyboardSymbols.Command, KeyboardSymbols.Shift]}
        />
      );
    },
  },
  {
    label: 'Go to',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);

      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            setEditorInteractionState({
              ...editorInteractionState,
              showGoToMenu: true,
            });
          }}
          shortcut="G"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
];

export default ListItems;
