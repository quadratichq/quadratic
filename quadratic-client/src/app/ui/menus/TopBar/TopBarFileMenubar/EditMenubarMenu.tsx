import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import {
  CopyAsCsv,
  CopyAsPng,
  CopyIcon,
  CutIcon,
  FindInFileIcon,
  GoToIcon,
  PasteIcon,
  RedoIcon,
  UndoIcon,
} from '@/shared/components/Icons';
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from '@/shared/shadcn/ui/menubar';

export const EditMenubarMenu = () => {
  return (
    <MenubarMenu>
      <MenubarTrigger>Edit</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>
          <UndoIcon />
          Undo
          <MenubarShortcut>{KeyboardSymbols.Command + 'Z'}</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>
          <RedoIcon />
          Redo
          <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'Z'}</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem>
          <CutIcon />
          Cut
          <MenubarShortcut>{KeyboardSymbols.Command + 'X'}</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>
          <CopyIcon />
          Copy
          <MenubarShortcut>{KeyboardSymbols.Command + 'C'}</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>
          <PasteIcon />
          Paste
          <MenubarShortcut>{KeyboardSymbols.Command + 'V'}</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>
          <PasteIcon />
          Paste values only
          <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'V'}</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>
          <PasteIcon />
          Paste formatting only
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem>
          <GoToIcon />
          Go to
        </MenubarItem>
        <MenubarItem>
          <FindInFileIcon />
          Find in current sheet
        </MenubarItem>
        <MenubarItem>
          <FindInFileIcon />
          Find in all sheets
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem>
          <CopyAsPng />
          Copy selection as PNG{' '}
          <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'C'}</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>
          <CopyAsCsv />
          Download selection as CSV{' '}
          <MenubarShortcut>{KeyboardSymbols.Shift + KeyboardSymbols.Command + 'E'}</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
};
