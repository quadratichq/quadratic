import { useEffect } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, SubMenu, MenuDivider, MenuHeader } from '@szhsin/react-menu';
import { MenuBookOutlined, FileOpenOutlined, SaveOutlined, BugReportOutlined } from '@mui/icons-material';
import { isMobileOnly } from 'react-device-detect';
import { useGridSettings } from '../../../../core/gridGL/useGridSettings';
import '@szhsin/react-menu/dist/index.css';
import useLocalStorage from '../../../../hooks/useLocalStorage';
import { Tooltip } from '@mui/material';

import { SaveGridFile } from '../../../../core/actions/gridFile/SaveGridFile';
import { OpenGridFile } from '../../../../core/actions/gridFile/OpenGridFile';

import { menuItemIconStyles } from './menuStyles';
import { colors } from '../../../../theme/colors';
import { DOCUMENTATION_URL, BUG_REPORT_URL } from '../../../../constants/urls';

export const QuadraticMenu = () => {
  const [showDebugMenu, setShowDebugMenu] = useLocalStorage('showDebugMenu', false);
  const settings = useGridSettings();

  // On Mobile set Headers to not visible by default
  useEffect(() => {
    if (isMobileOnly) {
      settings.setShowHeadings(false);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <Menu
      menuButton={
        <Tooltip title="Main Menu" arrow>
          <Button style={{ color: colors.darkGray }}>
            <img src="favicon.ico" height="22px" alt="Quadratic Icon" />
            <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
          </Button>
        </Tooltip>
      }
    >
      <MenuHeader>Quadratic</MenuHeader>
      <SubMenu label="File">
        <MenuItem onClick={() => SaveGridFile(true)}>
          <SaveOutlined style={menuItemIconStyles}></SaveOutlined> Save Grid
        </MenuItem>
        <MenuItem onClick={() => OpenGridFile()}>
          <FileOpenOutlined style={menuItemIconStyles}></FileOpenOutlined> Open Grid
        </MenuItem>
      </SubMenu>
      <SubMenu label="Import">
        <MenuHeader>Import</MenuHeader>
        <MenuItem disabled>CSV (coming soon)</MenuItem>
        <MenuItem disabled>Excel (coming soon)</MenuItem>
      </SubMenu>
      <SubMenu label="View">
        <MenuHeader>UI</MenuHeader>
        <MenuItem type="checkbox" checked={settings.showHeadings} onClick={() => settings.setShowHeadings(!settings.showHeadings)}>
          Show Headings
        </MenuItem>
        <MenuHeader>Grid</MenuHeader>
        <MenuItem type="checkbox" checked={settings.showGridAxes} onClick={() => settings.setShowGridAxes(!settings.showGridAxes)}>
          Show Axis
        </MenuItem>
        <MenuItem type="checkbox" checked={settings.showGridLines} onClick={() => settings.setShowGridLines(!settings.showGridLines)}>
          Show Grid Lines
        </MenuItem>
        <MenuItem
          type="checkbox"
          checked={settings.showCellTypeOutlines}
          onClick={() => settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines)}
        >
          Show Cell Type Outlines
        </MenuItem>
        <MenuDivider />
        <MenuHeader>Debug</MenuHeader>
        <MenuItem
          type="checkbox"
          checked={showDebugMenu}
          onClick={() => {
            setShowDebugMenu(!showDebugMenu);
          }}
        >
          Show DebugMenu
        </MenuItem>
      </SubMenu>
      <SubMenu label="Help">
        <MenuItem onClick={() => window.open(DOCUMENTATION_URL, '_blank')}>
          <MenuBookOutlined style={menuItemIconStyles}></MenuBookOutlined> Read the docs
        </MenuItem>
        <MenuItem onClick={() => window.open(BUG_REPORT_URL, '_blank')}>
          <BugReportOutlined style={menuItemIconStyles}></BugReportOutlined> Report a problem
        </MenuItem>
      </SubMenu>
    </Menu>
  );
};
