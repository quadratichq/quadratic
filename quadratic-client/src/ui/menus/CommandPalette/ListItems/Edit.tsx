import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  fullClipboardSupport,
  pasteFromClipboard,
} from '@/grid/actions/clipboard/clipboard';
import { useFileContext } from '@/ui/components/FileProvider';
import { Download } from '@mui/icons-material';
import {
  ClipboardIcon,
  CopyIcon,
  ImageIcon,
  ResetIcon,
  ScissorsIcon,
  ThickArrowRightIcon,
} from '@radix-ui/react-icons';
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
import { grid } from '../../../../grid/controller/Grid';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { isMac } from '../../../../utils/isMac';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: undoAction.label,
    isAvailable: undoAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          action={grid.undo}
          icon={<ResetIcon />}
          label={undoAction.label}
          shortcut={KeyboardSymbols.Command + 'Z'}
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
          action={grid.redo}
          label={redoAction.label}
          icon={<ResetIcon className={'rotate-180'} />}
          shortcutModifiers={isMac ? [KeyboardSymbols.Command, KeyboardSymbols.Shift] : [KeyboardSymbols.Command]}
          shortcut={isMac ? 'Z' : 'Y'}
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
    Component: (props: CommandPaletteListItemSharedProps) => {
      return (
        <CommandPaletteListItem
          action={copyToClipboard}
          icon={<CopyIcon />}
          label={copyAction.label}
          shortcut={KeyboardSymbols.Command + 'C'}
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
          action={pasteFromClipboard}
          icon={<ClipboardIcon />}
          label={pasteAction.label}
          shortcut={KeyboardSymbols.Command + 'V'}
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
          action={() => copySelectionToPNG(addGlobalSnackbar)}
          icon={<ImageIcon />}
          shortcutModifiers={[KeyboardSymbols.Command, KeyboardSymbols.Shift]}
          shortcut="C"
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
          action={() => setEditorInteractionState({ ...editorInteractionState, showGoToMenu: true })}
          icon={<ThickArrowRightIcon />}
          label="Go to"
          shortcut={KeyboardSymbols.Command + 'G'}
        />
      );
    },
  },
];

export default ListItems;
