// import { apiClient } from '@/shared/api/apiClient';
import { apiClient } from '@/shared/api/apiClient';
import { connectionClient } from '@/shared/api/connectionClient';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { LoaderFunctionArgs, useRouteLoaderData } from 'react-router-dom';

export const useFileMetaRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.FILE_METADATA) as LoaderData;

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { uuid: fileUuid } = params;
  if (!fileUuid) throw new Error('No file UUID provided');

  // TODO: (connections) get this working and split from /file/:uuid for revalidation
  // Also: how will it work for people who don't have an account?
  const connections = await apiClient.connections.list({ fileUuid });
  const staticIps = await connectionClient.staticIps.list();

  return { connections, staticIps };
};
