import { NavigateFunction, SubmitFunction } from 'react-router-dom';
import { Permission, permissionSchema } from './api/types';
import { ROUTES } from './constants/routes';
import { GridFile, GridFileSchema } from './schemas';
const { OWNER, EDITOR, VIEWER } = permissionSchema.enum;

export type GenericAction = {
  label: string;
  isAvailable?: (permission: Permission) => boolean;
  run?: (args: any) => void;

  // Future shortcuts
  //
  // In most cases there will be just one keyboard shortcut.
  // However, some shortcuts can have multiple triggers, like the command palette
  // Only one will be "canonical" (e.g. the one we show in the UI as the trigger)
  // Which, if an array, will always be the first one
  //
  // type Shortcut = {
  //   // Should map to the key used in code, e.g. `event.key === shortcut.key`
  //   key: string;
  //   // These will map to KeyboardSymbols to show `⌘⇧Z` in UI
  //   modifiers: Array<'shiftKey' | 'metaKey' | 'ctrlKey'>;
  // }
  //
  // Example redo:
  // shortcut: {
  //   key: 'z',
  //   modifiers: ['metaKey']
  // }
  //
  // Example command palette:
  // shortcuts: [
  //  { key: 'p', modifiers: ['metaKey', 'shiftKey'] },
  //  { key: 'k', modifiers: ['metaKey', 'shiftKey'] },
  //  { key: '\', modifiers: ['metaKey', 'shiftKey'] }
  // ]
  //
  // shortcut: Shortcut[] | Shortcut
};

export const isOwner = (permission: Permission) => permission === OWNER;
export const isEditorOrAbove = (permission: Permission) => permission === EDITOR || isOwner(permission);
export const isViewerOrAbove = (permission: Permission) => permission === VIEWER || isEditorOrAbove(permission);

export const createNewFile = {
  label: 'New',
  isAvailable: isViewerOrAbove,
  run({ navigate }: { navigate: NavigateFunction }) {
    navigate(ROUTES.CREATE_FILE);
  },
};

export const renameFile = {
  label: 'Rename',
  isAvailable: isOwner,
};

export const duplicateFile = {
  label: 'Duplicate',
  isAvailable: isViewerOrAbove,
  run({ contents, name, submit }: { name: string; contents: GridFile; submit: SubmitFunction }) {
    let formData = new FormData();
    formData.append('name', name + ' (Copy)');
    formData.append('contents', JSON.stringify(contents));
    formData.append('version', GridFileSchema.shape.version.value);
    submit(formData, { method: 'POST', action: ROUTES.CREATE_FILE });
  },
};

export const downloadFile = {
  label: 'Download local copy',
  isAvailable: isViewerOrAbove,
};

export const deleteFile = {
  label: 'Delete',
  isAvailable: isOwner,
};

export const provideFeedback = {
  label: 'Feedback',
  isAvailable: isViewerOrAbove,
};

export const cut = {
  label: 'Cut',
  isAvailable: isEditorOrAbove,
};

export const paste = {
  label: 'Paste',
  isAvailable: isEditorOrAbove,
};

export const undo = {
  label: 'Undo',
  isAvailable: isEditorOrAbove,
};

export const redo = {
  label: 'Redo',
  isAvailable: isEditorOrAbove,
};

export const copy = {
  label: 'Copy',
};
