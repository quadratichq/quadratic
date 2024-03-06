import { DownloadIcon, FileIcon, FileMinusIcon, FilePlusIcon } from '@radix-ui/react-icons';
import { useNavigate, useParams, useSubmit } from 'react-router-dom';
import {
  createNewFileAction,
  deleteFile,
  downloadFileAction,
  duplicateFileWithUserAsOwnerAction,
} from '../../../../actions';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import { useFileContext } from '../../../components/FileProvider';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: createNewFileAction.label,
    isAvailable: createNewFileAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const navigate = useNavigate();
      const action = () => createNewFileAction.run({ navigate });
      return <CommandPaletteListItem {...props} icon={<FileIcon />} action={action} />;
    },
  },

  {
    label: duplicateFileWithUserAsOwnerAction.label,
    isAvailable: duplicateFileWithUserAsOwnerAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const submit = useSubmit();
      const { uuid } = useParams() as { uuid: string };
      const action = () => {
        duplicateFileWithUserAsOwnerAction.run({ uuid, submit });
      };
      return <CommandPaletteListItem {...props} icon={<FilePlusIcon />} action={action} />;
    },
  },
  {
    label: downloadFileAction.label,
    isAvailable: downloadFileAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { name } = useFileContext();
      return (
        <CommandPaletteListItem {...props} icon={<DownloadIcon />} action={() => downloadFileAction.run({ name })} />
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
      return <CommandPaletteListItem {...props} icon={<FileMinusIcon />} action={action} />;
    },
  },
].map((item) => ({ ...item, label: 'File: ' + item.label }));

export default ListItems;
