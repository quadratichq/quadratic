import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { downloadFile, downloadQuadraticFile } from '@/app/helpers/downloadFileInBrowser';
import { FileContextType } from '@/app/ui/components/FileProvider';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { getActionFileDuplicate } from '@/routes/api.files.$uuid';
import { apiClient } from '@/shared/api/apiClient';
import { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { DOCUMENTATION_URL } from '@/shared/constants/urls';
import { ApiTypes, FilePermission, FilePermissionSchema, TeamPermission } from 'quadratic-shared/typesAndSchemas';
import { SubmitFunction } from 'react-router-dom';
import { SetterOrUpdater } from 'recoil';
const { FILE_EDIT, FILE_DELETE } = FilePermissionSchema.enum;

type IsAvailableArgs = {
  filePermissions: FilePermission[];
  isAuthenticated: boolean;
  teamPermissions: TeamPermission[] | undefined;
  fileTeamPrivacy: ApiTypes['/v0/files/:uuid.GET.response']['userMakingRequest']['fileTeamPrivacy'];
};

export type GenericAction = {
  label: string;
  isAvailable?: (args: IsAvailableArgs) => boolean;
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

// These are functions that can be used elsewhere in the code base to check permissions.
// They’re more narrow than the generic `isAvailable` functions.
export const hasPermissionToEditFile = (filePermissions: FilePermission[]) => filePermissions.includes(FILE_EDIT);

// These are functions specific to kinds of actions that take the generic isAvailable fn signature
// They are shared between actions here and command palette actions
export const isAvailableBecauseCanEditFile = ({ filePermissions }: IsAvailableArgs) =>
  hasPermissionToEditFile(filePermissions);
const isAvailableBecauseLoggedIn = ({ isAuthenticated }: IsAvailableArgs) => isAuthenticated;
export const isAvailableBecauseFileLocationIsAccessibleAndWriteable = ({
  fileTeamPrivacy,
  teamPermissions,
}: IsAvailableArgs) => Boolean(fileTeamPrivacy) && Boolean(teamPermissions?.includes('TEAM_EDIT'));

export const createNewFileAction = {
  label: 'New',
  isAvailable: isAvailableBecauseFileLocationIsAccessibleAndWriteable,
  run({ setEditorInteractionState }: { setEditorInteractionState: SetterOrUpdater<EditorInteractionState> }) {
    setEditorInteractionState((prevState) => ({ ...prevState, showNewFileMenu: true }));
  },
};

export const renameFileAction = {
  label: 'Rename',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const duplicateFileAction = {
  label: 'Duplicate',
  isAvailable: isAvailableBecauseFileLocationIsAccessibleAndWriteable,
  async run({ uuid, submit }: { uuid: string; submit: SubmitFunction }) {
    const data = getActionFileDuplicate({ redirect: true, isPrivate: true });
    submit(data, { method: 'POST', action: ROUTES.API.FILE(uuid), encType: 'application/json' });
  },
};

export const downloadFileAction = {
  label: 'Download',
  isAvailable: isAvailableBecauseLoggedIn,
  async run({ name }: { name: FileContextType['name'] }) {
    downloadQuadraticFile(name, await quadraticCore.export());
  },
};

export const deleteFile = {
  label: 'Delete',
  isAvailable: ({ filePermissions }: IsAvailableArgs) => filePermissions.includes(FILE_DELETE),
  // TODO: (enhancement) handle this async operation in the UI similar to /files/create
  async run({ uuid, addGlobalSnackbar }: { uuid: string; addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'] }) {
    if (window.confirm('Please confirm you want to delete this file.')) {
      try {
        await apiClient.files.delete(uuid);
        window.location.href = '/';
      } catch (e) {
        addGlobalSnackbar('Failed to delete file. Try again.', { severity: 'error' });
      }
    }
  },
};

export const provideFeedbackAction = {
  label: 'Feedback',
  isAvailable: isAvailableBecauseLoggedIn,
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
  isAvailable: isAvailableBecauseCanEditFile,
};

export const pasteAction = {
  label: 'Paste',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const pasteActionValues = {
  label: 'Paste values only',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const pasteActionFormats = {
  label: 'Paste formats only',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const undoAction = {
  label: 'Undo',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const redoAction = {
  label: 'Redo',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const copyAction = {
  label: 'Copy',
};

export const rerunCellAction = {
  label: 'Run this code cell',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const rerunAction = {
  label: 'Run all code cells in the file',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const rerunSheetAction = {
  label: 'Run all code cells in the current sheet',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const downloadSelectionAsCsvAction = {
  label: 'Download selection as CSV',
  async run({ fileName }: { fileName: string }) {
    downloadFile(fileName, await quadraticCore.exportCsvSelection(sheets.getRustSelection()), 'text/plain', 'csv');
  },
};

export const dataValidations = {
  label: 'Data Validations',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const findInSheet = {
  label: 'Find in current sheet',
};
export const findInSheets = {
  label: 'Find in all sheets',
};

export const resizeColumnAction = {
  label: 'Resize column to fit data',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const validationAction = {
  label: 'Data Validations',
  isAvailable: isAvailableBecauseCanEditFile,
};
