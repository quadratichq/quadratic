import type { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { getActiveTeam } from '@/dashboard/shared/getActiveTeam';
import { getActionFileDelete, getActionFileDuplicate } from '@/routes/api.files.$uuid';
import type { GlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { type FileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import type { ApiTypes, FilePermission, TeamPermission } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import type { SubmitFunction } from 'react-router-dom';
import type { SetterOrUpdater } from 'recoil';

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
export const isAvailableBecauseLoggedIn = ({ isAuthenticated }: IsAvailableArgs) => isAuthenticated;
export const isAvailableBecauseFileLocationIsAccessibleAndWriteable = ({
  fileTeamPrivacy,
  teamPermissions,
}: IsAvailableArgs) => Boolean(fileTeamPrivacy) && Boolean(teamPermissions?.includes('TEAM_EDIT'));

export const createNewFileAction = {
  label: 'New',
  isAvailable: isAvailableBecauseFileLocationIsAccessibleAndWriteable,
  run({ teamUuid }: { teamUuid: string }) {
    window.location.href = ROUTES.CREATE_FILE(teamUuid, { private: true });
  },
};

export const duplicateFileAction = {
  label: 'Duplicate',
  isAvailable: isAvailableBecauseLoggedIn,
  async run({
    fileRouteLoaderData,
    submit,
    addGlobalSnackbar,
  }: {
    fileRouteLoaderData: FileRouteLoaderData;
    submit: SubmitFunction;
    addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
  }) {
    const {
      file: { uuid: fileUuid },
      team: { uuid: teamUuid },
      userMakingRequest: { teamPermissions },
    } = fileRouteLoaderData;

    // By default, duplicate the file to the user's currently active team
    // But if the user doesn't have permission to edit that team, duplicate it to
    // the team they _do_ have access to
    let teamUuidWhereWeDuplicateFileTo = teamUuid;
    if (!(teamPermissions && teamPermissions.includes('TEAM_EDIT'))) {
      let teamUuidFromLocalStorage = getActiveTeam();
      if (!teamUuidFromLocalStorage) {
        throw new Error('No team UUID found');
      }
      teamUuidWhereWeDuplicateFileTo = teamUuidFromLocalStorage;
    }

    try {
      const data = getActionFileDuplicate({
        redirect: true,
        isPrivate: true,
        teamUuid: teamUuidWhereWeDuplicateFileTo,
      });
      submit(data, { method: 'POST', action: ROUTES.API.FILE(fileUuid), encType: 'application/json' });
    } catch (e) {
      addGlobalSnackbar('Failed to duplicate file. Try again.', { severity: 'error' });
    }
  },
};

export const deleteFile = {
  label: 'Delete',
  isAvailable: ({ filePermissions }: IsAvailableArgs) => filePermissions.includes(FILE_DELETE),
  // TODO: (enhancement) handle this async operation in the UI similar to /files/create
  async run({
    fileUuid,
    userEmail,
    redirect,
    submit,
    addGlobalSnackbar,
  }: {
    fileUuid: string;
    userEmail: string;
    redirect: boolean;
    submit: SubmitFunction;
    addGlobalSnackbar: GlobalSnackbar['addGlobalSnackbar'];
  }) {
    if (window.confirm('Please confirm you want to delete this file.')) {
      try {
        const data = getActionFileDelete({ userEmail, redirect });
        submit(data, { method: 'POST', action: ROUTES.API.FILE(fileUuid), encType: 'application/json' });
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

export const dataValidations = {
  label: 'Data Validations',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const resizeColumnAction = {
  label: 'Resize column to fit data',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const validationAction = {
  label: 'Data Validations',
  isAvailable: isAvailableBecauseCanEditFile,
};

// Data Table Actions

export const gridToDataTableAction = {
  label: 'Convert to data table',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const flattenDataTableAction = {
  label: 'Flatten',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const toggleFirstRowAsHeaderAction = {
  label: 'Toggle 1st row as column headers',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const toggleTableColumnsAction = {
  label: 'Toggle show column headings',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const deleteDataTableAction = {
  label: 'Delete',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const codeToDataTableAction = {
  label: 'Convert to Table (editable)',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const sortDataTableAction = {
  label: 'Sort Data Table',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const toggleTableAlternatingColorsAction = {
  label: 'Toggle show alternating colors',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const sortTableColumnAscendingAction = {
  label: 'Sort column ascending',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const sortTableColumnDescendingAction = {
  label: 'Sort column descending',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const insertTableColumnLeftAction = {
  label: 'Insert column left',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const insertTableColumnRightAction = {
  label: 'Insert column right',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const removeTableColumnAction = {
  label: 'Remove column',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const hideTableColumnAction = {
  label: 'Hide column',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const showAllTableColumnsAction = {
  label: 'Show all columns',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const insertTableRowAboveAction = {
  label: 'Insert row above',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const insertTableRowBelowAction = {
  label: 'Insert row below',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const removeTableRowAction = {
  label: 'Remove row',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const toggleTableUIAction = {
  label: 'Toggle show table UI',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const toggleTableNameAction = {
  label: 'Toggle show table name',
  isAvailable: isAvailableBecauseCanEditFile,
};
