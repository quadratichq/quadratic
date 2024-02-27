import { DeleteOutline, FileCopyOutlined, FileDownloadOutlined, InsertDriveFileOutlined } from '@mui/icons-material';
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
    label: 'File: ' + createNewFileAction.label,
    isAvailable: createNewFileAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const navigate = useNavigate();
      const action = () => createNewFileAction.run({ navigate });
      return <CommandPaletteListItem {...props} icon={<InsertDriveFileOutlined />} action={action} />;
    },
  },
  {
    label: 'File: ' + duplicateFileWithUserAsOwnerAction.label,
    isAvailable: duplicateFileWithUserAsOwnerAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const submit = useSubmit();
      const { uuid } = useParams() as { uuid: string };
      const action = () => {
        duplicateFileWithUserAsOwnerAction.run({ uuid, submit });
      };
      return <CommandPaletteListItem {...props} icon={<FileCopyOutlined />} action={action} />;
    },
  },
  {
    label: 'File: ' + downloadFileAction.label,
    isAvailable: downloadFileAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { name } = useFileContext();
      return (
        <CommandPaletteListItem
          {...props}
          icon={<FileDownloadOutlined />}
          action={() => downloadFileAction.run({ name })}
        />
      );
    },
  },
  {
    label: 'File: ' + deleteFile.label,
    isAvailable: deleteFile.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { uuid } = useParams() as { uuid: string };
      const { addGlobalSnackbar } = useGlobalSnackbar();
      const action = () => deleteFile.run({ uuid, addGlobalSnackbar });
      return <CommandPaletteListItem {...props} icon={<DeleteOutline />} action={action} />;
    },
  },
];

export default ListItems;
