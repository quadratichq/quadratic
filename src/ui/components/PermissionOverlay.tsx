import { Alert, Button, Paper, useTheme } from '@mui/material';
import { Link, useSubmit } from 'react-router-dom';
import { duplicateFile } from '../../actions';
import { Permission, PermissionSchema } from '../../api/types';
import { ROUTES } from '../../constants/routes';
import { useFileContext } from './FileProvider';
const { ANONYMOUS, VIEWER } = PermissionSchema.enum;

export function PermissionOverlay({ permission }: { permission: Permission }) {
  const theme = useTheme();
  const { name, contents } = useFileContext();
  const submit = useSubmit();

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
            <Button component={Link} to={ROUTES.LOGIN} variant="contained" size="small" disableElevation>
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
            <Button
              variant="outlined"
              size="small"
              disableElevation
              onClick={() => duplicateFile.run({ name, contents, submit })}
            >
              {duplicateFile.label}
            </Button>
          }
        >
          <strong>Read-only.</strong> To edit this file, make a duplicate in your files.
        </Alert>
      )}
    </Paper>
  );
}
