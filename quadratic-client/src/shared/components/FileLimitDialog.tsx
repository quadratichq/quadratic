import { closeFileLimitDialog, fileLimitDialogAtom } from '@/shared/atom/fileLimitDialogAtom';
import { showUpgradeDialog } from '@/shared/atom/showUpgradeDialogAtom';
import { WarningIcon } from '@/shared/components/Icons';
import { Alert, AlertDescription, AlertTitle } from '@/shared/shadcn/ui/alert';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useAtom } from 'jotai';
import { useCallback } from 'react';

/**
 * Dialog shown when a user tries to create a file while over the soft file limit.
 * Allows them to either upgrade or create the file anyway (which will make older files read-only).
 */
export function FileLimitDialog() {
  const [state] = useAtom(fileLimitDialogAtom);

  const handleClose = useCallback(() => {
    closeFileLimitDialog();
  }, []);

  const handleUpgrade = useCallback(() => {
    trackEvent('[FileLimitDialog].upgrade');
    closeFileLimitDialog();
    showUpgradeDialog('fileLimitReached');
  }, []);

  const handleCreateAnyway = useCallback(() => {
    trackEvent('[FileLimitDialog].createAnyway');
    if (state.onCreateAnyway) {
      state.onCreateAnyway();
    }
    closeFileLimitDialog();
  }, [state]);

  const maxFiles = state.maxEditableFiles ?? 3;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>You've reached the {maxFiles} file limit</DialogTitle>
          <DialogDescription>
            Free teams can edit up to {maxFiles} files. You can still create this file, but your oldest files will
            become view-only.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <WarningIcon />
          <AlertTitle>What happens if you continue?</AlertTitle>
          <AlertDescription>
            Only your {maxFiles} most recently created files will be editable. Older files will be view-only until you
            upgrade or delete newer files.
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleUpgrade}>
            Upgrade to Pro
          </Button>
          <Button onClick={handleCreateAnyway}>Create anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
