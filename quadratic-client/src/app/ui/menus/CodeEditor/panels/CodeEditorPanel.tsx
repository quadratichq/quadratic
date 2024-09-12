import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { PanelPositionBottomIcon, PanelPositionLeftIcon } from '@/app/ui/icons';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { CodeEditorPanelData, PanelPosition } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useConnectionSchemaBrowserTableQueryActionInsertQuery } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { useRootRouteLoaderData } from '@/routes/_root';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { cn } from '@/shared/shadcn/utils';
import { IconButton } from '@mui/material';
import { MouseEvent, memo, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { CodeEditorPanelBottom } from './CodeEditorPanelBottom';
import { CodeEditorPanelSide } from './CodeEditorPanelSide';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

export const CodeEditorPanel = memo((props: Props) => {
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { teamPermissions },
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const { editorRef } = useCodeEditor();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const connectionInfo = getConnectionInfo(editorInteractionState.mode);
  const { codeEditorPanelData } = props;
  const { panelPosition, setPanelPosition } = codeEditorPanelData;

  const changePanelPosition = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
      e.currentTarget.blur();
    },
    [setPanelPosition]
  );

  const { TableQueryAction } = useConnectionSchemaBrowserTableQueryActionInsertQuery({ editorRef });
  const schemaBrowser =
    isAuthenticated && connectionInfo !== undefined && teamPermissions?.includes('TEAM_EDIT') ? (
      <ConnectionSchemaBrowser
        teamUuid={teamUuid}
        type={connectionInfo.kind}
        uuid={connectionInfo.id}
        TableQueryAction={TableQueryAction}
      />
    ) : undefined;

  return (
    <>
      {/* Panel position (left/bottom) control */}
      <div className={cn('absolute z-10', panelPosition === 'bottom' ? 'right-1.5 top-1' : 'right-0.5 top-0.5')}>
        <TooltipHint title={panelPosition === 'bottom' ? 'Move panel left' : 'Move panel bottom'}>
          <IconButton onClick={changePanelPosition} size="small">
            {panelPosition === 'left' ? <PanelPositionBottomIcon /> : <PanelPositionLeftIcon />}
          </IconButton>
        </TooltipHint>
      </div>

      {panelPosition === 'left' && (
        <CodeEditorPanelSide schemaBrowser={schemaBrowser} codeEditorPanelData={props.codeEditorPanelData} />
      )}
      {panelPosition === 'bottom' && (
        <CodeEditorPanelBottom schemaBrowser={schemaBrowser} codeEditorPanelData={props.codeEditorPanelData} />
      )}
    </>
  );
});
