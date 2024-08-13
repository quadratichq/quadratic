import { connectionClient } from '@/shared/api/connectionClient';
import { SchemaBrowser2 } from '@/shared/components/SchemaBrowser';
import mixpanel from 'mixpanel-browser';
import { useEffect } from 'react';
import { useFetcher } from 'react-router-dom';

export type SchemaData = Awaited<ReturnType<typeof connectionClient.schemas.get>>;

/**
 * Anywhere we want to access the data for the connection schema, we use this hook.
 * It uses the connection UUID as the fetcher key, so the data persists on the
 * fetcher across multiple renders and different connections.
 *
 * This is primarily useful when you’re using this inside of the app. But it functions
 * the same way when used in the app.
 *
 * @param {Object} arg
 * @param {string?} arg.uuid - The connection UUID
 * @param {string?} arg.type - The connection type
 */
export const useSchemaBrowser = ({ uuid, type }: { uuid: string | undefined; type: string | undefined }) => {
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

  console.log('ran', uuid, type);

  return {
    // TODO: fix the empty values - how will these work in the app?
    SchemaBrowser: () => (
      <SchemaBrowser2
        connectionType={type || ''}
        fetcher={fetcher}

        // queryButton={}
      />
    ),
    schemaFetcher: fetcher,
    reloadSchema: () => {
      mixpanel.track('[Connections].schemaViewer.refresh');
      fetcher.load(fetcherUrl);
    },
  };
};
