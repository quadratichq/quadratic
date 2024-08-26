import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Box } from '@mui/material';
import { ControlledMenu, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import mixpanel from 'mixpanel-browser';
import { ColorResult } from 'react-color';
import { sheets } from '../../../grid/controller/Sheets';
import { convertReactColorToString } from '../../../helpers/convertColor';
import { focusGrid } from '../../../helpers/focusGrid';
import { QColorPicker } from '../../components/qColorPicker';

interface Props {
  contextMenu?: { x: number; y: number; id: string; name: string };
  handleRename: () => void;
  handleClose: () => void;
}

export const SheetBarTabContextMenu = (props: Props): JSX.Element => {
  const { contextMenu, handleClose, handleRename } = props;

  return (
    <Box sx={{ fontSize: '.875rem' }}>
      <ControlledMenu
        state={!!contextMenu ? 'open' : 'closed'}
        onClose={handleClose}
        anchorPoint={contextMenu ? { x: contextMenu?.x, y: contextMenu?.y } : undefined}
      >
        <MenuItem
          onClick={() => {
            if (!contextMenu) return;
            if (window.confirm(`Are you sure you want to delete ${contextMenu.name}?`)) {
              mixpanel.track('[Sheets].delete');
              sheets.userDeleteSheet(sheets.sheet.id);
              handleClose();
            }
            handleClose();
            setTimeout(focusGrid);
          }}
        >
          Delete
        </MenuItem>
        <MenuItem
          onClick={handleClose}
          onClickCapture={() => {
            mixpanel.track('[Sheets].duplicate');
            sheets.duplicate();
            focusGrid();
          }}
        >
          Duplicate
        </MenuItem>
        <SubMenu label="Change color" className="color-picker-submenu">
          <QColorPicker
            onChangeComplete={(change: ColorResult) => {
              const color = convertReactColorToString(change);
              if (contextMenu) {
                sheets.sheet.color = color;
                quadraticCore.setSheetColor(sheets.sheet.id, color, sheets.getCursorPosition());
                focusGrid();
              }
              handleClose();
            }}
            onClear={() => {
              if (contextMenu) {
                sheets.sheet.color = undefined;
                quadraticCore.setSheetColor(sheets.sheet.id, undefined, sheets.getCursorPosition());
                focusGrid();
              }
              handleClose();
            }}
          />
        </SubMenu>
        <SubMenu label="Change size of sheet">
          <MenuItem
            onClick={() => {
              quadraticCore.setSheetSize(sheets.sheet.id, undefined, undefined, true, sheets.getCursorPosition());
              handleClose();
            }}
          >
            Auto size based on content
          </MenuItem>
          <MenuItem
            onClick={() => {
              quadraticCore.setSheetSize(sheets.sheet.id, undefined, undefined, false, sheets.getCursorPosition());
              handleClose();
            }}
          >
            Remove sheet size
          </MenuItem>
        </SubMenu>

        <MenuItem onClick={handleRename}>Rename</MenuItem>
        <MenuDivider />
        <MenuItem
          disabled={sheets.getFirst().id === contextMenu?.id}
          onClick={() => {
            if (contextMenu) {
              sheets.moveSheet({ id: sheets.sheet.id, delta: -1 });
              focusGrid();
            }
            handleClose();
          }}
        >
          Move left
        </MenuItem>
        <MenuItem
          disabled={sheets.getLast().id === contextMenu?.id}
          onClick={() => {
            if (contextMenu) {
              sheets.moveSheet({ id: sheets.sheet.id, delta: 1 });
              focusGrid();
            }
            handleClose();
          }}
        >
          Move right
        </MenuItem>
      </ControlledMenu>
      {/* <ConfirmDeleteSheet
        lastName={lastName}
        confirmDelete={confirmDelete}
        handleClose={() => {
          setConfirmDelete(undefined);
          window.setTimeout(focusGrid, 0);
        }}
      /> */}
    </Box>
  );
};
