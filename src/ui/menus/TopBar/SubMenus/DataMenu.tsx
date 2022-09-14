import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuHeader } from '@szhsin/react-menu';

import { CloudDownloadOutlined, StorageOutlined, DataObjectOutlined } from '@mui/icons-material';

import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';

import { menuItemIconStyles, topBarIconStyles } from './menuStyles';
import { colors } from '../../../../theme/colors';

export const DataMenu = () => {
  return (
    <Menu
      menuButton={
        <Tooltip title="Data" arrow>
          <Button style={{ color: colors.darkGray }}>
            <DataObjectOutlined style={topBarIconStyles}></DataObjectOutlined>
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <MenuHeader>Connect Data</MenuHeader>
      <MenuItem disabled>
        <CloudDownloadOutlined style={menuItemIconStyles}></CloudDownloadOutlined>
        SaaS (Quadratic Cloud only)
      </MenuItem>
      <MenuItem disabled>
        <StorageOutlined style={menuItemIconStyles}></StorageOutlined> Database (coming soon)
      </MenuItem>
    </Menu>
  );
};
