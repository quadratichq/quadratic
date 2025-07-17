import { SpinnerIcon } from '@/shared/components/Icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';

/**
 * Component to render the reload dialog
 */
export const CoreErrorReloadDialog = ({ isReloading }: { isReloading: boolean }) => {
  return (
    <Dialog open={isReloading} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SpinnerIcon className="text-primary" />
            Reloading file data
          </DialogTitle>
          <DialogDescription>A core error occurred. Reloading the file data to resolve the issue...</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
