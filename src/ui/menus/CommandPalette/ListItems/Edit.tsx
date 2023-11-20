import { editorInteractionStateAtom } from '@/atoms/editorInteractionStateAtom';
import { useGlobalSnackbar } from '@/components/GlobalSnackbarProvider';
import {
  copySelectionToPNG,
  copyToClipboard,
  cutToClipboard,
  fullClipboardSupport,
  pasteFromClipboard,
} from '@/grid/actions/clipboard/clipboard';
import {
  ClipboardIcon,
  CopyIcon,
  ImageIcon,
  ResetIcon,
  ScissorsIcon,
  ThickArrowRightIcon,
} from '@radix-ui/react-icons';
import { useRecoilState } from 'recoil';
import { copy, cut, paste, redo, undo } from '../../../../actions';
import { grid } from '../../../../grid/controller/Grid';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { isMac } from '../../../../utils/isMac';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    isAvailable: undo.isAvailable,
    Component: () => {
      return (
        <CommandPaletteListItem
          action={grid.undo}
          Icon={<ResetIcon />}
          label={undo.label}
          shortcut={KeyboardSymbols.Command + 'Z'}
        />
      );
      // return (
      //   <CommandItem onSelect={grid.undo}>
      //     {undo.label}
      //     <CommandShortcut>{KeyboardSymbols.Command}Z</CommandShortcut>
      //   </CommandItem>
      // );
    },
  },
  {
    isAvailable: redo.isAvailable,
    Component: () => {
      return (
        <CommandPaletteListItem
          action={grid.redo}
          label={redo.label}
          Icon={<ResetIcon className={'rotate-180'} />}
          shortcutModifiers={isMac ? [KeyboardSymbols.Command, KeyboardSymbols.Shift] : [KeyboardSymbols.Command]}
          shortcut={isMac ? 'Z' : 'Y'}
        />
      );
      // return (
      //   <CommandItem onSelect={grid.redo}>
      //     {redo.label}
      //     <CommandShortcut>
      //       {isMac ? KeyboardSymbols.Command + KeyboardSymbols.Shift : KeyboardSymbols.Command}
      //       {isMac ? 'Z' : 'Y'}
      //     </CommandShortcut>
      //   </CommandItem>
      // );
    },
  },

  {
    isAvailable: cut.isAvailable,
    Component: () => {
      // TODO combine modifiers + shortcut
      return (
        <CommandPaletteListItem
          action={cutToClipboard}
          Icon={<ScissorsIcon />}
          label={cut.label}
          shortcut={KeyboardSymbols.Command + 'X'}
        />
      );
      // return (
      //   <CommandItem onSelect={cutToClipboard}>
      //     <ScissorsIcon className="mr-2" />
      //     {cut.label}
      //     <CommandShortcut>{KeyboardSymbols.Command}X</CommandShortcut>
      //   </CommandItem>
      // );
    },
  },

  {
    Component: () => {
      return (
        <CommandPaletteListItem
          action={copyToClipboard}
          Icon={<CopyIcon />}
          label={copy.label}
          shortcut={KeyboardSymbols.Command + 'C'}
        />
      );
      // return (
      //   <CommandItem onSelect={copyToClipboard}>
      //     <CopyIcon className="mr-2" />
      //     {copy.label}
      //     <CommandShortcut>{KeyboardSymbols.Command}C</CommandShortcut>
      //   </CommandItem>
      // );
    },
  },

  {
    isAvailable: paste.isAvailable,
    Component: () => {
      return (
        <CommandPaletteListItem
          action={pasteFromClipboard}
          Icon={<ClipboardIcon />}
          label={paste.label}
          shortcut={KeyboardSymbols.Command + 'V'}
        />
      );
      // return (
      //   <CommandItem onSelect={pasteFromClipboard}>
      //     <ClipboardIcon className="mr-2" />
      //     {paste.label}
      //     <CommandShortcut>{KeyboardSymbols.Command}V</CommandShortcut>
      //   </CommandItem>
      // );
    },
  },

  {
    isAvailable: () => fullClipboardSupport(),
    Component: () => {
      const { addGlobalSnackbar } = useGlobalSnackbar();
      return (
        <CommandPaletteListItem
          action={() => copySelectionToPNG(addGlobalSnackbar)}
          Icon={<ImageIcon />}
          label="Copy selection as PNG"
          shortcutModifiers={[KeyboardSymbols.Command, KeyboardSymbols.Shift]}
          shortcut="C"
        />
      );
      // return (
      //   <CommandItem
      //     onSelect={() => {
      //       copySelectionToPNG(addGlobalSnackbar);
      //     }}
      //   >
      //     <ImageIcon className="mr-2" />
      //     Copy selection as PNG
      //     <CommandShortcut>{KeyboardSymbols.Command + KeyboardSymbols.Shift}C</CommandShortcut>
      //   </CommandItem>
      // );
    },
  },
  {
    label: 'Go to',
    Component: () => {
      const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
      return (
        <CommandPaletteListItem
          action={() => setEditorInteractionState({ ...editorInteractionState, showGoToMenu: true })}
          Icon={<ThickArrowRightIcon />}
          label="Go to"
          shortcut={KeyboardSymbols.Command + 'G'}
        />
      );
      // return (
      //   <CommandItem
      //     onSelect={() => {
      //       setEditorInteractionState({
      //         ...editorInteractionState,
      //         showGoToMenu: true,
      //       });
      //     }}
      //   >
      //     <ThickArrowRightIcon className="mr-2" />
      //     Go to
      //     <CommandShortcut>{KeyboardSymbols.Command}G</CommandShortcut>
      //   </CommandItem>
      // );
    },
  },
];

export default ListItems;
