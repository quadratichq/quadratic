import {
  CloudDownloadOutlined,
  DataObjectOutlined,
  InsertDriveFile,
  StorageOutlined,
  UploadFile,
} from '@mui/icons-material';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { ButtonBase, Tooltip, useTheme } from '@mui/material';
import { Menu, MenuHeader, MenuItem } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useGlobalSnackbar } from '../../../../components/GlobalSnackbar';
import { CSV_IMPORT_MESSAGE } from '../../../../constants/appConstants';
import { MenuLineItem } from '../MenuLineItem';

const TopBarIconButton = (props: any) => {
  const theme = useTheme();
  return (
    <Tooltip title={props.tooltipTitle} arrow disableInteractive enterDelay={500} enterNextDelay={500}>
      <ButtonBase disableRipple sx={{ p: theme.spacing(1), '&:hover svg': { fill: theme.palette.text.primary } }}>
        <div>
          {props.children}
          <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
        </div>
      </ButtonBase>
    </Tooltip>
  );
};

export const DataMenu = () => {
  const { addGlobalSnackbar } = useGlobalSnackbar();

  return (
    <>
      <Menu
        menuButton={
          <div>
            {/* forward ref */}
            <TopBarIconButton tooltipTitle="Data import">
              <DataObjectOutlined fontSize="small" />
            </TopBarIconButton>
          </div>
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
