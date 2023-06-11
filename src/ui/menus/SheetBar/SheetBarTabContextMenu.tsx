import { Menu, MenuItem } from '@mui/material';
import { SheetController } from '../../../grid/controller/sheetController';

interface Props {
  sheetController: SheetController;
  contextMenu?: { x: number; y: number; sheetId: string };
  handleClose: () => void;
}

export const SheetBarTabContextMenu = (props: Props): JSX.Element => {
  const { sheetController, contextMenu, handleClose } = props;

  return (
    <Menu
      open={!!contextMenu}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
    >
      <MenuItem onClick={handleClose}>Copy</MenuItem>
      <MenuItem onClick={handleClose}>Print</MenuItem>
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
