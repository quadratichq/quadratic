import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { Connections } from '@/shared/components/connections/Connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { useEffect, useMemo, useRef } from 'react';
import { useRecoilState } from 'recoil';

export function ConnectionsMenu() {
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);

  const {
    team: { uuid: teamUuid, sshPublicKey },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const fetcher = useConnectionsFetcher();
  const fetcherRef = useRef(fetcher);

  const permissionsHasTeamEdit = useMemo(() => teamPermissions?.includes('TEAM_EDIT'), [teamPermissions]);

  // Fetch when this component mounts but only if the user has permission in the current team
  useEffect(() => {
    if (fetcherRef.current.state === 'idle' && fetcherRef.current.data === undefined && permissionsHasTeamEdit) {
      fetcherRef.current.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
    }
  }, [permissionsHasTeamEdit, teamUuid]);

  return (
    <Dialog open={showConnectionsMenu} onOpenChange={() => setShowConnectionsMenu(false)}>
      <DialogContent
        className="max-w-4xl"
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1">Manage team connections</DialogTitle>
        </DialogHeader>
        {/* Unmount it so we reset the state */}
        {showConnectionsMenu && (
          <Connections
            connections={fetcher.data && fetcher.data.connections ? fetcher.data.connections : []}
            connectionsAreLoading={fetcher.data === undefined}
            teamUuid={teamUuid}
            sshPublicKey={sshPublicKey}
            staticIps={fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : []}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
