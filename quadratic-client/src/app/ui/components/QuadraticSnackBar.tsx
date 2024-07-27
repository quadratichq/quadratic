import { Fade, Snackbar } from '@mui/material';
import type { SnackbarProps } from '@mui/material';

export const QuadraticSnackBar = (props: SnackbarProps) => {
  return (
    <Snackbar
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      autoHideDuration={4000}
      TransitionComponent={Fade}
      {...props}
    />
  );
};
