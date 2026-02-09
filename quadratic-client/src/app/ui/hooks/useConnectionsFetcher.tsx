import type { GetConnections } from '@/routes/api.connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderDataRequired } from '@/shared/hooks/useFileRouteLoaderData';
import { useEffect, useMemo } from 'react';
import { useFetcher } from 'react-router';

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
  } = useFileRouteLoaderDataRequired();
  const fetcher = useFetcher<GetConnections>({ key: 'CONNECTIONS_FETCHER_KEY' });

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

  return { connections, staticIps, isLoading };
};
