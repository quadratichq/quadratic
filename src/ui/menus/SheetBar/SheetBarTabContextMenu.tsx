import { ControlledMenu, MenuDivider, MenuItem, SubMenu } from '@szhsin/react-menu';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { SheetController } from '../../../grid/controller/sheetController';
import { useState } from 'react';
import { QColorPicker } from '../../components/qColorPicker';
import { convertReactColorToString } from '../../../helpers/convertColor';
import { ColorResult } from 'react-color';

interface Props {
  sheetController: SheetController;
  contextMenu?: { x: number; y: number; id: string; name: string };
  handleRename: () => void;
  handleClose: () => void;
}

export const SheetBarTabContextMenu = (props: Props): JSX.Element => {
  const { sheetController, contextMenu, handleClose, handleRename } = props;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | undefined>();

  return (
    <>
      <ControlledMenu
        className="sheet-bar-context-menu"
        state={!!contextMenu ? 'open' : 'closed'}
        onClose={handleClose}
        anchorPoint={contextMenu ? { x: contextMenu?.x, y: contextMenu?.y } : undefined}
      >
        <MenuItem onClick={handleRename}>
          <b>Rename</b>
        </MenuItem>
        {/* <MenuItem onClick={handleClose}>Duplicate</MenuItem> */}
        <MenuItem
          onClick={() => {
            if (!contextMenu) return;
            setConfirmDelete({ ...contextMenu });
            handleClose();
          }}
        >
          Delete
        </MenuItem>
        <SubMenu label="Change Color">
          <QColorPicker
            onChangeComplete={(change: ColorResult) => {
              const color = convertReactColorToString(change);
              if (contextMenu) {
                sheetController.changeSheetColor(contextMenu.id, color);
              }
              handleClose();
            }}
            onClear={() => {
              if (contextMenu) {
                sheetController.changeSheetColor(contextMenu.id);
              }
              handleClose();
            }}
          />
        </SubMenu>
        <MenuDivider />
        <MenuItem
          disabled={sheetController.getFirstSheet().id === contextMenu?.id}
          onClick={() => {
            if (contextMenu) {
              sheetController.changeSheetOrder(contextMenu.id, -1);
            }
            handleClose();
          }}
        >
          Move Left
        </MenuItem>
        <MenuItem
          disabled={sheetController.getLastSheet().id === contextMenu?.id}
          onClick={() => {
            if (contextMenu) {
              sheetController.changeSheetOrder(contextMenu.id, 1);
            }
            handleClose();
          }}
        >
          Move Right
        </MenuItem>
      </ControlledMenu>
      <Dialog open={!!confirmDelete}>
        <DialogTitle>Delete Sheet</DialogTitle>
        <DialogContent>Are you sure you want to delete {confirmDelete?.name}?</DialogContent>
        <DialogActions>
          <Button
            autoFocus
            onClick={() => {
              setConfirmDelete(undefined);
              handleClose();
            }}
          >
            Cancel
          </Button>
          <Button
            color="warning"
            onClick={() => {
              if (confirmDelete) {
                sheetController.deleteSheet(confirmDelete.id);
              }
              setConfirmDelete(undefined);
              handleClose();
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
