import { requireAuth } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import { redirect, type LoaderFunctionArgs } from 'react-router-dom';

/**
 * Shortcut route to get to a route for whatever the 'active' team is, e.g.
 *
 * /team/settings -> /teams/:teamUuid/settings
 */
export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  const { activeTeamUuid } = await requireAuth();
  const { params } = loaderArgs;
  return redirect(ROUTES.TEAM(activeTeamUuid) + '/' + params['*']);
};
