import { useTeamRouteDialog } from '@/dashboard/hooks/useTeamRouteDialog';
import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { ShareTeamDialog } from '@/shared/components/ShareDialog';

export const Component = () => {
  const { activeTeam } = useDashboardRouteLoaderData();
  const { open, onClose } = useTeamRouteDialog();

  return open ? <ShareTeamDialog data={activeTeam} onClose={onClose} /> : null;
};
