import { deriveSyncStateFromConnectionList } from '@/app/atoms/useSyncedConnection';
import type { GetConnections } from '@/routes/api.connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { isSyncedConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useMemo } from 'react';
import { useFetcher } from 'react-router';

const POLL_INTERVAL_MS = 10_000; // 10 seconds

/**
 * The data for this accessed in various places in the app (cell type menu,
 * new file dialog, connections menu) and so we centralize storing it, as it can
 * change and therefore requires revalidation as well.
 *
 * Uses a shared fetcher key so all instances share the same state, which
 * naturally prevents duplicate fetches (fetcher.state won't be 'idle' while
 * a fetch is in progress).
 */
export const useConnectionsFetcher = () => {
  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const fetcher = useFetcher<GetConnections>({ key: 'CONNECTIONS_FETCHER_KEY' });

  // Keep the ref in sync so interval callbacks see the latest fetcher state
  fetcherRef.current = fetcher;

  // Fetch on the initial use of the hook, but only if the user has permission
  // in the current team. The shared fetcher key ensures all instances share
  // state, so the idle check prevents duplicate fetches.
  const permissionsHasTeamEdit = useMemo(() => teamPermissions?.includes('TEAM_EDIT'), [teamPermissions]);
  useEffect(() => {
    if (permissionsHasTeamEdit && fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
    }
  }, [teamUuid, permissionsHasTeamEdit, fetcher]);

  const connections = useMemo(() => (fetcher.data ? fetcher.data.connections : []), [fetcher.data]);
  const staticIps = useMemo(
    () => (fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : []),
    [fetcher.data]
  );
  const isLoading = useMemo(() => fetcher.data === undefined, [fetcher.data]);

  // Poll the list while any synced connection is in a non-terminal state
  // (not_synced or syncing). This keeps sync state fresh across all consumers.
  const hasNonTerminalSyncedConnections = useMemo(
    () =>
      connections.some((c) => {
        if (!isSyncedConnectionType(c.type)) return false;
        const syncState = deriveSyncStateFromConnectionList(c);
        return syncState === 'not_synced' || syncState === 'syncing';
      }),
    [connections]
  );

  useEffect(() => {
    if (!hasNonTerminalSyncedConnections || !permissionsHasTeamEdit) return;

    const interval = setInterval(() => {
      if (fetcherRef.current.state === 'idle') {
        fetcherRef.current.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [hasNonTerminalSyncedConnections, teamUuid, permissionsHasTeamEdit]);

  return { connections, staticIps, isLoading };
};
