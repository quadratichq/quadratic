import { Alert, Button, Paper, useTheme } from '@mui/material';
import { Permission, permissionSchema } from '../../api/types';
const { ANONYMOUS, VIEWER } = permissionSchema.enum;

export function PermissionOverlay({ permission }: { permission: Permission }) {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: theme.spacing(8),
        transform: 'translateX(25%)',
        width: '100%',
        maxWidth: '40rem',
        zIndex: '10',
      }}
      elevation={4}
    >
      {/* TODO refine positioning on the action buttons — they're off by default */}
      {permission === ANONYMOUS && (
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
      {permission === VIEWER && (
        <Alert
          variant="outlined"
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Button variant="outlined" size="small" disableElevation>
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
