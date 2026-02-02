import { ROUTE_LOADER_IDS } from '@/shared/constants/routes';
import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';
import { useRouteLoaderData } from 'react-router';

export type FileRouteLoaderData = ApiTypes['/v0/files/:uuid.GET.response'];

type EmbedLoaderData =
  | { mode: 'file'; fileData: ApiTypes['/v0/files/:uuid.GET.response'] }
  | { mode: 'import'; importUrl: string };

/**
 * Hook to get file route loader data. Returns undefined in embed import mode
 * or when called outside of file/embed routes.
 */
export const useFileRouteLoaderData = (): FileRouteLoaderData | undefined => {
  const fileData = useRouteLoaderData(ROUTE_LOADER_IDS.FILE) as FileRouteLoaderData | undefined;
  const embedData = useRouteLoaderData(ROUTE_LOADER_IDS.EMBED) as EmbedLoaderData | undefined;

  // Return file data if available (regular file route)
  if (fileData) {
    return fileData;
  }

  // In embed mode with a file loaded, extract the file data
  if (embedData && embedData.mode === 'file') {
    return embedData.fileData;
  }

  // In embed import mode or if no data available, return undefined
  return undefined;
};

/**
 * Hook that requires file route loader data to exist. Use in components that
 * are guaranteed to only render in the file route context (not in embed mode).
 * Throws an error if data is not available.
 */
export const useFileRouteLoaderDataRequired = (): FileRouteLoaderData => {
  const data = useFileRouteLoaderData();
  if (!data) {
    throw new Error('useFileRouteLoaderDataRequired must be used in a file route context');
  }
  return data;
};
