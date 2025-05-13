import type { GetConnections, ToggleHideConnectionDemoAction } from '@/routes/api.connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { isJsonObject } from '@/shared/utils/isJsonObject';
import { useEffect, useMemo, useRef } from 'react';
import { useFetcher, useFetchers } from 'react-router';
import { atom, useRecoilState } from 'recoil';

// This is a bit cumbersome, but works given the way <Connections> works on
// both the dashboard and the app. Because the app doesn't revalidate
// data from the router, we have to pickup changes from the router and update
// our client state in the app (that's used across various usages of
// the connectionsFetcher hook).
const hideConnectionDemoAtom = atom<boolean | undefined>({
  key: 'hideConnectionDemoAtom',
  // Will be set on initial run of a `useConnectionsFetcher()` hook
  default: undefined,
});

/**
 * The data for this accessed in various places in the app (cell type menu,
 * new file dialog, connections menu) and so we centralize storing it, as it can
 * change and therefore requires revalidation as well.
 */
export const useConnectionsFetcher = () => {
  const {
    team: {
      uuid: teamUuid,
      clientDataKv: { hideConnectionDemo: initialHideConnectionDemo },
    },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const fetchers = useFetchers();
  const fetcher = useFetcher<GetConnections>({ key: 'CONNECTIONS_FETCHER_KEY' });
  const fetcherRef = useRef(fetcher);
  const [hideConnectionDemo, setHideConnectionDemo] = useRecoilState(hideConnectionDemoAtom);

  // If we pickup a change from the data router, we'll update the state used
  // across various places in the app for displaying connections.
  const demoConnectionToggling = fetchers.filter(
    (fetcher) =>
      isJsonObject(fetcher.json) && fetcher.json.action === 'toggle-hide-connection-demo' && fetcher.state !== 'idle'
  );
  useEffect(() => {
    if (demoConnectionToggling.length) {
      const activeFetcher = demoConnectionToggling.slice(-1)[0];
      const newHideConnectionDemo = (activeFetcher.json as ToggleHideConnectionDemoAction).hideConnectionDemo;
      setHideConnectionDemo(newHideConnectionDemo);
    }
  }, [demoConnectionToggling, hideConnectionDemo, setHideConnectionDemo]);

  let connections = fetcher.data ? fetcher.data.connections : [];
  if (hideConnectionDemo && connections.length > 0) {
    connections = connections.filter((c) => !c.isDemo);
  }
  const staticIps = fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : [];

  // Fetch on the initial use of the hook, but only if the user has permission
  // in the current team
  const permissionsHasTeamEdit = useMemo(() => teamPermissions?.includes('TEAM_EDIT'), [teamPermissions]);
  useEffect(() => {
    if (permissionsHasTeamEdit && fetcherRef.current.state === 'idle' && fetcherRef.current.data === undefined) {
      fetcherRef.current.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
      setHideConnectionDemo(Boolean(initialHideConnectionDemo));
    }
  }, [teamUuid, permissionsHasTeamEdit, initialHideConnectionDemo, setHideConnectionDemo]);

  return { hideConnectionDemo, connections, staticIps, isLoading: fetcher.data === undefined };
};
