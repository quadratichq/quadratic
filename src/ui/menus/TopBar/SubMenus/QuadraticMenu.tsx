import { Check, ContentCopy, ContentCut, ContentPaste, Redo, Undo } from '@mui/icons-material';
import { Menu, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
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
  const { isAuthenticated } = useRootRouteLoaderData();

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
        menuButton={({ open }) => (
          <TopBarMenuItem title="Main menu" open={open}>
            <img src="/favicon.ico" height="22px" alt="Quadratic Icon" />
          </TopBarMenuItem>
        )}
      >
        <MenuItem href={ROUTES.MY_FILES} style={{ textDecoration: 'none' }}>
          <MenuLineItem primary="Back to files" />
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
        <SubMenu label={<MenuLineItem primary="File" />}>
          <MenuItem href={ROUTES.CREATE_FILE} style={{ textDecoration: 'none' }}>
            <MenuLineItem primary="New" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (uuid) {
                apiClient.downloadFile(uuid);
              }
            }}
          >
            <MenuLineItem primary="Download local copy" />
          </MenuItem>
        </SubMenu>
        <SubMenu label={<MenuLineItem primary="Edit" />}>
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
        <SubMenu label={<MenuLineItem primary="View" />}>
          <MenuItem onClick={() => settings.setShowHeadings(!settings.showHeadings)}>
            <MenuLineItem primary="Show row and column headings" Icon={settings.showHeadings && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowGridAxes(!settings.showGridAxes)}>
            <MenuLineItem primary="Show grid axis" Icon={settings.showGridAxes && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowGridLines(!settings.showGridLines)}>
            <MenuLineItem primary="Show grid lines" Icon={settings.showGridLines && Check} indent />
          </MenuItem>
          <MenuItem onClick={() => settings.setShowCellTypeOutlines(!settings.showCellTypeOutlines)}>
            <MenuLineItem primary="Show code cell outlines" Icon={settings.showCellTypeOutlines && Check} indent />
          </MenuItem>
          <MenuDivider />
          <MenuItem onClick={() => settings.setPresentationMode(!settings.presentationMode)}>
            <MenuLineItem primary="Presentation mode" Icon={settings.presentationMode && Check} indent />
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

        <SubMenu label={<MenuLineItem primary="Help" />}>
          <MenuItem onClick={() => window.open(DOCUMENTATION_URL, '_blank')}>
            <MenuLineItem primary="Read the docs" />
          </MenuItem>
          <MenuItem
            onClick={() =>
              setEditorInteractionState((prevState) => ({
                ...prevState,
                showFeedbackMenu: true,
              }))
            }
          >
            <MenuLineItem primary="Provide feedback" />
          </MenuItem>
        </SubMenu>

        {isAuthenticated && (
          <>
            <MenuDivider />
            <MenuItem onClick={() => authClient.logout()}>
              <MenuLineItem primary="Log out" />
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  );
};
