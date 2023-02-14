import '@szhsin/react-menu/dist/index.css';

import { useCallback, useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, SubMenu, MenuDivider, MenuHeader } from '@szhsin/react-menu';
import { isMobileOnly } from 'react-device-detect';
import { useGridSettings } from './useGridSettings';
import { useAuth0 } from '@auth0/auth0-react';

import '@szhsin/react-menu/dist/index.css';
import useLocalStorage from '../../../../hooks/useLocalStorage';
import { Tooltip } from '@mui/material';
import { SaveGridFile } from '../../../../grid/actions/gridFile/SaveGridFile';
import {
  newGridFile,
  openExampleGridFile,
  openGridFile,
  openLocalGridFile,
} from '../../../../grid/actions/gridFile/OpenGridFile';

import { DOCUMENTATION_URL, BUG_REPORT_URL } from '../../../../constants/urls';
import { useLocalFiles } from '../../../../hooks/useLocalFiles';
import { SheetController } from '../../../../grid/controller/sheetController';
import { NewFile } from './newFile/NewFile';

interface Props {
  sheetController: SheetController;
}

const examples = [
  'python.grid',
  'airports_large.grid',
  'airport_distance.grid',
  'expenses.grid',
  'monte_carlo_simulation.grid',
  'startup_portfolio.grid',
];

export const QuadraticMenu = (props: Props) => {
  const { sheetController } = props;
  const { sheet } = sheetController;
  const [showDebugMenu, setShowDebugMenu] = useLocalStorage('showDebugMenu', false);

  const settings = useGridSettings();

  const [newFileOpen, setNewFileOpen] = useState(false);

  const { isAuthenticated, user, logout } = useAuth0();

  // On Mobile set Headers to not visible by default
  useEffect(() => {
    if (isMobileOnly) {
      settings.setShowHeadings(false);
    }
    // eslint-disable-next-line
  }, []);

  const { fileList } = useLocalFiles();

  const createNewFile = useCallback(
    (filename?: string) => {
      if (filename) {
        const extension = filename.split('.').pop();
        if (!extension || extension !== 'grid') {
          filename += '.grid';
        }
        newGridFile(filename, sheetController);
      }
      setNewFileOpen(false);
    },
    [sheetController]
  );

  return (
    <>
      <Menu
        menuButton={
          <Tooltip title="Main menu" arrow disableInteractive enterDelay={500} enterNextDelay={500}>
            <Button style={{ color: 'inherit' }}>
              <img src="favicon.ico" height="22px" alt="Quadratic Icon" />
              <KeyboardArrowDown fontSize="small"></KeyboardArrowDown>
            </Button>
          </Tooltip>
        }
      >
        <MenuHeader>Quadratic</MenuHeader>
        <SubMenu label="File">
          <MenuItem onClick={() => setNewFileOpen(true)}>New grid</MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => SaveGridFile(sheet, true)}>Save local copy</MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => openGridFile(sheetController)}>Open local</MenuItem>
          <SubMenu label="Open sample">
            {examples.map((filename) => (
              <MenuItem key={`sample-${filename}`} onClick={() => openExampleGridFile(filename, sheetController)}>
                {filename}
              </MenuItem>
            ))}
          </SubMenu>
          {fileList.length && (
            <SubMenu label="Open recent">
              {fileList.map((entry) => (
                <MenuItem key={entry} onClick={() => openLocalGridFile(entry, sheetController)}>
                  {entry}
                </MenuItem>
              ))}
            </SubMenu>
          )}
        </SubMenu>
        <SubMenu label="Import">
          <MenuItem disabled>CSV (coming soon)</MenuItem>
          <MenuItem disabled>Excel (coming soon)</MenuItem>
        </SubMenu>
        <SubMenu label="View">
          <MenuItem
            type="checkbox"
            checked={settings.showHeadings}
            onClick={() => settings.setShowHeadings(!settings.showHeadings)}
          >
            Show row and column headings
          </MenuItem>
          <MenuItem
            type="checkbox"
            checked={settings.showGridAxes}
            onClick={() => settings.setShowGridAxes(!settings.showGridAxes)}
          >
            Show axis
          </MenuItem>
          <MenuItem
            type="checkbox"
            checked={settings.showGridLines}
            onClick={() => settings.setShowGridLines(!settings.showGridLines)}
          >
            Show grid lines
          </MenuItem>
          <MenuItem
            type="checkbox"
            checked={settings.showCellTypeOutlines}
            onClick={() => settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines)}
          >
            Show cell type outlines
          </MenuItem>
          <MenuItem
            type="checkbox"
            checked={settings.showA1Notation}
            onClick={() => settings.setShowA1Notation(!settings.showA1Notation)}
          >
            Show A1 notation on headings
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
      <NewFile open={newFileOpen} handleClose={createNewFile} />
    </>
  );
};
