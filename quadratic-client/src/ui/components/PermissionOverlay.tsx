import { useRootRouteLoaderData } from '@/router';
import { Alert, Button, Paper, Stack, useTheme } from '@mui/material';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import React, { useState } from 'react';
import { isMobile } from 'react-device-detect';
import { Link, useSubmit } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { duplicateFileAction } from '../../actions';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { ROUTES } from '../../constants/routes';
import { useFileContext } from './FileProvider';
const { FILE_EDIT } = FilePermissionSchema.enum;

export function PermissionOverlay() {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const { permissions } = useRecoilValue(editorInteractionStateAtom);
  const { name } = useFileContext();
  const theme = useTheme();
  const submit = useSubmit();
  const { isAuthenticated } = useRootRouteLoaderData();

  // This component assumes that the file can be viewed in some way, either by
  // a logged in user or a logged out user where the file's link is public.
  // This render path will never be reached if the user doesn't have access to the file.

  // If you're not logged in, we've got a message for you
  if (!isAuthenticated) {
    return (
      <Wrapper>
        <Alert
          variant="outlined"
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Stack direction="row" gap={theme.spacing(1)}>
              <Button component={Link} to={ROUTES.LOGIN_WITH_REDIRECT()} variant="outlined" size="small">
                Log in
              </Button>
              <Button
                component={Link}
                to={ROUTES.SIGNUP_WITH_REDIRECT()}
                variant="contained"
                size="small"
                disableElevation
              >
                Sign up
              </Button>
            </Stack>
          }
        >
          <strong>Welcome to Quadratic.</strong> You must log in to edit this file.
        </Alert>
      </Wrapper>
    );
  }

  // If you can't edit the file, we've got a message for you
  if (!permissions.includes(FILE_EDIT)) {
    return (
      <Wrapper>
        <Alert
          variant="outlined"
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Button
              variant="outlined"
              size="small"
              disableElevation
              onClick={() => duplicateFileAction.run({ name, submit })}
            >
              {duplicateFileAction.label}
            </Button>
          }
        >
          <strong>Read-only.</strong> To edit this file, make a duplicate in your files.
        </Alert>
      </Wrapper>
    );
  }

  // If you can edit the file, but you're on mobile, we've got a message for you
  // Note: it's possible somebody can edit this file on mobile but they aren't
  // logged in. They won't see this. They'll see the "Log in" message above.
  if (permissions.includes(FILE_EDIT) && isMobile && isOpen) {
    return (
      <Wrapper>
        <Alert variant="outlined" severity="info" sx={{ width: '100%' }} onClose={() => setIsOpen(false)}>
          <strong>Read-only on mobile.</strong> Open on desktop to edit cells and run code.
        </Alert>
      </Wrapper>
    );
  }

  return null;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: theme.spacing(8),
        transform: 'translateX(-50%)',
        left: '50%',
        width: '95%',
        maxWidth: '40rem',
        zIndex: '10',
      }}
      elevation={4}
    >
      {children}
    </Paper>
  );
}
