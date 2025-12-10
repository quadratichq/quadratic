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
          <DialogTitle>Document limit reached</DialogTitle>
          <DialogDescription>Your team has reached the editable document limit for the free plan.</DialogDescription>
        </DialogHeader>

        <Alert variant="warning">
          <WarningIcon />
          <AlertTitle>Over the {maxFiles} document limit</AlertTitle>
          <AlertDescription>
            If you create a document anyway, you'll be able to edit your {maxFiles} most recently created documents and
            the rest will become view-only.
          </AlertDescription>
        </Alert>

        <p className="text-sm text-muted-foreground">
          Upgrade to enjoy unlimited editable documents and more team features.
        </p>

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
