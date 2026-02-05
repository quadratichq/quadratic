import type { GetConnections } from '@/routes/api.connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useEffect, useMemo, useRef } from 'react';
import { useFetcher } from 'react-router';

// Module-level tracking to prevent N+1 API calls when multiple components
// use this hook simultaneously. Maps teamUuid to whether a fetch is in progress.
const fetchInProgress = new Map<string, boolean>();

/**
 * The data for this accessed in various places in the app (cell type menu,
 * new file dialog, connections menu) and so we centralize storing it, as it can
 * change and therefore requires revalidation as well.
 */
export const useConnectionsFetcher = () => {
  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const fetcher = useFetcher<GetConnections>({ key: 'CONNECTIONS_FETCHER_KEY' });

  // Track if this instance initiated the fetch (to clean up the flag)
  const initiatedFetch = useRef(false);

  // Fetch on the initial use of the hook, but only if the user has permission
  // in the current team. Uses module-level tracking to prevent duplicate fetches
  // when multiple components mount simultaneously.
  const permissionsHasTeamEdit = useMemo(() => teamPermissions?.includes('TEAM_EDIT'), [teamPermissions]);
  useEffect(() => {
    const shouldFetch =
      permissionsHasTeamEdit &&
      fetcher.state === 'idle' &&
      fetcher.data === undefined &&
      !fetchInProgress.get(teamUuid);

    if (shouldFetch) {
      fetchInProgress.set(teamUuid, true);
      initiatedFetch.current = true;
      fetcher.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
    }
  }, [teamUuid, permissionsHasTeamEdit, fetcher]);

  // Clear the fetch-in-progress flag when data arrives or on unmount
  useEffect(() => {
    if (fetcher.data !== undefined && initiatedFetch.current) {
      fetchInProgress.delete(teamUuid);
      initiatedFetch.current = false;
    }
    return () => {
      // Only clear the flag if this instance initiated the fetch AND the fetch
      // has completed (idle state). If still in progress, keep the flag so other
      // components don't trigger duplicate fetches.
      if (initiatedFetch.current && fetcher.state === 'idle') {
        fetchInProgress.delete(teamUuid);
      }
    };
  }, [fetcher.data, fetcher.state, teamUuid]);

  const connections = useMemo(() => (fetcher.data ? fetcher.data.connections : []), [fetcher.data]);
  const staticIps = useMemo(
    () => (fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : []),
    [fetcher.data]
  );
  const isLoading = useMemo(() => fetcher.data === undefined, [fetcher.data]);

  return { connections, staticIps, isLoading };
};
