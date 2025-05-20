import { createNewFileAction, deleteFile, duplicateFileAction, isAvailableBecauseCanEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import {
  editorInteractionStateFileUuidAtom,
  editorInteractionStateTeamUuidAtom,
  editorInteractionStateUserAtom,
} from '@/app/atoms/editorInteractionStateAtom';
import { useFileContext } from '@/app/ui/components/FileProvider';
import type { CommandGroup } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { useConfirmDialog } from '@/shared/components/ConfirmProvider';
import { DeleteIcon, DraftIcon, FileCopyIcon } from '@/shared/components/Icons';
import { useSubmit } from 'react-router';
import { useRecoilValue } from 'recoil';

// TODO: make the types better here so it knows whether this exists
const renameFileActionSpec = defaultActionSpec[Action.FileRename];
const downloadFileActionSpec = defaultActionSpec[Action.FileDownload];
const openFileVersionHistoryActionSpec = defaultActionSpec[Action.FileVersionHistory];

const commands: CommandGroup = {
  heading: 'File',
  commands: [
    {
      label: createNewFileAction.label,
      keywords: ['New file', 'Create file'],
      isAvailable: createNewFileAction.isAvailable,
      Component: (props) => {
        const teamUuid = useRecoilValue(editorInteractionStateTeamUuidAtom);
        const action = () => createNewFileAction.run({ teamUuid });
        return <CommandPaletteListItem {...props} icon={<DraftIcon />} action={action} />;
      },
    },
    {
      label: duplicateFileAction.label,
      isAvailable: duplicateFileAction.isAvailable,
      Component: (props) => {
        const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
        const action = () => {
          duplicateFileAction.run({ fileUuid });
        };
        return <CommandPaletteListItem {...props} action={action} icon={<FileCopyIcon />} />;
      },
    },
    {
      label: openFileVersionHistoryActionSpec.label(),
      isAvailable: openFileVersionHistoryActionSpec.isAvailable,
      Component: (props) => {
        const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
        const action = () => openFileVersionHistoryActionSpec.run({ uuid: fileUuid });
        return (
          <CommandPaletteListItem
            {...props}
            action={action}
            icon={openFileVersionHistoryActionSpec.Icon && <openFileVersionHistoryActionSpec.Icon />}
          />
        );
      },
    },
    {
      label: downloadFileActionSpec.label(),
      isAvailable: downloadFileActionSpec.isAvailable,
      Component: (props) => {
        const { name } = useFileContext();
        const uuid = useRecoilValue(editorInteractionStateFileUuidAtom);
        return (
          <CommandPaletteListItem
            {...props}
            action={() => downloadFileActionSpec.run({ name, uuid })}
            icon={downloadFileActionSpec?.Icon && <downloadFileActionSpec.Icon />}
          />
        );
      },
    },
    {
      label: renameFileActionSpec?.label() ?? '',
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={() => renameFileActionSpec?.run()}
            icon={renameFileActionSpec?.Icon && <renameFileActionSpec.Icon />}
          />
        );
      },
    },
    {
      label: deleteFile.label,
      isAvailable: deleteFile.isAvailable,
      Component: (props: any) => {
        const { name } = useFileContext();
        const fileUuid = useRecoilValue(editorInteractionStateFileUuidAtom);
        const user = useRecoilValue(editorInteractionStateUserAtom);
        const submit = useSubmit();
        const confirmFn = useConfirmDialog('deleteFile', { name });
        const action = () =>
          deleteFile.run({ fileUuid, userEmail: user?.email ?? '', redirect: true, submit, confirmFn });
        return <CommandPaletteListItem {...props} action={action} icon={<DeleteIcon />} />;
      },
    },
  ],
};

export default commands;
