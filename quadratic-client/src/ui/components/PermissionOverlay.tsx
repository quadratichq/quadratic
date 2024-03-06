import { Type } from '@/components/Type';
import { useRootRouteLoaderData } from '@/router';
import { Button } from '@/shadcn/ui/button';
import { Stack, useTheme } from '@mui/material';
import { Cross2Icon } from '@radix-ui/react-icons';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import React, { useState } from 'react';
import { isMobile } from 'react-device-detect';
import { Link, useParams, useSubmit } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { duplicateFileWithUserAsOwnerAction } from '../../actions';
import { editorInteractionStateAtom } from '../../atoms/editorInteractionStateAtom';
import { ROUTES } from '../../constants/routes';
const { FILE_EDIT } = FilePermissionSchema.enum;

export function PermissionOverlay() {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const { permissions } = useRecoilValue(editorInteractionStateAtom);
  const { uuid } = useParams() as { uuid: string };
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
        <Type>
          <strong>Welcome to Quadratic.</strong> You must log in to edit this file.
        </Type>
        <Stack direction="row" gap={theme.spacing(1)}>
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.LOGIN_WITH_REDIRECT()}>Log in</Link>
          </Button>
          <Button size="sm">
            <Link to={ROUTES.SIGNUP_WITH_REDIRECT()}>Sign up</Link>
          </Button>
        </Stack>
      </Wrapper>
    );
  }

  // If you can't edit the file, we've got a message for you
  if (!permissions.includes(FILE_EDIT)) {
    return (
      <Wrapper>
        <Type>
          <strong>Read-only.</strong> To edit this file, make a duplicate in your files.
        </Type>
        <Button
          className="flex-shrink-0"
          variant="outline"
          size="sm"
          onClick={() => duplicateFileWithUserAsOwnerAction.run({ uuid, submit })}
        >
          {duplicateFileWithUserAsOwnerAction.label}
        </Button>
      </Wrapper>
    );
  }

  // If you can edit the file, but you're on mobile, we've got a message for you
  // Note: it's possible somebody can edit this file on mobile but they aren't
  // logged in. They won't see this. They'll see the "Log in" message above.
  if (permissions.includes(FILE_EDIT) && isMobile && isOpen) {
    return (
      <Wrapper>
        <Type>
          <strong>Read-only on mobile.</strong> Open on desktop to edit cells and run code.
        </Type>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <Cross2Icon />
        </Button>
      </Wrapper>
    );
  }

  return null;
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-16 left-1/2 z-10  flex w-[95%] max-w-xl -translate-x-1/2 flex-row items-center justify-between gap-4 rounded border border-border bg-background px-4 py-3 shadow-lg">
      {children}
    </div>
  );
}
