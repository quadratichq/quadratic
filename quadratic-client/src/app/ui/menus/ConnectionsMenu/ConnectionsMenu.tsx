import { useEffect } from 'react';
import { useFetcher } from 'react-router-dom';
import { useRecoilState } from 'recoil';

import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { Connections } from '@/shared/components/connections/Connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';

export function ConnectionsMenu() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  // FYI: this data is also accessed in the cell type menu and revalidated as
  // data changes based on user interactions.
  const fetcher = useFetcher({ key: 'CONNECTIONS_FETCHER_KEY' });

  // Fetch when this component mounts but only if the user has permission in the current team
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined && teamPermissions?.includes('TEAM_EDIT')) {
      fetcher.load(`${ROUTES.API.CONNECTIONS}?team-uuid=${teamUuid}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      open={editorInteractionState.showConnectionsMenu}
      onOpenChange={() => {
        setEditorInteractionState((prev) => ({ ...prev, showConnectionsMenu: false }));
      }}
    >
      <DialogContent
        className="max-w-4xl"
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Team connections</DialogTitle>
        </DialogHeader>
        {/* Unmount it so we reset the state */}
        {editorInteractionState.showConnectionsMenu && (
          <Connections
            connections={fetcher.data && fetcher.data.connections ? fetcher.data.connections : []}
            connectionsAreLoading={fetcher.data === undefined}
            teamUuid={teamUuid}
            staticIps={fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : []}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
