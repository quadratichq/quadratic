import { Alert, Button, Paper, useTheme } from '@mui/material';

export function PermissionOverlay({ permission }: { permission: 'ANONYMOUS' | 'VIEWER' }) {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        position: 'fixed',
        top: theme.spacing(10),
        transform: 'translateX(-50%)',
        left: '50%',
        width: '40rem',
        zIndex: '10',
      }}
      elevation={4}
    >
      {/* TODO refine positioning on the action buttons — they're off by default */}
      {permission === 'ANONYMOUS' && (
        <Alert
          variant="outlined"
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Button variant="contained" size="small" disableElevation>
              Log in
            </Button>
          }
        >
          <strong>Welcome to Quadratic.</strong> You must log in to edit this file.
        </Alert>
      )}
      {permission === 'VIEWER' && (
        <Alert
          variant="outlined"
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Button variant="contained" size="small" disableElevation>
              Duplicate
            </Button>
          }
        >
          <strong>Read-only.</strong> To edit this file, make a duplicate in your files.
        </Alert>
      )}
    </Paper>
  );
}
