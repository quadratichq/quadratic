import type { connectionClient } from '@/shared/api/connectionClient';
import { useCallback, useEffect, useMemo } from 'react';
import { useFetcher } from 'react-router';

type SchemaData = Awaited<ReturnType<typeof connectionClient.schemas.get>>;

/**
 * Anywhere we want to access the data for the connection schema, we use this hook.
 * It uses the connection UUID as the fetcher key, so the data persists on the
 * fetcher across multiple renders and different connections.
 *
 * This is primarily useful when you’re using this inside of the app (for example,
 * the AI assistant needs to know the connection schema).
 *
 * Because it’s used this way, the props can be undefined because in the app
 * we may be dealing with a cell that is not a connection. Or the connection
 * no longer exists, even though it's in the file.
 */
export const useConnectionSchemaBrowser = ({
  type,
  uuid,
  teamUuid,
}: {
  uuid: string | undefined;
  type: string | undefined;
  teamUuid: string | undefined;
}) => {
  const fetcher = useFetcher<{ ok: boolean; data: SchemaData }>({
    key: uuid ? `SCHEMA_FOR_CONNECTION_${uuid}` : undefined,
  });

  const fetcherUrl = useMemo(
    () => (uuid && type ? `/api/teams/${teamUuid}/connections/${uuid}/schema/${type?.toLowerCase()}` : ''),
    [type, uuid, teamUuid]
  );

  useEffect(() => {
    // Don’t bother fetching anything if we don't have the connection
    // (this hook runs on cells like python that aren't connections)
    if (!fetcherUrl) return;

    // Otherwise, fetch the schema data if we don't have it yet
    if (fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(fetcherUrl);
    }
  }, [fetcher, fetcherUrl]);

  // undefined = hasn't loaded yet, null = error, otherwise the data
  const data = useMemo(
    () => (fetcher.data === undefined ? undefined : fetcher.data.ok ? fetcher.data.data : null),
    [fetcher.data]
  );

  const isLoading = useMemo(() => fetcher.state !== 'idle', [fetcher.state]);

  const reloadSchema = useCallback(() => {
    fetcher.load(`${fetcherUrl}?forceCacheRefresh=true`);
  }, [fetcher, fetcherUrl]);

  return {
    data,
    isLoading,
    reloadSchema,
  };
};
