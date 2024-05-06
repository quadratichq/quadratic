import { apiClient } from '@/shared/api/apiClient';
import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { useRouteLoaderData } from 'react-router-dom';

export const useFileMetaRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.FILE_METADATA) as LoaderData;

type LoaderData = Awaited<ReturnType<typeof loader>>;

export const loader = async () => {
  // TODO: get this working and split from /file/:uuid for revalidation
  const connections = await apiClient.connections.list();
  return { connections };
};
