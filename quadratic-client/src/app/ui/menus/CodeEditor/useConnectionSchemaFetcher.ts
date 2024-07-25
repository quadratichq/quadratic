import { connectionClient } from '@/shared/api/connectionClient';
import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import { useFetcher } from 'react-router-dom';

export type SchemaData = Awaited<ReturnType<typeof connectionClient.schemas.get>>;

/**
 * Anywhere we want to access the data for the connection schema, we use this hook.
 * It uses the connection UUID as the fetcher key, so the data persists on the
 * fetcher across multiple renders and different connections.
 *
 * @param {Object} arg
 * @param {string} arg.uuid - The connection UUID
 * @param {string} arg.type - The connection type
 */
export const useConnectionSchemaFetcher = ({ uuid, type }: { uuid: string | undefined; type: string | undefined }) => {
  const fetcher = useFetcher<{ ok: boolean; data: SchemaData }>({
    key: uuid ? `SCHEMA_FOR_CONNECTION_${uuid}` : undefined,
  });

  const fetcherUrl = uuid && type ? `/api/connections/${uuid}/schema/${type?.toLowerCase()}` : '';

  useEffect(() => {
    // Don’t bother fetching anything if we don't have the connection
    // (this hook runs on cells like python that aren't connections)
    if (!fetcherUrl) return;

    // Otherwise, fetch the schema data if we don't have it yet
    if (fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(fetcherUrl);
    }
  }, [fetcher, fetcherUrl]);

  return {
    schemaFetcher: fetcher,
    reloadSchema: () => {
      mixpanel.track('[Connections].schemaViewer.refresh');
      fetcher.load(fetcherUrl);
    },
  };
};
