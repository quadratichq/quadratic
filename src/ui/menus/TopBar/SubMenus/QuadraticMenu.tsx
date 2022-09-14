import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, SubMenu, MenuDivider, MenuHeader } from '@szhsin/react-menu';
import { MenuBookOutlined, FileOpenOutlined, SaveOutlined, BugReportOutlined } from '@mui/icons-material';

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
  const [showGridAxes, setShowGridAxes] = useLocalStorage('showGridAxes', true);
  const [showHeadings, setShowHeadings] = useLocalStorage('showHeadings', true);
  const [showGridLines, setShowGridLines] = useLocalStorage('showGridLines', true);
  const [showCellTypeOutlines, setShowCellTypeOutlines] = useLocalStorage('showCellTypeOutlines', true);

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
        <MenuItem type="checkbox" checked={showHeadings} onClick={() => setShowHeadings(!showHeadings)}>
          Show Headings
        </MenuItem>
        <MenuHeader>Grid</MenuHeader>
        <MenuItem type="checkbox" checked={showGridAxes} onClick={() => setShowGridAxes(!showGridAxes)}>
          Show Axis
        </MenuItem>
        <MenuItem type="checkbox" checked={showGridLines} onClick={() => setShowGridLines(!showGridLines)}>
          Show Grid Lines
        </MenuItem>
        <MenuItem
          type="checkbox"
          checked={showCellTypeOutlines}
          onClick={() => setShowCellTypeOutlines(!showCellTypeOutlines)}
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
