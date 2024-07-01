import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useFileRouteLoaderData } from '@/routes/file.$uuid';
import { useConnectionsState } from '@/routes/teams.$teamUuid.connections';
import { Connections } from '@/shared/components/connections/Connections';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { useEffect } from 'react';
import { useFetcher } from 'react-router-dom';
import { useSetRecoilState } from 'recoil';

export function ConnectionsMenu() {
  const setEditorInteractionState = useSetRecoilState(editorInteractionStateAtom);
  const {
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const [state, setState] = useConnectionsState();

  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined) {
      fetcher.load(`/_api/connections?team-uuid=${teamUuid}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // TODO: (connections) handle case where data doesn't load

  return (
    <Dialog
      open={true}
      onOpenChange={() => setEditorInteractionState((prev) => ({ ...prev, showConnectionsMenu: false }))}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Team connections</DialogTitle>
        </DialogHeader>
        <Connections
          connections={fetcher.data ? fetcher.data : []}
          connectionsAreLoading={fetcher.data === undefined}
          teamUuid={teamUuid}
          state={state}
          setState={setState}
        />
      </DialogContent>
    </Dialog>
  );
}
