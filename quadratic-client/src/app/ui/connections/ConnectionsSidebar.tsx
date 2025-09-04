import { aiAnalystShowChatHistoryAtom, showAIAnalystAtom } from '@/app/atoms/aiAnalystAtom';
import { presentationModeAtom } from '@/app/atoms/gridSettingsAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { useConnectionsFetcher } from '@/app/ui/hooks/useConnectionsFetcher';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { ConnectionFormCreate, ConnectionFormEdit } from '@/shared/components/connections/ConnectionForm';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { ConnectionsNew } from '@/shared/components/connections/ConnectionsNew';
import { AddIcon, AIIcon, ArrowBackIcon, CloseIcon, EditIcon, SaveAndRunIcon } from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { TooltipPopover } from '@/shared/shadcn/ui/tooltip';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

type ViewState = 'default' | 'new' | 'create' | 'detail' | 'edit';

const teamUuid = '50b9b4e5-e4a8-4723-9c91-e449a9c04ecb';
const connectionUuid = '4109ab5d-7968-45b3-914a-2d375df3a9e4';

export const ConnectionsSidebar = memo(() => {
  const [viewState, setViewState] = useState<ViewState>('default');
  const [showAIAnalyst, setShowAIAnalyst] = useRecoilState(showAIAnalystAtom);
  const presentationMode = useRecoilValue(presentationModeAtom);
  const showChatHistory = useRecoilValue(aiAnalystShowChatHistoryAtom);
  const { connections } = useConnectionsFetcher();

  const aiPanelRef = useRef<HTMLDivElement>(null);

  const { panelWidth, setPanelWidth } = useAIAnalystPanelWidth();

  const handleResize = useCallback(
    (event: MouseEvent) => {
      const panel = aiPanelRef.current;
      if (!panel) return;
      event.stopPropagation();
      event.preventDefault();

      const containerRect = panel.getBoundingClientRect();
      const newPanelWidth = event.x - (containerRect.left - 2);
      setPanelWidth(newPanelWidth);
    },
    [setPanelWidth]
  );

  const handleOnTableQueryAction = useCallback((query: string) => {
    const runQuery = async () => {
      const sheetId = sheets.current;
      const { x, y } = sheets.sheet.cursor.position;

      // Set the code cell value directly without opening the editor
      await quadraticCore.setCodeCellValue({
        sheetId,
        x,
        y,
        codeString: query,
        language: { Connection: { kind: 'MYSQL', id: connectionUuid } },
      });

      // Update the grid to show the code cell
      const tables = pixiApp.cellsSheets.getById(sheetId)?.tables;
      if (tables) {
        if (!tables.isTableAnchor(x, y)) {
          events.emit('updateCodeCells', [
            {
              sheet_id: { id: sheetId },
              pos: { x: BigInt(x), y: BigInt(y) },
              render_code_cell: {
                x,
                y,
                w: 1,
                h: 1,
                language: { Connection: { kind: 'MYSQL', id: connectionUuid } },
                state: 'NotYetRun',
                spill_error: null,
                name: '',
                columns: [],
                first_row_header: false,
                sort: null,
                sort_dirty: false,
                alternating_colors: false,
                is_code: true,
                is_html: false,
                is_html_image: false,
                show_name: false,
                show_columns: false,
                last_modified: BigInt(0),
              },
            },
          ]);
        }
      }
    };
    runQuery();
  }, []);

  if (!showAIAnalyst || presentationMode) {
    return null;
  }

  return (
    <div
      ref={aiPanelRef}
      className="relative hidden h-full shrink-0 overflow-hidden md:block"
      style={{ width: `${panelWidth}px` }}
    >
      <ResizeControl position="VERTICAL" style={{ left: `${panelWidth - 1}px` }} setState={handleResize} />
      <Header viewState={viewState} setViewState={setViewState} setShowAIAnalyst={setShowAIAnalyst} />

      <div
        className={cn(
          'h-full w-full overflow-y-auto',
          showChatHistory ? 'grid grid-rows-[auto_1fr]' : 'grid grid-rows-[auto_1fr_auto]'
        )}
      >
        {viewState === 'default' && (
          <div className="flex flex-col px-2 text-sm">
            {connections.map((connection) => (
              <button
                key={connection.uuid}
                className="flex items-center gap-2 rounded px-2 py-3 hover:bg-accent"
                onClick={() => {
                  console.log('connection', connection);
                  setViewState('detail');
                }}
              >
                <LanguageIcon language={connection.type} />
                {connection.name}
                <span className="ml-auto text-xs text-muted-foreground">{connection.type}</span>
              </button>
            ))}
          </div>
        )}
        {viewState === 'edit' && (
          <div className="flex flex-col px-3">
            <ConnectionFormEdit
              connectionUuid={connectionUuid}
              connectionType={'MYSQL'}
              teamUuid={teamUuid}
              handleNavigateToListView={() => setViewState('detail')}
            />
          </div>
        )}
        {viewState === 'new' && (
          <div className="flex flex-col px-3">
            <ConnectionsNew
              handleNavigateToCreateView={() => setViewState('create')}
              handleNavigateToCreatePotentialView={() => {}}
            />
          </div>
        )}
        {viewState === 'create' && (
          <div className="flex flex-col px-3">
            <ConnectionFormCreate
              teamUuid={'00000000-0000-0000-0000-000000000000'}
              type={'POSTGRES'}
              handleNavigateToListView={() => setViewState('default')}
              handleNavigateToNewView={() => setViewState('new')}
            />
          </div>
        )}
        {viewState === 'detail' && (
          <div className="flex flex-col px-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline">
                <AIIcon className="mr-2" />
                Chat with your data
              </Button>

              <Button variant="outline" onClick={() => setViewState('edit')}>
                <EditIcon className="mr-2" />
                Edit details
              </Button>

              <Button variant="outline" onClick={() => setViewState('delete')}>
                <SaveAndRunIcon className="mr-2" />
                Query with SQL
              </Button>
            </div>

            <div className="-mx-2 pt-4">
              <h2 className="mx-2 text-sm font-medium">Preview</h2>
              <ConnectionSchemaBrowser
                teamUuid={teamUuid}
                type={'MYSQL'}
                uuid={connectionUuid}
                onTableQueryAction={handleOnTableQueryAction}
                TableQueryAction={() => null}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function Header({
  viewState,
  setViewState,
  setShowAIAnalyst,
}: {
  viewState: ViewState;
  setViewState: (viewState: ViewState) => void;
  setShowAIAnalyst: (showAIAnalyst: boolean) => void;
}) {
  return (
    <div className="flex h-12 items-center justify-between px-4">
      <span className="flex items-center text-sm font-bold">
        {viewState !== 'default' && (
          <Button variant="ghost" size="icon-sm" onClick={() => setViewState('default')} className="mr-2">
            <ArrowBackIcon />
          </Button>
        )}{' '}
        Connections
      </span>

      <div className="flex items-center gap-2">
        <TooltipPopover label="New chat">
          <Button
            variant={'ghost'}
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            disabled={false}
            onClick={() => {
              setViewState('new');
            }}
          >
            <AddIcon />
          </Button>
        </TooltipPopover>

        <TooltipPopover label="Close" side="bottom">
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
            disabled={false}
            onClick={() => setShowAIAnalyst(false)}
          >
            <CloseIcon />
          </Button>
        </TooltipPopover>
      </div>
    </div>
  );
}
