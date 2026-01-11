import { requireAuth } from '@/auth/auth';
import { ROUTES } from '@/shared/constants/routes';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';

/**
 * Redirect `/files/create/ai` to the active team's prompt page
 */
export const loader = async (loaderArgs: LoaderFunctionArgs) => {
  const { activeTeamUuid } = await requireAuth(loaderArgs.request);
  return redirect(ROUTES.TEAM_FILES_CREATE_AI_PROMPT(activeTeamUuid));
};

export const Component = () => {
  return null;
};
