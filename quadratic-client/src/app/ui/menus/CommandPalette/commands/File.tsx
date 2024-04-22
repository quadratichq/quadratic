import { createNewFileAction, deleteFile, downloadFileAction, duplicateFileWithUserAsOwnerAction } from '@/app/actions';
import { useFileContext } from '@/app/ui/components/FileProvider';
import {
  FileDeleteIcon,
  FileDowndloadIcon,
  FileDuplicateIcon,
  // FileDeleteIcon, FileDownloadIcon, FileDuplicateIcon,
  FileIcon,
} from '@/app/ui/icons';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { useNavigate, useParams, useSubmit } from 'react-router-dom';
import { CommandGroup, CommandPaletteListItem } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'File',
  commands: [
    {
      label: createNewFileAction.label,
      keywords: ['New file', 'Create file'],
      isAvailable: createNewFileAction.isAvailable,
      Component: (props) => {
        const navigate = useNavigate();
        const action = () => createNewFileAction.run({ navigate });
        return <CommandPaletteListItem {...props} icon={<FileIcon />} action={action} />;
      },
    },

    {
      label: duplicateFileWithUserAsOwnerAction.label,
      isAvailable: duplicateFileWithUserAsOwnerAction.isAvailable,
      Component: (props) => {
        const submit = useSubmit();
        const { uuid } = useParams() as { uuid: string };
        const action = () => {
          duplicateFileWithUserAsOwnerAction.run({ uuid, submit });
        };
        return <CommandPaletteListItem {...props} action={action} icon={<FileDuplicateIcon />} />;
      },
    },
    {
      label: downloadFileAction.label,
      isAvailable: downloadFileAction.isAvailable,
      Component: (props) => {
        const { name } = useFileContext();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => downloadFileAction.run({ name })}
            icon={<FileDowndloadIcon />}
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
        return <CommandPaletteListItem {...props} action={action} icon={<FileDeleteIcon />} />;
      },
    },
  ],
};

export default commands;
