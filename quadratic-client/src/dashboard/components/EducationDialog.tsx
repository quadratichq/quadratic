import { apiClient } from '@/shared/api/apiClient';
import { QUADRATIC_FOR_EDUCATION } from '@/shared/constants/urls';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
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

type CustomRequest = {
  state: 'idle' | 'loading' | 'error';
  lastFetched?: number;
  data?: ApiTypes['/v0/education.GET.response'];
};

export function EducationDialog({ children }: { children?: (params: { isEnrolled: boolean }) => void }) {
  // We'll store state in localstorage so we throttle checking this data
  const [request, setRequest] = useLocalStorage<CustomRequest>('educationDialogRequest', {
    state: 'idle',
    data: undefined,
    lastFetched: undefined,
  });
  const [open, onOpenChange] = useState<boolean>(false);

  const needsToFetchData =
    // If they've never fetched the data, they need to go get it
    request.lastFetched === undefined
      ? true
      : // If they’re already enrolled, don't check for a while
      request.data?.eduStatus === 'ENROLLED'
      ? (Date.now() - request.lastFetched) / 1000 > 3600 // 1 hour
      : // Otherwise check a little more frequently
        (Date.now() - request.lastFetched) / 1000 > 60; // 1 min

  // When the component mounts, check to see if we need to fetch data
  useEffect(() => {
    if (needsToFetchData) {
      setRequest((prev) => ({ ...prev, state: 'loading' }));
      apiClient.education
        .get()
        .then((data) => {
          setRequest({ state: 'idle', data, lastFetched: Date.now() });

          // If this is the first time the server says they're newly enrolled, open the dialog
          if (data.isNewlyEnrolled) {
            onOpenChange(true);
          }
        })
        .catch((err) => {
          setRequest((prev) => ({ ...prev, state: 'error' }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content =
    typeof children === 'function' ? children({ isEnrolled: request.data?.eduStatus === 'ENROLLED' }) : null;
  const handleClose = () => {
    onOpenChange(false);
  };

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
              <a
                href={QUADRATIC_FOR_EDUCATION}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
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
