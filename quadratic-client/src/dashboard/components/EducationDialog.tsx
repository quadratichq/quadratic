import { useRootRouteLoaderData } from '@/router';
import { getUpdateEducationAction } from '@/routes/education';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';
import { SchoolOutlined } from '@mui/icons-material';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useState } from 'react';
import { FetcherWithComponents, useFetcher } from 'react-router-dom';

export function EducationDialog({
  children,
}: {
  children?: ({ fetcher }: { fetcher: FetcherWithComponents<ApiTypes['/v0/education.POST.response']> }) => void;
}) {
  const [open, onOpenChange] = useState<boolean>(false);
  const fetcher = useFetcher<ApiTypes['/v0/education.POST.response']>();
  const { loggedInUser } = useRootRouteLoaderData();

  // TODO: localstorage get when this last fetched so we can throttle every few mins
  // TODO: if they're enrolled, just don't do this at all

  const handleClose = () => {
    onOpenChange(false);
    // const { data, options } = getUpdateEducationAction('NOT_ENROLLED');
    // fetcher.submit(data, options);
  };

  useEffect(() => {
    if (fetcher.state === 'idle' && !fetcher.data) {
      const email = loggedInUser?.email;
      if (typeof email === 'undefined') {
        // TODO: Sentry warning that a user doesn't have an email
        return;
      }

      const { data, options } = getUpdateEducationAction({ email });
      fetcher.submit(data, options);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loggedInUser?.email === undefined) {
    return null;
  }

  const content = typeof children === 'function' ? children({ fetcher }) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-center sm:text-center">
            <div className="flex flex-col items-center py-4">
              <SchoolOutlined sx={{ fontSize: '64px' }} className="text-primary" />
            </div>
            <DialogTitle>Enrolled in Quadratic for Education</DialogTitle>
            <DialogDescription>
              You have an educational email address which qualifies you for{' '}
              <a href="TODO:" target="_blank" rel="noreferrer" className="underline hover:text-primary">
                the education plan
              </a>{' '}
              where students, teachers, and researchers get free access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="justify-center text-center sm:justify-center">
            <Button onClick={handleClose}>Ok, thanks</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {content}
    </>
  );
}
