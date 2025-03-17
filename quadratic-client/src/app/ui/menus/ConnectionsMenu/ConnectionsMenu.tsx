import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { Connections } from '@/shared/components/connections/Connections';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export function ConnectionsMenu() {
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const fetcher = useConnectionsFetcher();

  // Fetch when this component mounts but only if the user has permission in the current team
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined && teamPermissions?.includes('TEAM_EDIT')) {
      fetcher.load(`${ROUTES.API.CONNECTIONS}?team-uuid=${teamUuid}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const openEditor = useCallback(
    (language: CodeCellLanguage) => {
      mixpanel.track('[Connections].query', { language });

      const cursor = sheets.sheet.cursor.position;
      setShowConnectionsMenu(false);
      setCodeEditorState((prev) => ({
        ...prev,
        diffEditorContent: undefined,
        waitingForEditorClose: {
          codeCell: {
            sheetId: sheets.current,
            pos: { x: cursor.x, y: cursor.y },
            language,
          },
          showCellTypeMenu: false,
          inlineEditor: false,
          initialCode: '',
        },
      }));
    },
    [setCodeEditorState, setShowConnectionsMenu]
  );

  return (
    <Dialog open={showConnectionsMenu} onOpenChange={() => setShowConnectionsMenu(false)}>
      <DialogContent
        className="max-w-xl"
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Team connections</DialogTitle>
        </DialogHeader>
        {/* Unmount it so we reset the state */}
        {showConnectionsMenu && (
          <Connections
            connections={fetcher.data && fetcher.data.connections ? fetcher.data.connections : []}
            connectionsAreLoading={fetcher.data === undefined}
            teamUuid={teamUuid}
            staticIps={fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : []}
            handleNavigateToDetailsViewOverride={openEditor}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
