import { isAvailableBecauseCanEditFile, isAvailableBecauseLoggedIn } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { FileRenameIcon, PersonAddIcon } from '@/shared/components/Icons';

export const fileActionsSpec = {
  [Action.FileShare]: {
    label: 'Share',
    Icon: PersonAddIcon,
    isAvailable: isAvailableBecauseLoggedIn,
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
