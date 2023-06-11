import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Menu, MenuItem } from '@mui/material';
import { SheetController } from '../../../grid/controller/sheetController';
import { useState } from 'react';
import { Sheet } from '../../../grid/sheet/Sheet';

interface Props {
  sheetController: SheetController;
  contextMenu?: { x: number; y: number; sheet: Sheet };
  handleRename: () => void;
  handleClose: () => void;
}

export const SheetBarTabContextMenu = (props: Props): JSX.Element => {
  const { sheetController, contextMenu, handleClose, handleRename } = props;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [confirmDelete, setConfirmDelete] = useState<Sheet | undefined>();

  return (
    <>
      <Menu
        open={!!contextMenu}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
      >
        <MenuItem onClick={handleRename}>
          <b>Rename</b>
        </MenuItem>
        {/* <MenuItem onClick={handleClose}>Duplicate</MenuItem> */}
        <MenuItem
          onClick={() => {
            if (!contextMenu) return;
            setConfirmDelete(contextMenu.sheet);
            handleClose();
          }}
        >
          Delete
        </MenuItem>
        <MenuItem divider />
        <MenuItem
          disabled={sheetController.getFirstSheet().id === contextMenu?.sheet.id}
          onClick={() => {
            if (!contextMenu) return;
            sheetController.changeSheetOrder(contextMenu.sheet.id, -1);
            handleClose();
          }}
        >
          Move Left
        </MenuItem>
        <MenuItem
          disabled={sheetController.getLastSheet().id === contextMenu?.sheet.id}
          onClick={() => {
            if (!contextMenu) return;
            sheetController.changeSheetOrder(contextMenu.sheet.id, 1);
            handleClose();
          }}
        >
          Move Right
        </MenuItem>
      </Menu>
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
