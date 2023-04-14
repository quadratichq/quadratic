import { CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';
import { CommandPaletteListItem } from '../CommandPaletteListItem';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../../../../grid/actions/clipboard/clipboard';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { ContentCopy, ContentPaste, ContentCut, East } from '@mui/icons-material';
import { useRecoilState } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { Undo, Redo } from '@mui/icons-material';
import { isMac } from '../../../../utils/isMac';
import { copyAsPNG } from '../../../../gridGL/pixiApp/copyAsPNG';
import { CopyAsPNG } from '../../../icons';

const ListItems = [
  {
    label: 'Undo',
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          {...props}
          icon={<Undo />}
          action={() => {
            props.sheetController.undo();
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
            props.sheetController.redo();
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
            cutToClipboard(
              props.sheetController,
              {
                x: props.interactionState.multiCursorPosition.originPosition.x,
                y: props.interactionState.multiCursorPosition.originPosition.y,
              },
              {
                x: props.interactionState.multiCursorPosition.terminalPosition.x,
                y: props.interactionState.multiCursorPosition.terminalPosition.y,
              }
            );
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
            copyToClipboard(
              props.sheetController,
              props.interactionState.multiCursorPosition.originPosition,
              props.interactionState.multiCursorPosition.terminalPosition
            );
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
            pasteFromClipboard(props.sheetController, props.interactionState.cursorPosition);
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
      return (
        <CommandPaletteListItem
          {...props}
          action={() => {
            copyAsPNG(props.app);
            props.snackBar.triggerSnackbar('Copied selection as PNG to clipboard');
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
