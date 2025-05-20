import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { Connections } from '@/shared/components/connections/Connections';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export function ConnectionsMenu() {
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();

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

  const setCodeEditorState = useSetRecoilState(codeEditorAtom);
  const openEditor = useCallback(
    (language: CodeCellLanguage) => {
      setShowConnectionsMenu(false);

      const cursor = sheets.sheet.cursor.position;
      const { x, y } = cursor;
      const table = pixiApp.cellsSheet().tables.getTableFromTableCell(x, y);
      const codeCell = table?.codeCell;

      if (codeCell) {
        if (codeCell.language === 'Import') {
          addGlobalSnackbar('Cannot create a connection inside a data table', { severity: 'error' });
        } else {
          addGlobalSnackbar('Cannot create a connection inside a code cell', { severity: 'error' });
        }

        return;
      }

      mixpanel.track('[Connections].query', { language });

      setCodeEditorState((prev) => ({
        ...prev,
        aiAssistant: {
          abortController: undefined,
          loading: false,
          id: '',
          messages: [],
          waitingOnMessageIndex: undefined,
          delaySeconds: 0,
        },
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
    [addGlobalSnackbar, setCodeEditorState, setShowConnectionsMenu]
  );

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
          <DialogTitle className="flex items-center gap-1">Team connections</DialogTitle>
        </DialogHeader>
        {/* Unmount it so we reset the state */}
        {showConnectionsMenu && (
          <Connections
            connections={fetcher.data && fetcher.data.connections ? fetcher.data.connections : []}
            connectionsAreLoading={fetcher.data === undefined}
            teamUuid={teamUuid}
            sshPublicKey={sshPublicKey}
            staticIps={fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : []}
            handleNavigateToDetailsViewOverride={openEditor}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
