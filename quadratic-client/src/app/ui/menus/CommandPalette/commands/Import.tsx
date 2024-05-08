import { hasPermissionToEditFile } from '@/app/actions';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE, PARQUET_IMPORT_MESSAGE } from '@/shared/constants/appConstants';
import { ROUTES } from '@/shared/constants/routes';
import { useNavigate, useParams } from 'react-router-dom';
import { CommandGroup, CommandPaletteListItem, CommandPaletteListItemDynamicProps } from '../CommandPaletteListItem';

const commands: CommandGroup = {
  heading: 'Import',
  commands: [
    {
      label: 'CSV',
      isAvailable: hasPermissionToEditFile,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const { addGlobalSnackbar } = useGlobalSnackbar();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              addGlobalSnackbar(CSV_IMPORT_MESSAGE);
            }}
          />
        );
      },
    },
    {
      label: 'Parquet',
      isAvailable: hasPermissionToEditFile,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const { addGlobalSnackbar } = useGlobalSnackbar();
        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              addGlobalSnackbar(PARQUET_IMPORT_MESSAGE);
            }}
          />
        );
      },
    },
    {
      label: 'Connections',
      // TODO: is this the right permission?
      isAvailable: hasPermissionToEditFile,
      Component: (props: CommandPaletteListItemDynamicProps) => {
        const navigate = useNavigate();
        const { uuid } = useParams();

        return (
          <CommandPaletteListItem
            {...props}
            action={() => {
              if (uuid) navigate(ROUTES.FILE_CONNECTIONS(uuid), { replace: true });
            }}
          />
        );
      },
    },
  ],
};

export default commands;
