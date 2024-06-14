import { Dialog, DialogContent } from '@/shared/shadcn/ui/dialog';
import { Outlet, useNavigate } from 'react-router-dom';

export const Component = () => {
  const navigate = useNavigate();

  const onClose = () => {
    navigate(-1);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <Outlet />
      </DialogContent>
    </Dialog>
  );
};
