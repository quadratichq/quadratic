import { useTeamRouteDialog } from '@/dashboard/hooks/useTeamRouteDialog';
import { Dialog, DialogContent } from '@/shared/shadcn/ui/dialog';
import { Outlet } from 'react-router-dom';

export const Component = () => {
  const { open, onClose } = useTeamRouteDialog();

  return open ? (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <Outlet />
      </DialogContent>
    </Dialog>
  ) : null;
};
