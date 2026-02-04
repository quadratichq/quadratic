import type { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { getActionFileDelete } from '@/routes/api.files.$uuid';
import { ROUTES } from '@/shared/constants/routes';
import type { ApiTypes, FilePermission, TeamPermission } from 'quadratic-shared/typesAndSchemas';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import { type SubmitFunction } from 'react-router';
import { type SetterOrUpdater } from 'recoil';

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
    window.open(ROUTES.CREATE_FILE(teamUuid, { private: true }), '_blank');
  },
};

export const duplicateFileAction = {
  label: 'Duplicate',
  // If you're logged in and you can see the file, you can duplicate it
  isAvailable: ({ isAuthenticated, filePermissions }: IsAvailableArgs) =>
    isAuthenticated && filePermissions.includes('FILE_VIEW'),
  run({ fileUuid }: { fileUuid: string }) {
    window.open(ROUTES.FILE_DUPLICATE(fileUuid), '_blank');
  },
};

export const deleteFile = {
  label: 'Delete',
  isAvailable: ({ filePermissions }: IsAvailableArgs) => filePermissions.includes(FILE_DELETE),
  // TODO: (enhancement) handle this async operation in the UI similar to /files/create
  async run({
    fileUuid,
    redirect,
    submit,
    userEmail,
  }: {
    fileUuid: string;
    redirect: boolean;
    submit: SubmitFunction;
    userEmail: string;
  }) {
    const data = getActionFileDelete({ userEmail, redirect });
    submit(data, { method: 'POST', action: ROUTES.API.FILE(fileUuid), encType: 'application/json' });
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
  label: 'Run selected code',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const rerunSheetAction = {
  label: 'Run all code in sheet',
  isAvailable: isAvailableBecauseCanEditFile,
};

export const rerunAllAction = {
  label: 'Run all code in file',
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
  label: 'Convert code to data table',
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
  label: 'Remove table column(s)',
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
  label: 'Remove table row(s)',
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
