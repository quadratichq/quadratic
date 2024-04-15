import { getUpdateUserAction } from '@/routes/user';
import { Button } from '@/shadcn/ui/button';

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shadcn/ui/alert-dialog';
import { SchoolOutlined } from '@mui/icons-material';
import { useEffect } from 'react';
import { useFetcher } from 'react-router-dom';
import { BadgeEdu } from '../../components/BadgeEdu';
import { useGlobalSnackbar } from '../../components/GlobalSnackbarProvider';

export function EducationDialog() {
  const fetcher = useFetcher();
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const handleEnroll = () => {
    const { data, options } = getUpdateUserAction('ENROLLED');
    fetcher.submit(data, options);
  };

  const handleNoThanks = () => {
    const { data, options } = getUpdateUserAction('NOT_ENROLLED');
    fetcher.submit(data, options);
  };

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && !fetcher.data.ok) {
      addGlobalSnackbar('Enrollment failed. Try again.', { severity: 'error' });
    }
  }, [fetcher, addGlobalSnackbar]);

  return (
    <AlertDialog open={true} onOpenChange={handleNoThanks}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader className="text-center sm:text-center">
          <div className="flex flex-col items-center py-4">
            <SchoolOutlined sx={{ fontSize: '64px' }} className="text-primary" />
            <div>
              <BadgeEdu />
            </div>
          </div>
          <AlertDialogTitle>You’re eligible</AlertDialogTitle>
          <AlertDialogDescription>
            Your email address qualifies you for{' '}
            <a href="TODO:" target="_blank" rel="noreferrer" className="underline hover:text-primary">
              Quadratic’s education plan
            </a>
            . By enrolling, you agree to receive future emails about our education plan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="justify-center text-center sm:justify-center">
          <Button variant="outline" onClick={handleNoThanks}>
            No, thanks
          </Button>
          <Button onClick={handleEnroll}>Enroll</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
