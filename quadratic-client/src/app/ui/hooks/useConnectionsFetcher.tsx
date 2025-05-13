import type { GetConnections } from '@/routes/api.connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useEffect, useMemo, useRef } from 'react';
import { useFetcher } from 'react-router';

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
  const fetcherRef = useRef(fetcher);

  const connections = fetcher.data ? fetcher.data.connections : [];
  const staticIps = fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : [];

  // Fetch on the initial use of the hook, but only if the user has permission
  // in the current team
  const permissionsHasTeamEdit = useMemo(() => teamPermissions?.includes('TEAM_EDIT'), [teamPermissions]);
  useEffect(() => {
    if (permissionsHasTeamEdit && fetcherRef.current.state === 'idle' && fetcherRef.current.data === undefined) {
      fetcherRef.current.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
    }
  }, [teamUuid, permissionsHasTeamEdit]);

  return { connections, staticIps, isLoading: fetcher.data === undefined };
};
