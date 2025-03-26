import { apiClient } from '@/shared/api/apiClient';
import { ROUTES } from '@/shared/constants/routes';
import getActiveTeam from '@/shared/utils/getActiveTeam';
import { redirect, type LoaderFunctionArgs } from 'react-router';

export const clientLoader = async ({ params }: LoaderFunctionArgs) => {
  const { teams } = await apiClient.teams.list();
  const { teamUuid } = await getActiveTeam(teams, undefined);
  return redirect(ROUTES.TEAM(teamUuid) + '/' + params['*']);
};
