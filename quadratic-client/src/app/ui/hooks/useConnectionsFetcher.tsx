import { deriveSyncStateFromConnectionList } from '@/app/atoms/useSyncedConnection';
import type { GetConnections } from '@/routes/api.connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { isSyncedConnectionType } from 'quadratic-shared/typesAndSchemasConnections';
import { useEffect, useMemo, useRef } from 'react';
import { useFetcher } from 'react-router';

const POLL_INTERVAL_MS = 10_000; // 10 seconds

// Module-level guard to prevent duplicate initial fetches. Multiple components
// call this hook simultaneously on mount, and React batches their effects
// before the shared fetcher state updates from 'idle' to 'loading', so the
// fetcher.state check alone is insufficient.
let initialFetchTriggered = false;

/**
 * The data for this accessed in various places in the app (cell type menu,
 * new file dialog, connections menu) and so we centralize storing it, as it can
 * change and therefore requires revalidation as well.
 *
 * Uses a shared fetcher key so all instances share the same state, with
 * a module-level guard to prevent duplicate fetches when multiple
 * components mount simultaneously.
 */
export const useConnectionsFetcher = () => {
  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const fetcher = useFetcher<GetConnections>({ key: 'CONNECTIONS_FETCHER_KEY' });
  const fetcherRef = useRef(fetcher);

  // Keep the ref in sync so interval callbacks see the latest fetcher state
  fetcherRef.current = fetcher;

  // Fetch on the initial use of the hook, but only if the user has permission
  // in the current team.
  const permissionsHasTeamEdit = useMemo(() => teamPermissions?.includes('TEAM_EDIT'), [teamPermissions]);
  useEffect(() => {
    if (permissionsHasTeamEdit && fetcher.state === 'idle' && fetcher.data === undefined && !initialFetchTriggered) {
      initialFetchTriggered = true;
      fetcher.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
    }
  }, [teamUuid, permissionsHasTeamEdit, fetcher]);

  // Reset the guard once data arrives so future fetches work (e.g., team change)
  useEffect(() => {
    if (fetcher.data !== undefined) {
      initialFetchTriggered = false;
    }
  }, [fetcher.data]);

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
