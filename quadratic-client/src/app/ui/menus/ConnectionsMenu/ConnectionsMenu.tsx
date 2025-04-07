import { codeEditorAtom } from '@/app/atoms/codeEditorAtom';
import { editorInteractionStateShowConnectionsMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { Connections } from '@/shared/components/connections/Connections';
import { ConnectionsSidebar } from '@/shared/components/connections/ConnectionsSidebar';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { HelpIcon } from '@/shared/components/Icons';
import { ROUTES } from '@/shared/constants/routes';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { Toggle } from '@/shared/shadcn/ui/toggle';
import mixpanel from 'mixpanel-browser';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export function ConnectionsMenu() {
  const [showConnectionsMenu, setShowConnectionsMenu] = useRecoilState(editorInteractionStateShowConnectionsMenuAtom);
  const { addGlobalSnackbar } = useGlobalSnackbar();

  const {
    team: { uuid: teamUuid },
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const fetcher = useConnectionsFetcher();

  // Fetch when this component mounts but only if the user has permission in the current team
  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data === undefined && teamPermissions?.includes('TEAM_EDIT')) {
      fetcher.load(ROUTES.API.CONNECTIONS.LIST(teamUuid));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [showHelp, setShowHelp] = useState(false);

  return (
    <Dialog open={showConnectionsMenu} onOpenChange={() => setShowConnectionsMenu(false)}>
      <DialogContent
        className="max-w-xl"
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1">
            Team connections
            <Toggle
              size="icon"
              onClick={() => setShowHelp((prev) => !prev)}
              aria-label="Help"
              className="text-muted-foreground"
            >
              <HelpIcon />
            </Toggle>
          </DialogTitle>
        </DialogHeader>
        {showHelp && (
          <>
            <ConnectionsSidebar staticIps={fetcher.data && fetcher.data.staticIps ? fetcher.data.staticIps : []} />
            <hr />
          </>
        )}
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
