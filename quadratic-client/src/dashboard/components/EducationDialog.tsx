import { apiClient } from '@/shared/api/apiClient';
import { QUADRATIC_FOR_EDUCATION } from '@/shared/constants/urls';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/shadcn/ui/alert-dialog';
import { Button } from '@/shared/shadcn/ui/button';
import { SchoolOutlined } from '@mui/icons-material';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useEffect, useState } from 'react';

type CustomRequest = {
  state: 'idle' | 'loading' | 'error';
  eduStatus?: ApiTypes['/v0/education.GET.response']['eduStatus'];
  lastFetched?: number;
};

export function EducationDialog({
  children,
}: {
  children?: (params: { isEnrolled: boolean; isLoading: boolean; checkStatus: () => void }) => void;
}) {
  // We'll store state in localstorage so we throttle checking this data
  const [request, setRequest] = useLocalStorage<CustomRequest>('educationDialogRequest', {
    state: 'idle',
    eduStatus: undefined,
    lastFetched: undefined,
  });
  const [open, onOpenChange] = useState<boolean>(false);

  const checkStatus = () => {
    setRequest((prev) => ({ ...prev, state: 'loading' }));
    apiClient.education
      .get()
      .then(({ eduStatus }) => {
        setRequest({ state: 'idle', eduStatus, lastFetched: Date.now() });

        // If they're eligible, show the dialog
        if (eduStatus === 'ELIGIBLE') {
          onOpenChange(true);
        }
      })
      .catch((err) => {
        setRequest((prev) => ({ ...prev, state: 'error' }));
      });
  };

  // If they've never fetched the data, they need to go get it
  // Otherwise we'll only check for it once and a while
  const needsToFetchData =
    request.lastFetched === undefined ? true : (Date.now() - request.lastFetched) / 1000 > 60 * 5; // 5 min

  // When the component mounts, check to see if we need to fetch data
  useEffect(() => {
    if (needsToFetchData) {
      checkStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content =
    typeof children === 'function'
      ? children({
          isEnrolled: request?.eduStatus === 'ENROLLED',
          isLoading: request.state === 'loading',
          checkStatus,
        })
      : null;

  const handleClose = () => {
    // Optimistically close the dialog
    onOpenChange(false);
    apiClient.education
      .update({ eduStatus: 'ENROLLED' })
      .then((res) => {
        setRequest({ state: 'idle', eduStatus: 'ENROLLED', lastFetched: Date.now() });
      })
      .catch((err) => {
        console.error(err);
        onOpenChange(true);
      });
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader className="text-center sm:text-center">
            <div className="flex flex-col items-center py-4">
              <SchoolOutlined sx={{ fontSize: '64px' }} className="text-primary" />
            </div>
            <AlertDialogTitle>Enrolled in Quadratic for Education</AlertDialogTitle>
            <AlertDialogDescription>
              Your account uses a school email which qualifies you for{' '}
              <a
                href={QUADRATIC_FOR_EDUCATION}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-primary"
              >
                the education plan
              </a>{' '}
              where students, teachers, and researchers get free access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center text-center sm:justify-center">
            <Button onClick={handleClose}>Ok, thanks</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {content}
    </>
  );
}
