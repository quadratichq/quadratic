import '@szhsin/react-menu/dist/index.css';
import { useContext, useEffect } from 'react';
import Button from '@mui/material/Button';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import { Menu, MenuItem, SubMenu, MenuDivider, MenuHeader } from '@szhsin/react-menu';
import { IS_READONLY_MODE } from '../../../../constants/app';
import { useGridSettings } from './useGridSettings';
import { useAuth0 } from '@auth0/auth0-react';
import useLocalStorage from '../../../../hooks/useLocalStorage';
import { Tooltip } from '@mui/material';
import { DOCUMENTATION_URL, BUG_REPORT_URL } from '../../../../constants/urls';
import { SheetController } from '../../../../grid/controller/sheetController';
import { MenuLineItem } from '../MenuLineItem';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../../../../grid/actions/clipboard/clipboard';
import { useRecoilState, useRecoilValue } from 'recoil';
import { gridInteractionStateAtom } from '../../../../atoms/gridInteractionStateAtom';
import { ContentCopy, ContentCut, ContentPaste, Undo, Redo } from '@mui/icons-material';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { PixiApp } from '../../../../gridGL/pixiApp/PixiApp';
import { LocalFilesContext } from '../../../QuadraticUIContext';

interface Props {
  sheetController: SheetController;
  app: PixiApp;
}

export const QuadraticMenu = (props: Props) => {
  const { app, sheetController } = props;
  const [showDebugMenu, setShowDebugMenu] = useLocalStorage('showDebugMenu', false);
  const interactionState = useRecoilValue(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const settings = useGridSettings();

  const { createNewFile, downloadCurrentFile } = useContext(LocalFilesContext);

  const { isAuthenticated, user, logout } = useAuth0();

  // For readonly, set Headers to not visible by default
  useEffect(() => {
    if (IS_READONLY_MODE) {
      settings.setShowHeadings(false);
    }
    // eslint-disable-next-line
  }, []);

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
        <MenuItem
          onClick={() => {
            setEditorInteractionState((oldState) => ({ ...oldState, showFileMenu: true }));
          }}
        >
          <MenuLineItem primary="Back to files" secondary={KeyboardSymbols.Command + 'O'} />
        </MenuItem>
        <MenuDivider />
        <SubMenu label="File">
          <MenuItem
            onClick={() => {
              app.reset();
              createNewFile();
            }}
          >
            New
          </MenuItem>
          <MenuItem onClick={() => downloadCurrentFile()}>Download local copy</MenuItem>
          <MenuItem
            onClick={() => {
              setEditorInteractionState({
                ...editorInteractionState,
                showFileMenu: true,
              });
            }}
          >
            <MenuLineItem primary="Open…" secondary={KeyboardSymbols.Command + 'O'} />
          </MenuItem>
        </SubMenu>
        <SubMenu label="Edit">
          <MenuItem
            onClick={() => {
              sheetController.undo();
            }}
          >
            <MenuLineItem primary="Undo" secondary={KeyboardSymbols.Command + 'Z'} Icon={Undo}></MenuLineItem>
          </MenuItem>
          <MenuItem
            onClick={() => {
              sheetController.redo();
            }}
          >
            <MenuLineItem
              primary="Redo"
              secondary={KeyboardSymbols.Command + KeyboardSymbols.Shift + 'Z'}
              Icon={Redo}
            ></MenuLineItem>
          </MenuItem>
          <MenuDivider />
          <MenuItem
            onClick={() => {
              cutToClipboard(
                sheetController,
                {
                  x: interactionState.multiCursorPosition.originPosition.x,
                  y: interactionState.multiCursorPosition.originPosition.y,
                },
                {
                  x: interactionState.multiCursorPosition.terminalPosition.x,
                  y: interactionState.multiCursorPosition.terminalPosition.y,
                }
              );
            }}
          >
            <MenuLineItem primary="Cut" secondary={KeyboardSymbols.Command + 'X'} Icon={ContentCut}></MenuLineItem>
          </MenuItem>
          <MenuItem
            onClick={() => {
              copyToClipboard(
                props.sheetController,
                interactionState.multiCursorPosition.originPosition,
                interactionState.multiCursorPosition.terminalPosition
              );
            }}
          >
            <MenuLineItem primary="Copy" secondary={KeyboardSymbols.Command + 'C'} Icon={ContentCopy}></MenuLineItem>
          </MenuItem>
          <MenuItem
            onClick={() => {
              pasteFromClipboard(props.sheetController, interactionState.cursorPosition);
            }}
          >
            <MenuLineItem primary="Paste" secondary={KeyboardSymbols.Command + 'V'} Icon={ContentPaste}></MenuLineItem>
          </MenuItem>
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
            Show grid axis
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
            Show code cell outlines
          </MenuItem>
          <MenuDivider />
          <MenuItem
            type="checkbox"
            checked={settings.presentationMode}
            onClick={() => settings.setPresentationMode(!settings.presentationMode)}
          >
            Presentation mode
          </MenuItem>
          {/*
          Commented out because the editor switches this state automatically when the user
          is editing a formula.
          <MenuItem
            type="checkbox"
            checked={settings.showA1Notation}
            onClick={() => settings.setShowA1Notation(!settings.showA1Notation)}
          >
            Show A1 notation on headings
          </MenuItem> */}
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
    </>
  );
};
