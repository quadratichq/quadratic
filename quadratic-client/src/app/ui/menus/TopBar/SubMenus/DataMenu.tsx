import { downloadSelectionAsCsvAction } from '@/app/actions';
import { KeyboardSymbols } from '@/app/helpers/keyboardSymbols';
import { useFileContext } from '@/app/ui/components/FileProvider';
import { DataIcon } from '@/app/ui/icons';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE, PARQUET_IMPORT_MESSAGE } from '@/shared/constants/appConstants';
import { ROUTES } from '@/shared/constants/routes';
import { Menu, MenuDivider, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useNavigate, useParams } from 'react-router-dom';
import { MenuLineItem } from '../MenuLineItem';
import { TopBarMenuItem } from '../TopBarMenuItem';

export const DataMenu = () => {
  const { uuid } = useParams() as { uuid: string };
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { name: fileName } = useFileContext();
  const navigate = useNavigate();

  return (
    <>
      <Menu
        menuButton={({ open }) => (
          <TopBarMenuItem title="Data" open={open}>
            <DataIcon fontSize="small" />
          </TopBarMenuItem>
        )}
      >
        <MenuItem
          onClick={() => {
            addGlobalSnackbar(CSV_IMPORT_MESSAGE);
          }}
        >
          <MenuLineItem primary="Import CSV" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            addGlobalSnackbar(PARQUET_IMPORT_MESSAGE);
          }}
        >
          <MenuLineItem primary="Import Parquet" />
        </MenuItem>
        <MenuDivider />
        <MenuItem
          onClick={() => {
            downloadSelectionAsCsvAction.run({ fileName });
          }}
        >
          <MenuLineItem
            primary={downloadSelectionAsCsvAction.label}
            secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'E'}
          />
        </MenuItem>
        <MenuDivider />
        <MenuItem onClick={() => navigate(ROUTES.FILE_CONNECTIONS(uuid), { replace: true })}>
          <MenuLineItem primary="Manage connections" />
        </MenuItem>
      </Menu>
    </>
  );
};
