import {
  AddCircleOutline,
  DataObjectOutlined,
  InsertDriveFile,
  StorageOutlined,
  UploadFile,
} from '@mui/icons-material';
import { Menu, MenuHeader, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useState } from 'react';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbarProvider';
import { CSV_IMPORT_MESSAGE } from '../../../../constants/appConstants';
import { ConnectionsList } from '../../Connections/ConnectionsList';
import { MenuLineItem } from '../MenuLineItem';
import { TopBarMenuItem } from '../TopBarMenuItem';

export const DataMenu = () => {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const [showConnectionsList, setShowConnectionsList] = useState(false);

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
        <MenuHeader>Connections</MenuHeader>
        <MenuItem disabled>
          <MenuLineItem primary="Add Connection" Icon={AddCircleOutline} />
        </MenuItem>
        <MenuItem onClick={() => setShowConnectionsList(true)}>
          <MenuLineItem primary="Manage Connections" Icon={StorageOutlined} />
        </MenuItem>
      </Menu>

      <ConnectionsList show={showConnectionsList} setShow={setShowConnectionsList}></ConnectionsList>
    </>
  );
};
