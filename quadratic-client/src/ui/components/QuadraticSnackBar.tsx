import { Fade, Snackbar, SnackbarProps } from '@mui/material';

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
