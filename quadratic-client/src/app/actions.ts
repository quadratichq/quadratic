import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { downloadFile, downloadQuadraticFile } from '@/app/helpers/downloadFileInBrowser';
import { FileContextType } from '@/app/ui/components/FileProvider';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Action } from '@/routes/files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import { FilePermission, FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { NavigateFunction, SubmitFunction } from 'react-router-dom';
import { SetterOrUpdater } from 'recoil';
const { FILE_EDIT, FILE_DELETE } = FilePermissionSchema.enum;

export type GenericAction = {
  label: string;
  isAvailable?: (permissions: FilePermission[], isAuthenticated: boolean) => boolean;
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

// TODO: create generic hasPermission(permission, permissionToCheck) function

export const hasPermissionToEditFile = (permissions: FilePermission[], isAuthenticated?: boolean) =>
  permissions.includes(FILE_EDIT);
const isLoggedIn = (permissions: FilePermission[], isAuthenticated: boolean) => isAuthenticated;

export const createNewFileAction = {
  label: 'Create',
  isAvailable: isLoggedIn,
  run({ navigate }: { navigate: NavigateFunction }) {
    navigate(ROUTES.CREATE_FILE);
  },
};

export const renameFileAction = {
  label: 'Rename',
  isAvailable: hasPermissionToEditFile,
};

export const duplicateFileWithUserAsOwnerAction = {
  label: 'Duplicate in my files',
  isAvailable: isLoggedIn,
  async run({ uuid, submit }: { uuid: string; submit: SubmitFunction }) {
    const data = { action: 'duplicate', redirect: true, withCurrentOwner: false } as Action['request.duplicate'];
    submit(data, { method: 'POST', action: `/files/${uuid}`, encType: 'application/json' });
  },
};

export const duplicateFileWithCurrentOwnerAction = {
  label: 'Duplicate',
  isAvailable: isLoggedIn,
  async run({ uuid, submit }: { uuid: string; submit: SubmitFunction }) {
    const data = { action: 'duplicate', redirect: true, withCurrentOwner: true } as Action['request.duplicate'];
    submit(data, { method: 'POST', action: `/files/${uuid}`, encType: 'application/json' });
  },
};

export const downloadFileAction = {
  label: 'Download',
  isAvailable: isLoggedIn,
  async run({ name }: { name: FileContextType['name'] }) {
    downloadQuadraticFile(name, await quadraticCore.export());
  },
};

export const deleteFile = {
  label: 'Delete',
  isAvailable: (permissions: FilePermission[]) => permissions.includes(FILE_DELETE),
  // TODO: (enhancement) handle this async operation in the UI similar to /files/create
  async run({ uuid, addGlobalSnackbar }: { uuid: string; addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'] }) {
    if (window.confirm('Please confirm you want to delete this file.')) {
      try {
        await apiClient.files.delete(uuid);
        window.location.href = ROUTES.FILES;
      } catch (e) {
        addGlobalSnackbar('Failed to delete file. Try again.', { severity: 'error' });
      }
    }
  },
};

export const provideFeedbackAction = {
  label: 'Feedback',
  isAvailable: isLoggedIn,
  run({ setEditorInteractionState }: { setEditorInteractionState: SetterOrUpdater<EditorInteractionState> }) {
    setEditorInteractionState((prevState) => ({ ...prevState, showFeedbackMenu: true }));
  },
};

export const viewDocsAction = {
  label: 'Docs',
  run() {
    window.open(DOCUMENTATION_URL, '_blank')?.focus();
  },
};

export const cutAction = {
  label: 'Cut',
  isAvailable: hasPermissionToEditFile,
};

export const pasteAction = {
  label: 'Paste',
  isAvailable: hasPermissionToEditFile,
};

export const pasteActionValues = {
  label: 'Paste values only',
  isAvailable: hasPermissionToEditFile,
};

export const pasteActionFormats = {
  label: 'Paste formats only',
  isAvailable: hasPermissionToEditFile,
};

export const undoAction = {
  label: 'Undo',
  isAvailable: hasPermissionToEditFile,
};

export const redoAction = {
  label: 'Redo',
  isAvailable: hasPermissionToEditFile,
};

export const copyAction = {
  label: 'Copy',
};

export const rerunCellAction = {
  label: 'Run this code cell',
  isAvailable: hasPermissionToEditFile,
};

export const rerunAction = {
  label: 'Run all code cells in the file',
  isAvailable: hasPermissionToEditFile,
};

export const rerunSheetAction = {
  label: 'Run all code cells in the current sheet',
  isAvailable: hasPermissionToEditFile,
};

export const downloadSelectionAsCsvAction = {
  label: 'Download selection as CSV',
  async run({ fileName }: { fileName: string }) {
    downloadFile(fileName, await quadraticCore.exportCsvSelection(), 'text/plain', 'csv');
  },
};

export const findInSheet = {
  label: 'Find in current sheet',
};
export const findInSheets = {
  label: 'Find in all sheets',
};

export const importSql = {
  label: 'Import SQL',
  async run({ query, addGlobalSnackbar }: { query: string; addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'] }) {
    let { x, y } = sheets.sheet.cursor.cursorPosition;
    let statement = await quadraticCore.getEditCell(sheets.sheet.id, x, y);

    const start = Date.now();

    // const statement = 'select * from "FileCheckpoint" limit 5';
    const url = `http://localhost:3003/query_sql?statement=${encodeURIComponent(statement || '')}`;

    addGlobalSnackbar(`Downloading SQL: ${statement}`);

    const response = await fetch(url);

    let buffer = await response.arrayBuffer();

    addGlobalSnackbar(`Completed in ${Date.now() - start} ms`);

    await quadraticCore.importSql(sheets.sheet.id, buffer, 'sql', { x, y: y + 1 });
  },
};
