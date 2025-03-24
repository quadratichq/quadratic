import { events } from '@/app/events/events';
import { Button } from '@/shared/shadcn/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { useEffect, useState } from 'react';

export const Reload = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const changeOpen = () => setOpen(true);
    events.on('coreError', changeOpen);
    return () => {
      events.off('coreError', changeOpen);
    };
  }, []);

  const handleReload = () => {
    window.location.reload();
  };

  if (!open) return null;

  return (
    <Dialog defaultOpen={true} open={true}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quadratic Has Stopped Responding</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Something went wrong. Please reload the application to continue.</p>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleReload}>Reload</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
