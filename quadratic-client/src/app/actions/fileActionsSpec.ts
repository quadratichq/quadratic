import { isAvailableBecauseCanEditFile, isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionAvailabilityArgs, ActionSpecRecord } from '@/app/actions/actionsSpec';
import { sheets } from '@/app/grid/controller/Sheets';
import { getAllSelection } from '@/app/grid/sheet/selection';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { downloadCsvFile, downloadExcelFile, downloadQuadraticFile } from '@/app/helpers/downloadFileInBrowser';
import { isEmbed } from '@/app/helpers/isEmbed';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { FileRenameIcon, HistoryIcon, PersonAddIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { trackEvent } from '@/shared/utils/analyticsEvents';

type FileActionSpec = Pick<
  ActionSpecRecord,
  | Action.FileShare
  | Action.FileRename
  | Action.FileDownload
  | Action.FileVersionHistory
  | Action.FileDownloadExcel
  | Action.FileDownloadCsv
>;

export type FileActionArgs = {
  [Action.FileDownload]: { name: string; uuid: string };
  [Action.FileVersionHistory]: { uuid: string };
  [Action.FileDownloadExcel]: { name: string; uuid: string };
  [Action.FileDownloadCsv]: { name: string; uuid: string };
};

export const fileActionsSpec: FileActionSpec = {
  [Action.FileShare]: {
    label: () => 'Share',
    Icon: PersonAddIcon,
    isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) => !isEmbed && isAuthenticated,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showShareFileMenu: true }));
    },
  },
  [Action.FileRename]: {
    label: () => 'Rename',
    Icon: FileRenameIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showRenameFileMenu: true }));
    },
  },
  [Action.FileDownload]: {
    label: () => 'Quadratic (.grid)',
    labelVerbose: 'Download as Quadratic (.grid)',
    isAvailable: isAvailableBecauseLoggedIn,
    run: async ({ name, uuid }: FileActionArgs[Action.FileDownload]) => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      trackEvent('[Files].downloadFile', { id: uuid });
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: true }));
      const data = await quadraticCore.export();
      downloadQuadraticFile(name, data);
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: false }));
    },
  },
  [Action.FileDownloadExcel]: {
    label: () => 'Excel (.xlsx)',
    labelVerbose: 'Download as Excel (.xlsx)',

    isAvailable: isAvailableBecauseCanEditFile,
    run: async ({ name, uuid }: FileActionArgs[Action.FileDownloadExcel]) => {
      try {
        if (!pixiAppSettings.setEditorInteractionState) return;
        trackEvent('[Files].exportExcel', { id: uuid });
        pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: true }));
        const data = await quadraticCore.exportExcel();
        downloadExcelFile(name, data);
        pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: false }));
      } catch (e) {
        pixiAppSettings.setEditorInteractionState?.((prev) => ({ ...prev, isRunningAsyncAction: false }));
        pixiAppSettings.addGlobalSnackbar?.('Failed to export Excel', {
          severity: 'error',
        });
        console.error(e);
      }
    },
  },
  [Action.FileDownloadCsv]: {
    label: () => 'CSV (current sheet only)',
    labelVerbose: 'Download as CSV (current sheet only)',
    isAvailable: isAvailableBecauseCanEditFile,
    run: async ({ name, uuid }: FileActionArgs[Action.FileDownloadCsv]) => {
      try {
        if (!pixiAppSettings.setEditorInteractionState) return;
        trackEvent('[Files].exportCsv', { id: uuid });
        pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: true }));
        const sheetBounds = sheets.sheet.boundsWithoutFormatting;

        if (sheetBounds.type !== 'empty') {
          let filename = `${name} - ${sheets.sheet.name}`;
          const selection = getAllSelection(sheets.sheet.id);
          const data = await quadraticCore.exportCsvSelection(selection);
          downloadCsvFile(filename, new TextEncoder().encode(data) as Uint8Array);
        }

        pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: false }));
      } catch (e) {
        pixiAppSettings.setEditorInteractionState?.((prev) => ({ ...prev, isRunningAsyncAction: false }));
        pixiAppSettings.addGlobalSnackbar?.('Failed to export CSV', {
          severity: 'error',
        });
        console.error(e);
      }
    },
  },
  [Action.FileVersionHistory]: {
    label: () => 'Open file history',
    Icon: HistoryIcon,
    isAvailable: ({ isAuthenticated, filePermissions, teamPermissions }: ActionAvailabilityArgs) =>
      Boolean(isAuthenticated && filePermissions.includes('FILE_EDIT') && teamPermissions?.includes('TEAM_VIEW')),
    run: ({ uuid }: { uuid: string }) => {
      window.open(ROUTES.FILE_HISTORY(uuid), '_blank');
    },
  },
};
