import { useTeamRouteLoaderData } from '@/routes/teams.$teamUuid';
import { ShareTeamDialog } from '@/shared/components/ShareDialog';
import { useNavigate } from 'react-router-dom';

export const Component = () => {
  const navigate = useNavigate();
  const loaderData = useTeamRouteLoaderData();

  return (
    <ShareTeamDialog
      data={loaderData}
      onClose={() => {
        navigate(-1);
      }}
    />
  );
};
