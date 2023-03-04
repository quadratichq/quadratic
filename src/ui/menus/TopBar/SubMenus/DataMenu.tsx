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

import { useSetRecoilState } from 'recoil';
import { showCSVImportHelpAtom } from '../../../../atoms/showCSVImportHelpAtom';

export const DataMenu = () => {
  const setShowCSVImportHelpMessage = useSetRecoilState(showCSVImportHelpAtom);

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
            setShowCSVImportHelpMessage(true);
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
