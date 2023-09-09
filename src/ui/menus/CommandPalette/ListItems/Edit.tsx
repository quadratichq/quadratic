import { ContentCopy, ContentCut, ContentPaste, East, Redo, Undo } from '@mui/icons-material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbar';
import { PNG_MESSAGE } from '../../../../constants/appConstants';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../../../../grid/actions/clipboard/clipboard';
import { sheetController } from '../../../../grid/controller/SheetController';
import { copyAsPNG } from '../../../../gridGL/pixiApp/copyAsPNG';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { isMac } from '../../../../utils/isMac';
import { CopyAsPNG } from '../../../icons';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'Undo',
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<Undo />}
          action={() => {
            sheetController.undo();
          }}
          shortcut="Z"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: 'Redo',
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<Redo />}
          action={() => {
            sheetController.redo();
          }}
          shortcut={isMac ? 'Z' : 'Y'}
          shortcutModifiers={isMac ? [KeyboardSymbols.Command, KeyboardSymbols.Shift] : [KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: 'Cut',
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            const cursor = sheetController.sheet.cursor;
            cutToClipboard(cursor.originPosition, cursor.terminalPosition);
          }}
          icon={<ContentCut />}
          shortcut="X"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: 'Copy',
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            const cursor = sheetController.sheet.cursor;
            copyToClipboard(cursor.originPosition, cursor.terminalPosition);
          }}
          icon={<ContentCopy />}
          shortcut="C"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: 'Paste',
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            pasteFromClipboard(sheetController.sheet.cursor.cursorPosition);
          }}
          icon={<ContentPaste />}
          shortcut="V"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
  {
    label: 'Copy selection as PNG',
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { addGlobalSnackbar } = useGlobalSnackbar();
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            copyAsPNG();
            addGlobalSnackbar(PNG_MESSAGE);
          }}
          icon={<CopyAsPNG />}
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
          icon={<East />}
          shortcut="G"
          shortcutModifiers={[KeyboardSymbols.Command]}
        />
      );
    },
  },
];

export default ListItems;
