import { Alert, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { JSX } from 'react/jsx-runtime';
import { QuadraticSnackBar } from './components/QuadraticSnackBar';

export const VersionControl = (): JSX.Element | null => {
  const [showDialog, setShowDialog] = useState<false | 'recommended' | 'required'>(false);
  useEffect(() => {
    const needRefresh = (message: any /* { details: 'required' | 'recommended' } */) => setShowDialog(message.detail);
    window.addEventListener('need-refresh', needRefresh);
    return () => {
      window.removeEventListener('need-refresh', needRefresh);
    };
  });

  if (!showDialog) return null;

  return (
    <QuadraticSnackBar open={!!showDialog} autoHideDuration={null}>
      <Alert severity={showDialog === 'recommended' ? 'warning' : 'error'}>
        Quadratic has been updated. We {showDialog === 'recommended' ? 'recommend' : 'require'} you refresh your browser
        to get the latest version.
        <div className="mt-4 flex justify-end gap-4">
          <Button variant="contained" onClick={() => window.location.reload()}>
            Refresh
          </Button>
          {showDialog === 'recommended' && (
            <Button variant="outlined" onClick={() => setShowDialog(false)}>
              Dismiss
            </Button>
          )}
        </div>
      </Alert>
    </QuadraticSnackBar>
  );
};
