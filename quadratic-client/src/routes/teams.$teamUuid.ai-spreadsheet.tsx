import { requireAuth } from '@/auth/auth';
import { AiSpreadsheet } from '@/aiSpreadsheet/AiSpreadsheet';
import { apiClient } from '@/shared/api/apiClient';
import { SEARCH_PARAMS } from '@/shared/constants/routes';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import type { LoaderFunctionArgs } from 'react-router';
import { redirect, useLoaderData } from 'react-router';
import { RecoilRoot } from 'recoil';

export interface AiSpreadsheetLoaderData {
  connections: {
    uuid: string;
    name: string;
    type: string;
  }[];
  teamUuid: string;
  teamName: string;
}

export const loader = async (loaderArgs: LoaderFunctionArgs): Promise<AiSpreadsheetLoaderData> => {
  await requireAuth(loaderArgs.request);
  const teamUuid = loaderArgs.params.teamUuid;
  if (!teamUuid) throw new Error('Team UUID is required');

  const teamData = await apiClient.teams.get(teamUuid);

  // Ensure the user has editor permissions
  if (!teamData.userMakingRequest.teamPermissions.includes('TEAM_EDIT')) {
    const message = encodeURIComponent('You need editor permissions to use AI Spreadsheet.');
    throw redirect(`/?${SEARCH_PARAMS.SNACKBAR_MSG.KEY}=${message}`);
  }

  return {
    connections: teamData.connections.map((c) => ({
      uuid: c.uuid,
      name: c.name,
      type: c.type,
    })),
    teamUuid: teamData.team.uuid,
    teamName: teamData.team.name,
  };
};

export const Component = () => {
  useRemoveInitialLoadingUI();
  const loaderData = useLoaderData() as AiSpreadsheetLoaderData;

  return (
    <RecoilRoot>
      <AiSpreadsheet loaderData={loaderData} />
    </RecoilRoot>
  );
};
