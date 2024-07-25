import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useRouteLoaderData } from 'react-router-dom';

type FileData = ApiTypes['/v0/files/:uuid.GET.response'];

export const useFileRouteLoaderData = () => useRouteLoaderData(ROUTE_LOADER_IDS.FILE) as FileData;
