import { FileCopyOutlined, FileDownloadOutlined, InsertDriveFileOutlined } from '@mui/icons-material';
import { FileMinusIcon } from '@radix-ui/react-icons';
import { useNavigate, useParams, useSubmit } from 'react-router-dom';
import { createNewFileAction, deleteFile, downloadFileAction, duplicateFileAction } from '../../../../actions';
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
      return <CommandPaletteListItem {...props} icon={<InsertDriveFileOutlined />} action={action} />;
    },
  },

  {
    label: duplicateFileAction.label,
    isAvailable: duplicateFileAction.isAvailable,
    Component: (props: CommandPaletteListItemSharedProps) => {
      const submit = useSubmit();
      const { name } = useFileContext();
      const action = () => {
        duplicateFileAction.run({ name, submit });
      };
      return <CommandPaletteListItem {...props} icon={<FileCopyOutlined />} action={action} />;
    },
  },
  {
    label: downloadFileAction.label,
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
    label: deleteFile.label,
    isAvailable: deleteFile.isAvailable,
    Component: (props: any) => {
      const { uuid } = useParams() as { uuid: string };
      const { addGlobalSnackbar } = useGlobalSnackbar();
      const action = () => deleteFile.run({ uuid, addGlobalSnackbar });
      return <CommandPaletteListItem {...props} action={action} Icon={<FileMinusIcon />} />;
    },
  },
].map((item) => ({ ...item, label: 'File: ' + item.label }));

export default ListItems;
