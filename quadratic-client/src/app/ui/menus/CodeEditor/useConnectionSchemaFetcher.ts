import { connectionClient } from '@/shared/api/connectionClient';
import { useEffect } from 'react';
import { useFetcher } from 'react-router-dom';

export type SchemaData = Awaited<ReturnType<typeof connectionClient.schemas.get>>;

export const useConnectionSchemaFetcher = ({ uuid, type }: { uuid: string | undefined; type: string | undefined }) => {
  const fetcher = useFetcher<{ ok: boolean; data: SchemaData }>({
    key: uuid ? `SCHEMA_FOR_CONNECTION_${uuid}` : undefined,
  });

  const fetcherUrl = `/api/connections/${uuid}/schema/${type?.toLowerCase()}`;

  useEffect(() => {
    if (fetcher.state === 'idle' && (!fetcher.data || fetcher.data?.ok === false)) {
      console.log('fetching schema data', fetcher);
      fetcher.load(fetcherUrl);
    }
  }, [fetcher, fetcherUrl]);

  return { schemaFetcher: fetcher, reloadSchema: () => fetcher.load(fetcherUrl) };
};
