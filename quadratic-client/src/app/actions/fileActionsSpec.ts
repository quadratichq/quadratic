import { isAvailableBecauseCanEditFile, isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionAvailabilityArgs, ActionSpecRecord } from '@/app/actions/actionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { downloadQuadraticFile } from '@/app/helpers/downloadFileInBrowser';
import { isEmbed } from '@/app/helpers/isEmbed';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DownloadIcon, FileRenameIcon, HistoryIcon, PersonAddIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';

type FileActionSpec = Pick<
  ActionSpecRecord,
  Action.FileShare | Action.FileRename | Action.FileDownload | Action.FileVersionHistory
>;

export type FileActionArgs = {
  [Action.FileDownload]: { name: string };
  [Action.FileVersionHistory]: { uuid: string };
};

export const fileActionsSpec: FileActionSpec = {
  [Action.FileShare]: {
    label: 'Share',
    Icon: PersonAddIcon,
    isAvailable: ({ isAuthenticated }: ActionAvailabilityArgs) => !isEmbed && isAuthenticated,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showShareFileMenu: true }));
    },
  },
  [Action.FileRename]: {
    label: 'Rename',
    Icon: FileRenameIcon,
    isAvailable: isAvailableBecauseCanEditFile,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showRenameFileMenu: true }));
    },
  },
  [Action.FileDownload]: {
    label: 'Download',
    Icon: DownloadIcon,
    isAvailable: isAvailableBecauseLoggedIn,
    run: async ({ name }: FileActionArgs[Action.FileDownload]) => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: true }));
      const data = await quadraticCore.export();
      downloadQuadraticFile(name, data);
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, isRunningAsyncAction: false }));
    },
  },
  [Action.FileVersionHistory]: {
    label: 'Open version history',
    Icon: HistoryIcon,
    isAvailable: ({ isAuthenticated, filePermissions, teamPermissions }: ActionAvailabilityArgs) =>
      Boolean(isAuthenticated && filePermissions.includes('FILE_EDIT') && teamPermissions?.includes('TEAM_VIEW')),
    run: ({ uuid }: { uuid: string }) => {
      window.open(ROUTES.FILE_VERSIONS(uuid), '_blank');
    },
  },
};
