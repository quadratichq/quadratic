import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuHeader } from '@szhsin/react-menu';

import { CloudDownloadOutlined, StorageOutlined, DataObjectOutlined } from '@mui/icons-material';

import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';
import { MenuLineItem } from '../MenuLineItem';

export const DataMenu = () => {
  return (
    <Menu
      menuButton={
        <Tooltip title="Data" arrow disableInteractive enterDelay={500} enterNextDelay={500}>
          <Button style={{ color: 'inherit' }}>
            <DataObjectOutlined fontSize="small"></DataObjectOutlined>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <MenuHeader>Connect Data</MenuHeader>
      <MenuItem disabled>
        <MenuLineItem primary="SaaS (Quadratic Cloud only)" Icon={CloudDownloadOutlined} />
      </MenuItem>
      <MenuItem disabled>
        <MenuLineItem primary="Database (coming soon)" Icon={StorageOutlined} />
      </MenuItem>
    </Menu>
  );
};
