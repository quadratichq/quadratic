import { isAvailableBecauseCanEditFile, isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionAvailabilityArgs, ActionSpecRecord } from '@/app/actions/actionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { downloadExcelFile, downloadQuadraticFile } from '@/app/helpers/downloadFileInBrowser';
import { isEmbed } from '@/app/helpers/isEmbed';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DownloadExcelIcon, DownloadIcon, FileRenameIcon, HistoryIcon, PersonAddIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import mixpanel from 'mixpanel-browser';

type FileActionSpec = Pick<
  ActionSpecRecord,
  Action.FileShare | Action.FileRename | Action.FileDownload | Action.FileVersionHistory | Action.FileDownloadExcel
>;

export type FileActionArgs = {
  [Action.FileDownload]: { name: string; uuid: string };
  [Action.FileVersionHistory]: { uuid: string };
  [Action.FileDownloadExcel]: { name: string; uuid: string };
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
    label: () => 'Download',
    Icon: DownloadIcon,
    isAvailable: isAvailableBecauseLoggedIn,
    run: async ({ name, uuid }: FileActionArgs[Action.FileDownload]) => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      mixpanel.track('[Files].downloadFile', { id: uuid });
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: true }));
      const data = await quadraticCore.export();
      downloadQuadraticFile(name, data);
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: false }));
    },
  },
  [Action.FileDownloadExcel]: {
    label: () => 'Export Excel',
    Icon: DownloadExcelIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: async ({ name, uuid }: FileActionArgs[Action.FileDownloadExcel]) => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      mixpanel.track('[Files].exportExcel', { id: uuid });
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: true }));
      const data = await quadraticCore.exportExcel();
      downloadExcelFile(name, data);
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: false }));
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
