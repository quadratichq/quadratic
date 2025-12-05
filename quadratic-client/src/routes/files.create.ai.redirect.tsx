import { requireAuth } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';

/**
 * Redirect handler for /files/create/ai/* routes.
 * Redirects to /teams/:teamUuid/files/create/ai/* based on the active team.
 */
export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  const { activeTeamUuid } = await requireAuth(loaderArgs.request);
  const url = new URL(loaderArgs.request.url);

  // Extract the path after /files/create/ai
  const pathAfterBase = url.pathname.replace('/files/create/ai', '');

  // Build the new URL preserving any path suffix and search params
  const newPath = ROUTES.TEAM_FILES_CREATE_AI(activeTeamUuid) + pathAfterBase;
  const searchParams = url.search;

  return redirect(newPath + searchParams);
};

export const Component = () => {
  return null;
};
