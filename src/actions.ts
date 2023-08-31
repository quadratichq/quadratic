import { NavigateFunction, SubmitFunction } from 'react-router-dom';
import { SetterOrUpdater } from 'recoil';
import { apiClient } from './api/apiClient';
import { Permission, PermissionSchema } from './api/types';
import { EditorInteractionState } from './atoms/editorInteractionStateAtom';
import { GlobalSnackbar } from './components/GlobalSnackbarProvider';
import { ROUTES } from './constants/routes';
import { DOCUMENTATION_URL } from './constants/urls';
import { downloadFileInBrowser } from './helpers/downloadFileInBrowser';
import { GridFile, GridFileSchema } from './schemas';
import { FileContextType } from './ui/components/FileProvider';
const { OWNER, EDITOR, VIEWER } = PermissionSchema.enum;

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
  run({ name, contents }: { name: FileContextType['name']; contents: FileContextType['contents'] }) {
    downloadFileInBrowser(name, JSON.stringify(contents));
  },
};

export const deleteFile = {
  label: 'Delete',
  isAvailable: isOwner,
  // TODO enhancement: handle this async operation in the UI similar to /files/create
  async run({ uuid, addGlobalSnackbar }: { uuid: string; addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'] }) {
    if (window.confirm('Please confirm you want to delete this file.')) {
      try {
        await apiClient.deleteFile(uuid);
        window.location.href = ROUTES.FILES;
      } catch (e) {
        addGlobalSnackbar('Failed to delete file. Try again.', { severity: 'error' });
      }
    }
  },
};

export const provideFeedback = {
  label: 'Feedback',
  isAvailable: isViewerOrAbove,
  run({ setEditorInteractionState }: { setEditorInteractionState: SetterOrUpdater<EditorInteractionState> }) {
    setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
  },
};

export const viewDocs = {
  label: 'Docs',
  run() {
    window.open(DOCUMENTATION_URL, '_blank')?.focus();
  },
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
