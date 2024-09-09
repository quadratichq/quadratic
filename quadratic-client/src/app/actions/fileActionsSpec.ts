import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { isEmbed } from '@/app/helpers/isEmbed';
import { FileRenameIcon, PersonAddIcon } from '@/shared/components/Icons';
import { ActionSpecRecord } from './actionSpec';
import { Action } from './actions';

export const fileActionsSpec: ActionSpecRecord = {
  [Action.FileShare]: {
    label: 'Share',
    Icon: PersonAddIcon,
    isAvailable: () => isEmbed,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showShareFileMenu: true }));
    },
  },
  [Action.FileRename]: {
    label: 'Rename',
    Icon: FileRenameIcon,
    // isAvailable: () => true,
    run: () => {
      if (!pixiAppSettings.setEditorInteractionState) return;
      pixiAppSettings.setEditorInteractionState((prev) => ({ ...prev, showRenameFileMenu: true }));
    },
  },
};
