import { createNewFile, deleteFile, downloadFile, duplicateFile } from '@/actions';
import { useGlobalSnackbar } from '@/components/GlobalSnackbarProvider';
import { ROUTES } from '@/constants/routes';
import { useFileContext } from '@/ui/components/FileProvider';
import { DownloadIcon, FileIcon, FileMinusIcon, FilePlusIcon } from '@radix-ui/react-icons';
import { useNavigate, useParams } from 'react-router-dom';
import { CommandPaletteListItem } from '../CommandPaletteListItem';

const ListItems = [
  {
    label: createNewFile.label,
    isAvailable: createNewFile.isAvailable,
    Component: (props: any) => {
      const navigate = useNavigate();
      const action = () => createNewFile.run({ navigate });
      return <CommandPaletteListItem {...props} action={action} Icon={<FileIcon />} />;
    },
  },

  {
    label: duplicateFile.label,
    isAvailable: duplicateFile.isAvailable,
    Component: (props: any) => {
      const navigate = useNavigate();
      const action = () => navigate(ROUTES.CREATE_FILE);
      return <CommandPaletteListItem {...props} action={action} Icon={<FilePlusIcon />} />;
    },
  },
  {
    label: downloadFile.label,
    isAvailable: downloadFile.isAvailable,
    Component: (props: any) => {
      const { name } = useFileContext();
      const action = () => downloadFile.run({ name });
      return <CommandPaletteListItem {...props} action={action} Icon={<DownloadIcon />} />;
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
