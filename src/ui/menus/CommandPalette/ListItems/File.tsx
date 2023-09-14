import { DeleteOutline, FileCopyOutlined, FileDownloadOutlined, InsertDriveFileOutlined } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { createNewFile, deleteFile, downloadFile, duplicateFile } from '../../../../actions';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import { ROUTES } from '../../../../constants/routes';
import { useFileContext } from '../../../components/FileProvider';
import { CommandPaletteListItem, CommandPaletteListItemSharedProps } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: 'File: ' + createNewFile.label,
    isAvailable: createNewFile.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const navigate = useNavigate();
      const action = () => createNewFile.run({ navigate });
      return <CommandPaletteListItem {...props} icon={<InsertDriveFileOutlined />} action={action} />;
    },
  },
  {
    label: 'File: ' + duplicateFile.label,
    isAvailable: duplicateFile.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const navigate = useNavigate();
      const action = () => navigate(ROUTES.CREATE_FILE);
      return <CommandPaletteListItem {...props} icon={<FileCopyOutlined />} action={action} />;
    },
  },
  {
    label: 'File: ' + downloadFile.label,
    isAvailable: downloadFile.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const { name } = useFileContext();
      return (
        <CommandPaletteListItem {...props} icon={<FileDownloadOutlined />} action={() => downloadFile.run({ name })} />
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
