import { useDashboardState } from '@/dashboard/components/DashboardProvider';
import { Button } from '@/shared/shadcn/ui/button';

export default function NewFileButton({ isPrivate }: { isPrivate?: boolean }) {
  const [, setDashboardState] = useDashboardState();

  return (
    <Button
      onClick={() => {
        setDashboardState((prev) => ({ ...prev, showNewFileDialog: isPrivate ? 'private' : 'public' }));
      }}
    >
      New file
    </Button>
  );
}
