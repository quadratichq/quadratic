import getActiveTeam from '@/dashboard/shared/getActiveTeam';
import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import { LoaderFunctionArgs, redirect } from 'react-router-dom';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const prompt = url.searchParams.get('prompt');

  const { teams } = await apiClient.teams.list();
  const { teamUuid } = await getActiveTeam(teams, undefined);

  const redirectUrl = ROUTES.CREATE_FILE(teamUuid, { prompt, private: true });
  return redirect(redirectUrl);
};
