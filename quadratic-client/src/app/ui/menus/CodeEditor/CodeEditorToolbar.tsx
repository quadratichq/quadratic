import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { SheetPosTS } from '@/app/gridGL/types/size';
import { getCodeCell, getConnectionUuid } from '@/app/helpers/codeCellLanguage';
import { LanguageIcon } from '@/app/ui/components/LanguageIcon';
import { PanelPositionBottomIcon, PanelPositionLeftIcon } from '@/app/ui/icons';
import { PanelPosition } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { GetConnections } from '@/routes/api.connections';
import { Circle, Close } from '@mui/icons-material';
import { IconButton } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { useFetcher } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../atoms/editorInteractionStateAtom';
import { TooltipHint } from '../../components/TooltipHint';

interface Props {
  cellLocation: SheetPosTS | undefined;
  unsaved: boolean;
  closeEditor: () => void;
  codeEditorPanelData: any; // TODO: fix types
}

export const CodeEditorToolbar = (props: Props) => {
  const { cellLocation, unsaved, closeEditor, codeEditorPanelData } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const [currentSheetId, setCurrentSheetId] = useState<string>(sheets.sheet.id);
  const codeCell = getCodeCell(editorInteractionState.mode);
  const connectionsFetcher = useFetcher<GetConnections>({ key: 'CONNECTIONS_FETCHER_KEY' });

  // Get the connection name (it's possible the user won't have access to it
  // because they're in a file they have access to but not the team — or
  // the connection was deleted)
  let currentConnectionName = '';
  if (connectionsFetcher.data) {
    const connectionUuid = getConnectionUuid(editorInteractionState.mode);
    const foundConnection = connectionsFetcher.data.connections.find(({ uuid }) => uuid === connectionUuid);
    if (foundConnection) currentConnectionName = foundConnection.name;
  }

  // Keep track of the current sheet ID so we know whether to show the sheet name or not
  const currentCodeEditorCellIsNotInActiveSheet = currentSheetId !== editorInteractionState.selectedCellSheet;
  const currentSheetNameOfActiveCodeEditorCell = sheets.getById(editorInteractionState.selectedCellSheet)?.name;
  useEffect(() => {
    const updateSheetName = () => setCurrentSheetId(sheets.sheet.id);
    events.on('changeSheet', updateSheetName);
    return () => {
      events.off('changeSheet', updateSheetName);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { panelPosition, setPanelPosition } = codeEditorPanelData;

  const changePanelPosition = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
      e.currentTarget.blur();
    },
    [setPanelPosition]
  );

  if (!cellLocation) return null;

  return (
    <div className="flex items-center px-2 py-1">
      <div className={`relative`}>
        <TooltipHint title={String(codeCell?.label)} placement="bottom">
          <div className="flex items-center">
            <LanguageIcon language={codeCell?.id} fontSize="small" />
          </div>
        </TooltipHint>
      </div>
      <div className="mx-2 flex flex-col truncate">
        <div className="text-sm font-medium leading-4">
          Cell ({cellLocation.x}, {cellLocation.y})
          {currentCodeEditorCellIsNotInActiveSheet && (
            <span className="ml-1 min-w-0 truncate">- {currentSheetNameOfActiveCodeEditorCell}</span>
          )}
        </div>
        {currentConnectionName && (
          <div className="text-xs leading-4 text-muted-foreground">Connection: {currentConnectionName}</div>
        )}
      </div>
      <div className="ml-auto flex flex-shrink-0 items-center gap-2">
        <TooltipHint title={panelPosition === 'bottom' ? 'Move panel left' : 'Move panel bottom'}>
          <IconButton onClick={changePanelPosition} size="small">
            {panelPosition === 'left' ? (
              <PanelPositionBottomIcon fontSize="small" />
            ) : (
              <PanelPositionLeftIcon fontSize="small" />
            )}
          </IconButton>
        </TooltipHint>

        <TooltipHint title={'Close'} shortcut="ESC" placement="bottom">
          <IconButton
            id="QuadraticCodeEditorCloseButtonID"
            size="small"
            onClick={closeEditor}
            sx={{
              ...(unsaved
                ? {
                    '> #btn-close': {
                      opacity: '0',
                    },
                    '&:hover #btn-close': {
                      opacity: '1',
                    },
                    '&:hover #btn-unsaved': {
                      opacity: '0',
                    },
                  }
                : {}),
            }}
          >
            <Close id="btn-close" fontSize="small" />
            {unsaved && (
              <Circle
                id="btn-unsaved"
                sx={{
                  position: 'absolute',
                  left: '9px',
                  top: '10px',
                  fontSize: '12px',
                }}
              />
            )}
          </IconButton>
        </TooltipHint>
      </div>
    </div>
  );
};
