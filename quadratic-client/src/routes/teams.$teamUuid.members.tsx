import { useTeamRouteDialog } from '@/dashboard/hooks/useTeamRouteDialog';
import { useTeamRouteLoaderData } from '@/routes/teams.$teamUuid';
import { ShareTeamDialog } from '@/shared/components/ShareDialog';

export const Component = () => {
  const loaderData = useTeamRouteLoaderData();
  const { open, onClose } = useTeamRouteDialog();

  return open ? <ShareTeamDialog data={loaderData} onClose={onClose} /> : null;
};
