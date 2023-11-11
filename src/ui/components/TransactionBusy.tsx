import { CircularProgress, Fade, Snackbar } from '@mui/material';
import { useEffect, useState } from 'react';
import { colors } from '../../theme/colors';

export const TransactionBusy = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handle = () => setOpen(true);
    window.addEventListener('transaction-busy', handle);
    return () => window.removeEventListener('transaction-busy', handle);
  }, []);

  // close an async snackbar message
  useEffect(() => {
    const handle = () => setOpen(false);
    window.addEventListener('transaction-complete', handle);
    return () => window.addEventListener('transaction-complete', handle);
  });

  return (
    <Snackbar
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      open={open}
      TransitionComponent={Fade}
      sx={{
        '& .MuiSnackbarContent-root': {
          backgroundColor: colors.warning,
          color: 'white',
        },
      }}
      message=<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div style={{ marginRight: '2rem' }}>Spreadsheet busy. Try again.</div>
        <CircularProgress size={20} sx={{ color: 'white' }} />
      </div>
    />
  );
};
