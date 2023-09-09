import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { sheetController } from '../../../grid/controller/SheetController';

interface Props {
  // holds the last sheet's name so when it's deleted the name dialog doesn't change as it's closing
  lastName?: string;

  confirmDelete: { id: string; name: string } | undefined;
  handleClose: () => void;
}

export const ConfirmDeleteSheet = (props: Props): JSX.Element => {
  const { confirmDelete, lastName, handleClose } = props;

  return (
    <Dialog open={!!confirmDelete?.name}>
      <DialogTitle>Delete Sheet</DialogTitle>
      <DialogContent>Are you sure you want to delete {confirmDelete?.name ?? lastName}?</DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          color="warning"
          onClick={() => {
            if (confirmDelete) {
              sheetController.sheets.deleteSheet(sheetController.sheet.id);
            }
            handleClose();
          }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};
