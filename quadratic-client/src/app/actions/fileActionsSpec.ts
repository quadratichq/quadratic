import { isAvailableBecauseCanEditFile, isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import type { ActionAvailabilityArgs, ActionSpecRecord } from '@/app/actions/actionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { downloadQuadraticFile } from '@/app/helpers/downloadFileInBrowser';
import { isEmbed } from '@/app/helpers/isEmbed';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { DownloadIcon, FileRenameIcon, PersonAddIcon } from '@/shared/components/Icons';

type FileActionSpec = Pick<ActionSpecRecord, Action.FileShare | Action.FileRename | Action.FileDownload>;

export type FileActionArgs = {
  [Action.FileDownload]: { name: string };
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
};
