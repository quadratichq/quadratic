import { Alert } from '@mui/material';
import { useState } from 'react';
import { QuadraticSnackBar } from './QuadraticSnackBar';

export default function InitialPageLoadError() {
  const [open, setOpen] = useState<boolean>(true);

  const onClose = () => {
    setOpen(false);
  };

  return (
    <QuadraticSnackBar open={open} onClose={onClose} autoHideDuration={8000}>
      <Alert severity="error" onClose={onClose} elevation={6}>
        Failed to load the file specified in URL.
      </Alert>
    </QuadraticSnackBar>
  );
}
