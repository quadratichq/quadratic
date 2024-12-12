import { useDashboardRouteLoaderData } from '@/routes/_dashboard';
import { Navigate, useLocation } from 'react-router-dom';

export const Component = () => {
  const {
    activeTeam: {
      team: { uuid },
    },
  } = useDashboardRouteLoaderData();
  const { pathname } = useLocation();
  console.log(pathname);

  return <Navigate to={`/teams/${uuid}/${pathname.slice(1)}`} replace />;
};
