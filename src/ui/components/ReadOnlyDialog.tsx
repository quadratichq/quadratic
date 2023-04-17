import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import useLocalStorage from '../../hooks/useLocalStorage';

export default function ReadOnlyDialog() {
  const [showReadOnlyMsg, setShowReadOnlyMsg] = useLocalStorage('showReadOnlyMsg', true);
  const handleClose = () => {
    setShowReadOnlyMsg(false);
  };
  return (
    <Dialog
      open={showReadOnlyMsg}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">Quadratic is built for desktop</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          On mobile, sheets are read-only. To edit sheets, run code, and use the full power of the app, open it on your
          desktop computer.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} autoFocus>
          Ok, thanks
        </Button>
      </DialogActions>
    </Dialog>
  );
}
