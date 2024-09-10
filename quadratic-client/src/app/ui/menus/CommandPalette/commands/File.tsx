import {
  createNewFileAction,
  deleteFile,
  downloadFileAction,
  duplicateFileAction,
  isAvailableBecauseCanEditFile,
} from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { DeleteIcon, DownloadIcon, DraftIcon, FileCopyIcon } from '@/shared/components/Icons';
import { useParams, useSubmit } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

// TODO: make the types better here so it knows whether this exists
const renameFileActionSpec = defaultActionSpec[Action.FileRename];

const commands: CommandGroup = {
  heading: 'File',
  commands: [
    {
      label: createNewFileAction.label,
      keywords: ['New file', 'Create file'],
      isAvailable: createNewFileAction.isAvailable,
      Component: (props) => {
        const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
        const action = () => createNewFileAction.run({ setEditorInteractionState });
        return <CommandPaletteListItem {...props} icon={<DraftIcon />} action={action} />;
      },
    },
    {
      label: duplicateFileAction.label,
      isAvailable: duplicateFileAction.isAvailable,
      Component: (props) => {
        const submit = useSubmit();
        const { uuid } = useParams() as { uuid: string };
        const action = () => {
          duplicateFileAction.run({ uuid, submit });
        };
        return <CommandPaletteListItem {...props} action={action} icon={<FileCopyIcon />} />;
      },
    },
    {
      label: downloadFileAction.label,
      isAvailable: downloadFileAction.isAvailable,
      Component: (props) => {
        const { name } = useFileContext();
        return (
          <CommandPaletteListItem {...props} action={() => downloadFileAction.run({ name })} icon={<DownloadIcon />} />
        );
      },
    },
    {
      label: renameFileActionSpec.label,
      isAvailable: isAvailableBecauseCanEditFile,
      Component: (props) => {
        return (
          <CommandPaletteListItem
            {...props}
            action={() => renameFileActionSpec.run()}
            icon={renameFileActionSpec.Icon && <renameFileActionSpec.Icon />}
          />
        );
      },
    },
    {
      label: deleteFile.label,
      isAvailable: deleteFile.isAvailable,
      Component: (props: any) => {
        const { uuid } = useParams() as { uuid: string };
        const { addGlobalSnackbar } = useGlobalSnackbar();
        const action = () => deleteFile.run({ uuid, addGlobalSnackbar });
        return <CommandPaletteListItem {...props} action={action} icon={<DeleteIcon />} />;
      },
    },
  ],
};

export default commands;
