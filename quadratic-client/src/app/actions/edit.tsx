import { RedoIcon, UndoIcon } from '@/shared/components/Icons';

export const editUndo = {
  label: 'Undo',
  keyboardShortcut: '⌘Z',
  Icon: UndoIcon,
  // isAvailable: (args) => args.filePermissions.includes('EDIT')
  run: () => {},
};

export const editRedo = {
  label: 'Redo',
  keyboardShortcut: '⇧⌘Z',
  Icon: RedoIcon,
  // isAvailable
  run: () => {},
};
