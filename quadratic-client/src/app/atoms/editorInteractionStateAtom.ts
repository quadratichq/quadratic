import { events } from '@/app/events/events';
import { focusGrid } from '@/app/helpers/focusGrid.js';
import type { SearchOptions } from '@/app/quadratic-core-types';
import type { TransactionInfo } from '@/app/shared/types/transactionInfo';
import type { User } from '@/auth/auth';
import type { FilePermission, TeamSettings } from 'quadratic-shared/typesAndSchemas';
import type { ConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { atom, DefaultValue, selector } from 'recoil';

type AnnotationState = 'dropdown' | 'date-format' | 'calendar' | 'calendar-time';

export type ConnectionsMenuState =
  | boolean
  | { initialView?: 'new' | 'list'; initialConnectionType?: ConnectionType; initialConnectionUuid?: string };

export interface EditorInteractionState {
  isRunningAsyncAction: boolean;
  transactionsInfo: TransactionInfo[];
  showCellTypeMenu: boolean | 'connections';
  showCommandPalette: boolean;
  showConnectionsMenu: ConnectionsMenuState;
  showGoToMenu: boolean;
  showFeedbackMenu: boolean;
  showRenameFileMenu: boolean;
  showShareFileMenu: boolean;
  showSearch: boolean | SearchOptions;
  showContextMenu: boolean;
  showValidation: boolean | string;
  showConditionalFormat: boolean | string;
  showLogs: boolean;
  annotationState?: AnnotationState;
  permissions: FilePermission[];
  settings: TeamSettings;
  user?: User;
  fileUuid: string;
  teamUuid: string;
  canManageBilling: boolean;
  connectionUuid: string;
  follow?: string;
  undo: boolean;
  redo: boolean;
}

export const defaultEditorInteractionState: EditorInteractionState = {
  isRunningAsyncAction: false,
  transactionsInfo: [],
  showCellTypeMenu: false,
  showCommandPalette: false,
  showConnectionsMenu: false,
  showGoToMenu: false,
  showFeedbackMenu: false,
  showRenameFileMenu: false,
  showShareFileMenu: false,
  showSearch: false,
  showContextMenu: false,
  showValidation: false,
  showConditionalFormat: false,
  showLogs: false,
  annotationState: undefined,
  permissions: ['FILE_VIEW'], // FYI: when we call <RecoilRoot> we initialize this with the value from the server
  settings: {
    analyticsAi: false,
  },
  user: undefined, // when we call <RecoilRoot> we initialize this with the value from the server
  fileUuid: '', // when we call <RecoilRoot> we initialize this with the value from the server
  teamUuid: '', // when we call <RecoilRoot> we initialize this with the value from the server
  canManageBilling: false,
  connectionUuid: '', // when we call <RecoilRoot> we initialize this with the value from the server
  follow: undefined,
  undo: false,
  redo: false,
};

export const editorInteractionStateAtom = atom<EditorInteractionState>({
  key: 'editorInteractionState',
  default: defaultEditorInteractionState,
  effects: [
    ({ setSelf }) => {
      const handleTransaction = (transaction: TransactionInfo, add: boolean) => {
        setSelf((prev) => {
          if (prev instanceof DefaultValue) return prev;
          return {
            ...prev,
            transactionsInfo: [
              ...prev.transactionsInfo.filter((t) => t.transactionId !== transaction.transactionId),
              ...(add ? [transaction] : []),
            ],
          };
        });
        if (!add) {
          events.emit('transactionEndUpdated', transaction.transactionId);
        }
      };

      const handleTransactionStart = (transaction: TransactionInfo) => {
        handleTransaction(transaction, true);
      };
      events.on('transactionStart', handleTransactionStart);

      const handleTransactionEnd = (transaction: TransactionInfo) => {
        handleTransaction(transaction, false);
      };
      events.on('transactionEnd', handleTransactionEnd);

      return () => {
        events.off('transactionStart', handleTransactionStart);
        events.off('transactionEnd', handleTransactionEnd);
      };
    },
    // this effect is used to focus the grid when the modal is closed
    ({ onSet }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) return;
        const oldModalShow =
          oldValue.showCellTypeMenu ||
          oldValue.showCommandPalette ||
          oldValue.showConnectionsMenu ||
          oldValue.showGoToMenu ||
          oldValue.showFeedbackMenu ||
          oldValue.showRenameFileMenu ||
          oldValue.showShareFileMenu ||
          oldValue.showSearch ||
          oldValue.showContextMenu;
        const newModelShow =
          newValue.showCellTypeMenu ||
          newValue.showCommandPalette ||
          newValue.showConnectionsMenu ||
          newValue.showGoToMenu ||
          newValue.showFeedbackMenu ||
          newValue.showRenameFileMenu ||
          newValue.showShareFileMenu ||
          newValue.showSearch ||
          newValue.showContextMenu;
        if (oldModalShow && !newModelShow) {
          focusGrid();
        }
      });
    },
    // this effect is used to focus the grid when the modal is closed
    ({ onSet }) => {
      onSet((newValue, oldValue) => {
        if (oldValue instanceof DefaultValue) return;
        const oldModalShow =
          oldValue.showCellTypeMenu ||
          oldValue.showCommandPalette ||
          oldValue.showConnectionsMenu ||
          oldValue.showGoToMenu ||
          oldValue.showFeedbackMenu ||
          oldValue.showRenameFileMenu ||
          oldValue.showShareFileMenu ||
          oldValue.showSearch ||
          oldValue.showContextMenu;
        const newModelShow =
          newValue.showCellTypeMenu ||
          newValue.showCommandPalette ||
          newValue.showConnectionsMenu ||
          newValue.showGoToMenu ||
          newValue.showFeedbackMenu ||
          newValue.showRenameFileMenu ||
          newValue.showShareFileMenu ||
          newValue.showSearch ||
          newValue.showContextMenu;
        if (oldModalShow && !newModelShow) {
          focusGrid();
        }
      });
    },
  ],
});

const createSelector = <T extends keyof EditorInteractionState>(key: T) =>
  selector<EditorInteractionState[T]>({
    key: `editorInteractionState${key.charAt(0).toUpperCase() + key.slice(1)}Atom`,
    get: ({ get }) => get(editorInteractionStateAtom)[key],
    set: ({ set }, newValue) =>
      set(editorInteractionStateAtom, (prev) => ({
        ...prev,
        [key]: newValue instanceof DefaultValue ? prev[key] : newValue,
      })),
  });

export const editorInteractionStateShowIsRunningAsyncActionAtom = createSelector('isRunningAsyncAction');
export const editorInteractionStateTransactionsInfoAtom = createSelector('transactionsInfo');
export const editorInteractionStateShowCellTypeMenuAtom = createSelector('showCellTypeMenu');
export const editorInteractionStateShowCommandPaletteAtom = createSelector('showCommandPalette');
export const editorInteractionStateShowConnectionsMenuAtom = createSelector('showConnectionsMenu');
export const editorInteractionStateShowGoToMenuAtom = createSelector('showGoToMenu');
export const editorInteractionStateShowFeedbackMenuAtom = createSelector('showFeedbackMenu');
export const editorInteractionStateShowRenameFileMenuAtom = createSelector('showRenameFileMenu');
export const editorInteractionStateShowShareFileMenuAtom = createSelector('showShareFileMenu');
export const editorInteractionStateShowSearchAtom = createSelector('showSearch');
export const editorInteractionStateShowContextMenuAtom = createSelector('showContextMenu');
export const editorInteractionStateShowValidationAtom = createSelector('showValidation');
export const editorInteractionStateShowConditionalFormatAtom = createSelector('showConditionalFormat');
export const editorInteractionStateShowLogsAtom = createSelector('showLogs');

export const editorInteractionStateAnnotationStateAtom = createSelector('annotationState');
export const editorInteractionStatePermissionsAtom = createSelector('permissions');
export const editorInteractionStateSettingsAtom = createSelector('settings');
export const editorInteractionStateUserAtom = createSelector('user');
export const editorInteractionStateFileUuidAtom = createSelector('fileUuid');
export const editorInteractionStateTeamUuidAtom = createSelector('teamUuid');
export const editorInteractionStateCanManageBillingAtom = createSelector('canManageBilling');
export const editorInteractionStateConnectionUuidAtom = createSelector('connectionUuid');
export const editorInteractionStateFollowAtom = createSelector('follow');
export const editorInteractionStateUndoAtom = createSelector('undo');
export const editorInteractionStateRedoAtom = createSelector('redo');
