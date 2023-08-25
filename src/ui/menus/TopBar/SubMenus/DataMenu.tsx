import {
  CloudDownloadOutlined,
  DataObjectOutlined,
  InsertDriveFile,
  StorageOutlined,
  UploadFile,
} from '@mui/icons-material';
import { Menu, MenuHeader, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbar';
import { CSV_IMPORT_MESSAGE } from '../../../../constants/appConstants';
import { MenuLineItem } from '../MenuLineItem';
import { TopBarMenuItem } from '../TopBarMenuItem';

export const DataMenu = () => {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  return (
    <>
      <Menu
        menuButton={({ open }) => (
          <TopBarMenuItem title="Data import" open={open}>
            <DataObjectOutlined fontSize="small" />
          </TopBarMenuItem>
        )}
      >
        <MenuHeader>Import</MenuHeader>
        <MenuItem
          onClick={() => {
            addGlobalSnackbar(CSV_IMPORT_MESSAGE);
          }}
        >
          <MenuLineItem primary="CSV" Icon={UploadFile} />
        </MenuItem>
        <MenuItem disabled>
          <MenuLineItem primary="Excel (coming soon)" Icon={InsertDriveFile} />
        </MenuItem>
        <MenuHeader>Connect</MenuHeader>
        <MenuItem disabled>
          <MenuLineItem primary="SaaS (coming soon)" Icon={CloudDownloadOutlined} />
        </MenuItem>
        <MenuItem disabled>
          <MenuLineItem primary="Database (coming soon)" Icon={StorageOutlined} />
        </MenuItem>
      </Menu>
    </>
  );
};
