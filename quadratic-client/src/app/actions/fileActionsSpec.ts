import { isAvailableBecauseCanEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { ActionAvailabilityArgs, ActionSpecRecord } from '@/app/actions/actionsSpec';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { isEmbed } from '@/app/helpers/isEmbed';
import { FileRenameIcon, PersonAddIcon } from '@/shared/components/Icons';

type FileActionSpec = Pick<ActionSpecRecord, Action.FileShare | Action.FileRename>;

export const fileActionsSpec: FileActionSpec = {
  [Action.FileShare]: {
    label: 'Share',
    Icon: PersonAddIcon,
    // TODO: (jimniels) implement types based on ayush's PR
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
};
