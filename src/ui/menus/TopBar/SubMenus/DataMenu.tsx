import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, MenuHeader } from '@szhsin/react-menu';

import {
  CloudDownloadOutlined,
  StorageOutlined,
  DataObjectOutlined,
  UploadFile,
  InsertDriveFile,
} from '@mui/icons-material';

import '@szhsin/react-menu/dist/index.css';
import { Tooltip } from '@mui/material';
import { MenuLineItem } from '../MenuLineItem';
import { QuadraticSnackBar } from '../../../components/QuadraticSnackBar';
import { useState } from 'react';

export const DataMenu = () => {
  const [showCSVImportHelpMessage, setShowCSVImportHelpMessage] = useState(false);

  return (
    <>
      <Menu
        menuButton={
          <Tooltip title="Import data" arrow disableInteractive enterDelay={500} enterNextDelay={500}>
            <Button style={{ color: 'inherit' }}>
              <DataObjectOutlined fontSize="small"></DataObjectOutlined>
              <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
            </Button>
          </Tooltip>
        }
      >
        <MenuHeader>Import File</MenuHeader>
        <MenuItem
          onClick={() => {
            setShowCSVImportHelpMessage(true);
          }}
        >
          <MenuLineItem primary="CSV" Icon={UploadFile} />
        </MenuItem>
        <MenuItem disabled>
          <MenuLineItem primary="Excel (coming soon)" Icon={InsertDriveFile} />
        </MenuItem>
        <MenuHeader>Connect Data</MenuHeader>
        <MenuItem disabled>
          <MenuLineItem primary="SaaS (Quadratic Cloud only)" Icon={CloudDownloadOutlined} />
        </MenuItem>
        <MenuItem disabled>
          <MenuLineItem primary="Database (coming soon)" Icon={StorageOutlined} />
        </MenuItem>
      </Menu>
      <QuadraticSnackBar
        open={showCSVImportHelpMessage}
        onClose={() => {
          setShowCSVImportHelpMessage(false);
        }}
        message="Drag and drop a CSV file on the grid to import it."
      />
    </>
  );
};
