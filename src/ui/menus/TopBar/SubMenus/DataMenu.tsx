import {
  CloudDownloadOutlined,
  DataObjectOutlined,
  InsertDriveFile,
  StorageOutlined,
  UploadFile,
} from '@mui/icons-material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Tooltip } from '@mui/material';
import Button from '@mui/material/Button';
import { Menu, MenuHeader, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { CSV_IMPORT_MESSAGE } from '../../../../constants/app';
import { useGlobalSnackbar } from '../../../../shared/GlobalSnackbar';
import { MenuLineItem } from '../MenuLineItem';

export const DataMenu = () => {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  return (
    <>
      <Menu
        menuButton={
          <Tooltip title="Data import" arrow disableInteractive enterDelay={500} enterNextDelay={500}>
            <Button style={{ color: 'inherit' }}>
              <DataObjectOutlined fontSize="small"></DataObjectOutlined>
              <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
            </Button>
          </Tooltip>
        }
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
