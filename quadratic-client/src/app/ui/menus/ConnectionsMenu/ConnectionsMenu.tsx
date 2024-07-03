import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { focusGrid } from '@/app/helpers/focusGrid';
import { useFileRouteLoaderData } from '@/routes/file.$uuid';
import { useConnectionsState } from '@/routes/teams.$teamUuid.connections';
import { Connections } from '@/shared/components/connections/Connections';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { useEffect } from 'react';
import { useFetcher } from 'react-router-dom';
import { useRecoilState } from 'recoil';

export function ConnectionsMenu() {
  const [editorInteractionState, setEditorInteractionState] = useRecoilState(editorInteractionStateAtom);
  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const [state, setState] = useConnectionsState();

  // FYI: this data is also accessed in the cell type menu and revalidated as
  // data changes based on user interactions.
  const fetcher = useFetcher({ key: 'CONNECTIONS_FETCHER_KEY' });

  // Fetch when this component mounts but only if the user has permission in the current team
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined && teamPermissions?.includes('TEAM_EDIT')) {
      fetcher.load(`/_api/connections?team-uuid=${teamUuid}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      open={editorInteractionState.showConnectionsMenu}
      onOpenChange={() => {
        setState({ ...state, view: { name: 'LIST' } });
        setEditorInteractionState((prev) => ({ ...prev, showConnectionsMenu: false }));
        focusGrid();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Team connections</DialogTitle>
        </DialogHeader>
        <Connections
          connections={fetcher.data && fetcher.data.connections ? fetcher.data.connections : []}
          connectionsAreLoading={fetcher.data === undefined}
          teamUuid={teamUuid}
          staticIps={fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : []}
          state={state}
          setState={setState}
        />
      </DialogContent>
    </Dialog>
  );
}
