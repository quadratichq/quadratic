import { useEffect } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, SubMenu, MenuDivider, MenuHeader } from '@szhsin/react-menu';
import { isMobileOnly } from 'react-device-detect';
import { useAuth0 } from '@auth0/auth0-react';

import '@szhsin/react-menu/dist/index.css';
import useLocalStorage from '../../../../hooks/useLocalStorage';
import { Tooltip } from '@mui/material';

import { SaveGridFile } from '../../../../core/actions/gridFile/SaveGridFile';
import { OpenGridFile } from '../../../../core/actions/gridFile/OpenGridFile';

import { colors } from '../../../../theme/colors';
import { DOCUMENTATION_URL, BUG_REPORT_URL } from '../../../../constants/urls';

export const QuadraticMenu = () => {
  const [showDebugMenu, setShowDebugMenu] = useLocalStorage('showDebugMenu', false);
  const [showGridAxes, setShowGridAxes] = useLocalStorage('showGridAxes', true);
  const [showHeadings, setShowHeadings] = useLocalStorage('showHeadings', true);
  const [showGridLines, setShowGridLines] = useLocalStorage('showGridLines', true);
  const [showCellTypeOutlines, setShowCellTypeOutlines] = useLocalStorage('showCellTypeOutlines', true);
  const { isAuthenticated, user, logout } = useAuth0();

  // On Mobile set Headers to not visible by default
  useEffect(() => {
    if (isMobileOnly) {
      setShowHeadings(false);
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
        <MenuItem onClick={() => SaveGridFile(true)}>Save grid</MenuItem>
        <MenuItem onClick={() => OpenGridFile()}>Open grid</MenuItem>
      </SubMenu>
      <SubMenu label="Import">
        <MenuItem disabled>CSV (coming soon)</MenuItem>
        <MenuItem disabled>Excel (coming soon)</MenuItem>
      </SubMenu>
      <SubMenu label="View">
        <MenuItem type="checkbox" checked={showHeadings} onClick={() => setShowHeadings(!showHeadings)}>
          Show headings
        </MenuItem>
        <MenuDivider />
        <MenuItem type="checkbox" checked={showGridAxes} onClick={() => setShowGridAxes(!showGridAxes)}>
          Show grid axis
        </MenuItem>
        <MenuItem type="checkbox" checked={showGridLines} onClick={() => setShowGridLines(!showGridLines)}>
          Show grid lines
        </MenuItem>
        <MenuItem
          type="checkbox"
          checked={showCellTypeOutlines}
          onClick={() => setShowCellTypeOutlines(!showCellTypeOutlines)}
        >
          Show cell type outlines
        </MenuItem>
        <MenuDivider />
        <MenuItem
          type="checkbox"
          checked={showDebugMenu}
          onClick={() => {
            setShowDebugMenu(!showDebugMenu);
          }}
        >
          Show debug menu
        </MenuItem>
      </SubMenu>

      {isAuthenticated && (
        <SubMenu label="Account">
          <MenuHeader>{user?.email}</MenuHeader>
          <MenuItem onClick={() => logout({ returnTo: window.location.origin })}>Log out</MenuItem>
        </SubMenu>
      )}

      <SubMenu label="Help">
        <MenuItem onClick={() => window.open(DOCUMENTATION_URL, '_blank')}>Read the docs</MenuItem>
        <MenuItem onClick={() => window.open(BUG_REPORT_URL, '_blank')}>Report a problem</MenuItem>
      </SubMenu>
    </Menu>
  );
};
