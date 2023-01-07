import '@szhsin/react-menu/dist/index.css';

import { useCallback, useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, SubMenu, MenuDivider, MenuHeader } from '@szhsin/react-menu';
import { MenuBookOutlined, FileOpenOutlined, SaveOutlined, BugReportOutlined, CreateOutlined } from '@mui/icons-material';
import { isMobileOnly } from 'react-device-detect';
import { useGridSettings } from './useGridSettings';
import useLocalStorage from '../../../../hooks/useLocalStorage';
import { Tooltip } from '@mui/material';
import { SaveGridFile } from '../../../../core/actions/gridFile/SaveGridFile';
import { newGridFile, openExampleGridFile, openGridFile, openLocalGridFile } from '../../../../core/actions/gridFile/OpenGridFile';
import { menuItemIconStyles } from './menuStyles';
import { colors } from '../../../../theme/colors';
import { DOCUMENTATION_URL, BUG_REPORT_URL } from '../../../../constants/urls';
import { useLocalFiles } from '../../../../hooks/useLocalFiles';
import { SheetController } from '../../../../core/transaction/sheetController';
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

  // On Mobile set Headers to not visible by default
  useEffect(() => {
    if (isMobileOnly) {
      settings.setShowHeadings(false);
    }
    // eslint-disable-next-line
  }, []);

  const { fileList } = useLocalFiles();

  const createNewFile = useCallback((filename?: string) => {
    if (filename) {
      newGridFile(filename, props.sheetController);
    }
    setNewFileOpen(false);
  }, []);

  return (
    <>
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
          <MenuItem onClick={() => setNewFileOpen(true)}>
            <CreateOutlined style={menuItemIconStyles} /> New Grid
          </MenuItem>
          <MenuItem onClick={() => SaveGridFile(sheet, true)}>
            <SaveOutlined style={menuItemIconStyles}></SaveOutlined> Save Grid
          </MenuItem>
          <MenuItem onClick={() => openGridFile(sheetController)}>
            <FileOpenOutlined style={menuItemIconStyles} /> Open Grid
          </MenuItem>
          <MenuDivider />
          <SubMenu label="Sample Files">
            {examples.map(filename => (
              <MenuItem
                key={`sample-${filename}`}
                onClick={() => openExampleGridFile(filename, sheetController)}
              >{filename}</MenuItem>
            ))}
          </SubMenu>
          {fileList.length ? <MenuDivider /> : null}
          {fileList.length
            ? fileList.map((entry) => (
                <MenuItem key={entry} onClick={() => openLocalGridFile(entry, sheetController)}>
                  {entry}
                </MenuItem>
              ))
            : null}
        </SubMenu>
        <SubMenu label="Import">
          <MenuHeader>Import</MenuHeader>
          <MenuItem disabled>CSV (coming soon)</MenuItem>
          <MenuItem disabled>Excel (coming soon)</MenuItem>
        </SubMenu>
        <SubMenu label="View">
          <MenuHeader>UI</MenuHeader>
          <MenuItem
            type="checkbox"
            checked={settings.showHeadings}
            onClick={() => settings.setShowHeadings(!settings.showHeadings)}
          >
            Show Headings
          </MenuItem>
          <MenuHeader>Grid</MenuHeader>
          <MenuItem
            type="checkbox"
            checked={settings.showGridAxes}
            onClick={() => settings.setShowGridAxes(!settings.showGridAxes)}
          >
            Show Axis
          </MenuItem>
          <MenuItem
            type="checkbox"
            checked={settings.showGridLines}
            onClick={() => settings.setShowGridLines(!settings.showGridLines)}
          >
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
      <NewFile open={newFileOpen} handleClose={createNewFile} />
    </>
  );
};
