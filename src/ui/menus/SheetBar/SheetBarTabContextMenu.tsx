import { Menu, MenuItem } from '@mui/material';
import { SheetController } from '../../../grid/controller/sheetController';

interface Props {
  sheetController: SheetController;
  contextMenu?: { x: number; y: number; sheetId: string };
  handleRename: () => void;
  handleClose: () => void;
}

export const SheetBarTabContextMenu = (props: Props): JSX.Element => {
  const { sheetController, contextMenu, handleClose, handleRename } = props;

  return (
    <Menu
      open={!!contextMenu}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
    >
      <MenuItem onClick={handleRename}>
        <b>Rename</b>
      </MenuItem>
      {/* <MenuItem onClick={handleClose}>Duplicate</MenuItem>
      <MenuItem onClick={handleClose}>Delete</MenuItem> */}
      <MenuItem divider />
      <MenuItem
        disabled={sheetController.getFirstSheet().id === contextMenu?.sheetId}
        onClick={() => {
          if (!contextMenu) return;
          sheetController.changeSheetOrder(contextMenu.sheetId, -1);
          handleClose();
        }}
      >
        Move Left
      </MenuItem>
      <MenuItem
        disabled={sheetController.getLastSheet().id === contextMenu?.sheetId}
        onClick={() => {
          if (!contextMenu) return;
          sheetController.changeSheetOrder(contextMenu.sheetId, 1);
          handleClose();
        }}
      >
        Move Right
      </MenuItem>
    </Menu>
  );
};
