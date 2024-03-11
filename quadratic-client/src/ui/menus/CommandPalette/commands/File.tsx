import {
  // FileDeleteIcon, FileDownloadIcon, FileDuplicateIcon,
  FileIcon,
} from '@/ui/icons';
import { useNavigate, useParams, useSubmit } from 'react-router-dom';
import {
  createNewFileAction,
  deleteFile,
  downloadFileAction,
  duplicateFileWithUserAsOwnerAction,
} from '../../../../actions';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import { useFileContext } from '../../../components/FileProvider';
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
        return <CommandPaletteListItem {...props} action={action} />;
      },
    },
    {
      label: downloadFileAction.label,
      isAvailable: downloadFileAction.isAvailable,
      Component: (props) => {
        const { name } = useFileContext();
        return <CommandPaletteListItem {...props} action={() => downloadFileAction.run({ name })} />;
      },
    },
    {
      label: deleteFile.label,
      isAvailable: deleteFile.isAvailable,
      Component: (props: any) => {
        const { uuid } = useParams() as { uuid: string };
        const { addGlobalSnackbar } = useGlobalSnackbar();
        const action = () => deleteFile.run({ uuid, addGlobalSnackbar });
        return <CommandPaletteListItem {...props} action={action} />;
      },
    },
  ],
};

export default commands;
