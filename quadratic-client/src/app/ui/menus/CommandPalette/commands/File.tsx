import { createNewFileAction, deleteFile, duplicateFileAction, isAvailableBecauseCanEditFile } from '@/app/actions';
import { Action } from '@/app/actions/actions';
import { defaultActionSpec } from '@/app/actions/defaultActionsSpec';
import { editorInteractionStateUserAtom, editorInteractionStateUuidAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { CommandGroup, CommandPaletteListItem } from '@/app/ui/menus/CommandPalette/CommandPaletteListItem';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { DeleteIcon, DraftIcon, FileCopyIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useParams, useSubmit } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

// TODO: make the types better here so it knows whether this exists
const renameFileActionSpec = defaultActionSpec[Action.FileRename];
const downloadFileActionSpec = defaultActionSpec[Action.FileDownload];

const commands: CommandGroup = {
  heading: 'File',
  commands: [
    {
      label: createNewFileAction.label,
      keywords: ['New file', 'Create file'],
      isAvailable: createNewFileAction.isAvailable,
      Component: (props) => {
        const {
          team: { uuid: teamUuid },
        } = useFileRouteLoaderData();
        const action = () => createNewFileAction.run({ teamUuid });
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
      label: downloadFileActionSpec.label,
      isAvailable: downloadFileActionSpec.isAvailable,
      Component: (props) => {
        const { name } = useFileContext();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => downloadFileActionSpec.run({ name })}
            icon={downloadFileActionSpec?.Icon && <downloadFileActionSpec.Icon />}
          />
        );
      },
    },
    {
      label: renameFileActionSpec?.label ?? '',
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
        const uuid = useRecoilValue(editorInteractionStateUuidAtom);
        const user = useRecoilValue(editorInteractionStateUserAtom);
        const submit = useSubmit();
        const { addGlobalSnackbar } = useGlobalSnackbar();
        const action = () =>
          deleteFile.run({ uuid, userEmail: user?.email ?? '', redirect: true, submit, addGlobalSnackbar });
        return <CommandPaletteListItem {...props} action={action} icon={<DeleteIcon />} />;
      },
    },
  ],
};

export default commands;
