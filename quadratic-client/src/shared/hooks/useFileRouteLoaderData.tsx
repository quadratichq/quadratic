import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useRouteLoaderData } from 'react-router';

export type FileRouteLoaderData = ApiTypes['/v0/files/:uuid.GET.response'];
export const useFileRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.FILE) as FileRouteLoaderData;
