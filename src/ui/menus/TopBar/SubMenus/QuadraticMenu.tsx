import { ContentCopy, ContentCut, ContentPaste, Redo, Undo } from '@mui/icons-material';
import { Menu, MenuDivider, MenuHeader, MenuItem, SubMenu } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import { useEffect } from 'react';
import { isMobile } from 'react-device-detect';
import { useParams } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { apiClient } from '../../../../api/apiClient';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { gridInteractionStateAtom } from '../../../../atoms/gridInteractionStateAtom';
import { authClient } from '../../../../auth';
import { ROUTES } from '../../../../constants/routes';
import { DOCUMENTATION_URL } from '../../../../constants/urls';
import { copyToClipboard, cutToClipboard, pasteFromClipboard } from '../../../../grid/actions/clipboard/clipboard';
import { SheetController } from '../../../../grid/controller/sheetController';
import { focusGrid } from '../../../../helpers/focusGrid';
import { KeyboardSymbols } from '../../../../helpers/keyboardSymbols';
import { useRootRouteLoaderData } from '../../../../router';
import { isMac } from '../../../../utils/isMac';
import { MenuLineItem } from '../MenuLineItem';
import { TopBarMenuItem } from '../TopBarMenuItem';
import { useGridSettings } from './useGridSettings';

interface Props {
  sheetController: SheetController;
}

export const QuadraticMenu = (props: Props) => {
  const { sheetController } = props;
  const interactionState = useRecoilValue(gridInteractionStateAtom);
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const settings = useGridSettings();
  const { uuid } = useParams();
  const { isAuthenticated, user } = useRootRouteLoaderData();

  // For mobile, set Headers to not visible by default
  useEffect(() => {
    if (isMobile) {
      settings.setShowHeadings(false);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <Menu
        menuButton={
          <div>
            <TopBarMenuItem title="Main menu">
              <img src="/favicon.ico" height="22px" alt="Quadratic Icon" />
            </TopBarMenuItem>
          </div>
        }
      >
        <MenuItem href={ROUTES.MY_FILES} style={{ textDecoration: 'none' }}>
          Back to files
        </MenuItem>
        <MenuDivider />
        <MenuItem
          onClick={() => {
            setEditorInteractionState({
              ...editorInteractionState,
              showCommandPalette: true,
            });
            focusGrid();
          }}
        >
          <MenuLineItem primary="Command palette" secondary={KeyboardSymbols.Command + 'P'} />
        </MenuItem>
        <MenuDivider />
        <SubMenu label="File">
          <MenuItem href={ROUTES.CREATE_FILE} style={{ textDecoration: 'none' }}>
            New
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (uuid) {
                apiClient.downloadFile(uuid);
              }
            }}
          >
            Download local copy
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
              secondary={isMac ? KeyboardSymbols.Command + KeyboardSymbols.Shift + 'Z' : KeyboardSymbols.Command + 'Y'}
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
        </SubMenu>

        {isAuthenticated && (
          <SubMenu label="Account">
            <MenuHeader>{user?.email}</MenuHeader>
            <MenuItem onClick={() => authClient.logout()}>Log out</MenuItem>
          </SubMenu>
        )}

        <SubMenu label="Help">
          <MenuItem onClick={() => window.open(DOCUMENTATION_URL, '_blank')}>Read the docs</MenuItem>
          <MenuItem
            onClick={() =>
              setEditorInteractionState((prevState) => ({
                ...prevState,
                showFeedbackMenu: true,
              }))
            }
          >
            Provide feedback
          </MenuItem>
        </SubMenu>
      </Menu>
    </>
  );
};
