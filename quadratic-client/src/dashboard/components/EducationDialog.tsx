import { SchoolOutlined } from '@mui/icons-material';
import { Link, useSearchParams } from 'react-router-dom';

import { authClient } from '@/auth';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { useRootRouteLoaderData } from '@/routes/_root';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { CONTACT_URL, QUADRATIC_FOR_EDUCATION } from '@/shared/constants/urls';
import { Badge } from '@/shared/shadcn/ui/badge';
import { Button, buttonVariants } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';

export function EducationDialog() {
  const { loggedInUser } = useRootRouteLoaderData();
  const { eduStatus } = useDashboardRouteLoaderData();
  const [, setSearchParams] = useSearchParams();
  const isEnrolled = eduStatus === 'ENROLLED';

  const handleClose = () => {
    setSearchParams(
      (prev) => {
        prev.delete(SEARCH_PARAMS.DIALOG.KEY);
        return prev;
      },
      { replace: true }
    );
  };

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="text-center sm:text-center">
          <div className="flex flex-col items-center gap-2 py-4">
            <SchoolOutlined sx={{ fontSize: '64px' }} className="text-primary" />
            <Badge variant={isEnrolled ? 'secondary' : 'destructive-secondary'}>
              {isEnrolled ? 'Enrolled' : 'Ineligible'}
            </Badge>
          </div>
          <DialogTitle>Quadratic for education</DialogTitle>
          <DialogDescription className="flex flex-col gap-2">
            Students, teachers, and researchers using a verified school email get free access to Quadratic.
            {!isEnrolled && (
              <span>
                Your account email ({loggedInUser?.email}) does not qualify.{' '}
                <button onClick={() => authClient.logout()} className="underline hover:text-primary">
                  Log in with a different account
                </button>
                . Or, if you believe you qualify,{' '}
                <a href={CONTACT_URL} className="underline hover:text-primary" target="_blank" rel="noreferrer">
                  contact us
                </a>
                .
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="justify-center text-center sm:justify-center">
          <Link to={QUADRATIC_FOR_EDUCATION} target="_blank" className={buttonVariants({ variant: 'outline' })}>
            Learn more
          </Link>
          <Button onClick={handleClose} autoFocus>
            Understood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
