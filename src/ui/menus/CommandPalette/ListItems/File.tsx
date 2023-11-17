import { createNewFile, deleteFile, downloadFile, duplicateFile } from '@/actions';
import { useGlobalSnackbar } from '@/components/GlobalSnackbarProvider';
import { ROUTES } from '@/constants/routes';
import { CommandItem } from '@/shadcn/ui/command';
import { useFileContext } from '@/ui/components/FileProvider';
import { useNavigate, useParams } from 'react-router-dom';

const ListItems = [
  {
    isAvailable: createNewFile.isAvailable,
    Component: () => {
      const navigate = useNavigate();
      const action = () => createNewFile.run({ navigate });
      return <CommandItem onSelect={action}>{createNewFile.label}</CommandItem>;
    },
  },
  {
    isAvailable: duplicateFile.isAvailable,
    Component: () => {
      const navigate = useNavigate();
      const action = () => navigate(ROUTES.CREATE_FILE);
      return <CommandItem onSelect={action}>{duplicateFile.label}</CommandItem>;
    },
  },
  {
    isAvailable: downloadFile.isAvailable,
    Component: () => {
      const { name } = useFileContext();
      return <CommandItem onSelect={() => downloadFile.run({ name })}>{downloadFile.label}</CommandItem>;
    },
  },
  {
    isAvailable: deleteFile.isAvailable,
    Component: () => {
      const { uuid } = useParams() as { uuid: string };
      const { addGlobalSnackbar } = useGlobalSnackbar();
      const action = () => deleteFile.run({ uuid, addGlobalSnackbar });
      return <CommandItem onSelect={action}>{deleteFile.label}</CommandItem>;
    },
  },
];

export default ListItems;
