import { downloadSelectionAsCsvAction } from '@/actions';
import { KeyboardSymbols } from '@/helpers/keyboardSymbols';
import { useFileContext } from '@/ui/components/FileProvider';
import { DataIcon } from '@/ui/icons';
import { AddCircleOutline, StorageOutlined } from '@mui/icons-material';
import { Menu, MenuDivider, MenuHeader, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useSearchParams } from 'react-router-dom';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE } from '../../../../constants/appConstants';
import { MenuLineItem } from '../MenuLineItem';
import { TopBarMenuItem } from '../TopBarMenuItem';

export const DataMenu = () => {
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { name: fileName } = useFileContext();
  const [, setSearchParams] = useSearchParams();

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
            downloadSelectionAsCsvAction.run({ fileName });
          }}
        >
          <MenuLineItem
            primary={downloadSelectionAsCsvAction.label}
            secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'E'}
          />
        </MenuItem>
        <MenuHeader>Connections</MenuHeader>
        <MenuItem disabled>
          <MenuLineItem primary="Add Connection" Icon={AddCircleOutline} />
        </MenuItem>
        <MenuItem
          onClick={() =>
            setSearchParams((prev) => {
              prev.set('connections', 'list');
              return prev;
            })
          }
        >
          <MenuLineItem primary="Manage Connections" Icon={StorageOutlined} />
        </MenuItem>
        <MenuDivider />
        <MenuItem disabled>
          <MenuLineItem primary="Connect database (coming soon)" />
        </MenuItem>
      </Menu>
    </>
  );
};
