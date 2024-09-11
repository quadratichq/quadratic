import { Action } from '@/app/actions/actions';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { isEmbed } from '@/app/helpers/isEmbed';
import { FileRenameIcon, PersonAddIcon } from '@/shared/components/Icons';

export const fileActionsSpec = {
  [Action.FileShare]: {
    label: 'Share',
    Icon: PersonAddIcon,
    // TODO: (jimniels) implement types based on ayush's PR
    // @ts-expect-error
    isAvailable: ({ isAuthenticated }) => !isEmbed && isAuthenticated,
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
