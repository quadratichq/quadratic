import { Alert } from '@mui/material';
import { QuadraticSnackBar } from './QuadraticSnackBar';

export default function SharedFileAlert() {
  return (
    <QuadraticSnackBar open={true}>
      <Alert severity="warning" elevation={6}>
        Shared sheets are read-only. To make edits, [TODO duplicate this sheet to your account].
      </Alert>
    </QuadraticSnackBar>
  );
}
