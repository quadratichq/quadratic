import { requireAuth } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import { redirect, type LoaderFunctionArgs } from 'react-router';

/**
 * Shortcut route to get to a route for whatever the 'active' team is, e.g.
 *
 * /team/settings -> /teams/:teamUuid/settings
 * /team/connections?initial-connection-type=MYSQL -> /teams/:teamUuid/connections?initial-connection-type=MYSQL
 */
export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  const { activeTeamUuid } = await requireAuth(loaderArgs.request);
  const { params } = loaderArgs;
  const path = params['*'];
  const { search } = new URL(loaderArgs.request.url);
  const newPath = `${ROUTES.TEAM(activeTeamUuid)}/${path}${search}`;
  return redirect(newPath);
};

export const Component = () => {
  return null;
};
