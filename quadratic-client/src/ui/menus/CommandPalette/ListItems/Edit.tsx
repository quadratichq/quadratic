import { useFileContext } from '@/ui/components/FileProvider';
import { ContentCopy, ContentCut, ContentPaste, Download, East, Redo, Undo } from '@mui/icons-material';
import { useRecoilState } from 'recoil';
import {
  copyAction,
  cutAction,
  downloadSelectionAsCsvAction,
  pasteAction,
  redoAction,
  undoAction,
} from '../../../../actions';
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
import { CopyAsPNG } from '../../../icons';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: undoAction.label,
    isAvailable: undoAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<Undo />}
          action={grid.undo}
          shortcut="Z"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: redoAction.label,
    isAvailable: redoAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<Redo />}
          action={grid.redo}
          shortcut={isMac ? 'Z' : 'Y'}
          shortcutModifiers={isMac ? [KeyboardSymbols.Command, KeyboardSymbols.Shift] : [KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: cutAction.label,
    isAvailable: cutAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={cutToClipboard}
          icon={<ContentCut />}
          shortcut="X"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: copyAction.label,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={copyToClipboard}
          icon={<ContentCopy />}
          shortcut="C"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: pasteAction.label,
    isAvailable: pasteAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={pasteFromClipboard}
          icon={<ContentPaste />}
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
          icon={<CopyAsPNG />}
          shortcut="C"
          shortcutModifiers={[KeyboardSymbols.Command, KeyboardSymbols.Shift]}
        />
      );
    },
  },
  {
    label: downloadSelectionAsCsvAction.label,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { name: fileName } = useFileContext();
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            downloadSelectionAsCsvAction.run({ fileName });
          }}
          icon={<Download />}
          shortcut="E"
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
          icon={<East />}
          shortcut="G"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
];

export default ListItems;
