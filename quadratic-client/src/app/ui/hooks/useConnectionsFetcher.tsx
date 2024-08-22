import { GetConnections } from '@/routes/api.connections';
import { useFetcher } from 'react-router-dom';

/**
 * The data for this accessed in various places in the app (cell type menu,
 * new file dialog, connections menu) and so we centralize storing it, as it can
 * change and therefore requires revalidation as well.
 */
export const useConnectionsFetcher = () => {
  const connectionsFetcher = useFetcher<GetConnections>({ key: 'CONNECTIONS_FETCHER_KEY' });
  return connectionsFetcher;
};
