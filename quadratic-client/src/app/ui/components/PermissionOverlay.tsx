import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useRootRouteLoaderData } from '@/routes/_root';
import { Type } from '@/shared/components/Type';
import { ROUTES } from '@/shared/constants/routes';
import { Button } from '@/shared/shadcn/ui/button';
import { Stack, useTheme } from '@mui/material';
import { Cross2Icon } from '@radix-ui/react-icons';
import { FilePermissionSchema } from 'quadratic-shared/typesAndSchemas';
import React, { useState } from 'react';
import { isMobile } from 'react-device-detect';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
const { FILE_EDIT } = FilePermissionSchema.enum;

export function PermissionOverlay() {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const { permissions } = useRecoilValue(editorInteractionStateAtom);
  const theme = useTheme();
  const { isAuthenticated } = useRootRouteLoaderData();

  // This component assumes that the file can be viewed in some way, either by
  // a logged in user or a logged out user where the file's link is public.
  // This render path will never be reached if the user doesn't have access to the file.

  // If you're not logged in, we've got a message for you
  if (!isAuthenticated) {
    return (
      <FixedBottomAlert>
        <Type>
          <strong>Welcome to Quadratic.</strong>
        </Type>
        <Stack direction="row" gap={theme.spacing(1)} flexShrink={'0'}>
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.LOGIN_WITH_REDIRECT()}>Log in</Link>
          </Button>
          <Button size="sm">
            <Link to={ROUTES.SIGNUP_WITH_REDIRECT()}>Sign up</Link>
          </Button>
        </Stack>
      </FixedBottomAlert>
    );
  }

  // If you can't edit the file, we've got a message for you
  if (!permissions.includes(FILE_EDIT)) {
    return (
      <FixedBottomAlert>
        <Type>
          <strong>Read-only.</strong> Ask the owner for permission to edit this file.
        </Type>
      </FixedBottomAlert>
    );
  }

  // If you can edit the file, but you're on mobile, we've got a message for you
  // Note: it's possible somebody can edit this file on mobile but they aren't
  // logged in. They won't see this. They'll see the "Log in" message above.
  if (permissions.includes(FILE_EDIT) && isMobile && isOpen) {
    return (
      <FixedBottomAlert>
        <Type>
          <strong>Read-only on mobile.</strong> Open on desktop to edit cells and run code.
        </Type>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
          <Cross2Icon />
        </Button>
      </FixedBottomAlert>
    );
  }

  return null;
}

export function FixedBottomAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed bottom-16 left-1/2 z-10  flex w-[95%] max-w-xl -translate-x-1/2 flex-row items-center justify-between gap-4 rounded border border-border bg-background px-4 py-3 shadow-lg">
      {children}
    </div>
  );
}
