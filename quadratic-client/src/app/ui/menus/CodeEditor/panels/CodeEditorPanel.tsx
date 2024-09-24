import { codeEditorLanguageAtom } from '@/app/atoms/codeEditorAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { TooltipHint } from '@/app/ui/components/TooltipHint';
import { PanelPositionBottomIcon, PanelPositionLeftIcon } from '@/app/ui/icons';
import { CodeEditorPanelBottom } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { CodeEditorPanelSide } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelSide';
import { PanelPosition, useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useConnectionSchemaBrowserTableQueryActionInsertQuery } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { useRootRouteLoaderData } from '@/routes/_root';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { cn } from '@/shared/shadcn/utils';
import { IconButton } from '@mui/material';
import * as monaco from 'monaco-editor';
import { MouseEvent, memo, useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';

type CodeEditorPanelProps = {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
  codeEditorRef: React.RefObject<HTMLDivElement>;
};

export const CodeEditorPanel = memo(({ editorInst, codeEditorRef }: CodeEditorPanelProps) => {
  const { isAuthenticated } = useRootRouteLoaderData();
  const {
    userMakingRequest: { teamPermissions },
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const language = useRecoilValue(codeEditorLanguageAtom);
  const connectionInfo = useMemo(() => getConnectionInfo(language), [language]);
  const { panelPosition, setPanelPosition } = useCodeEditorPanelData();

  const changePanelPosition = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      setPanelPosition((prev: PanelPosition) => (prev === 'left' ? 'bottom' : 'left'));
      e.currentTarget.blur();
    },
    [setPanelPosition]
  );

  const { TableQueryAction } = useConnectionSchemaBrowserTableQueryActionInsertQuery({ editorInst });
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

      {panelPosition === 'left' && <CodeEditorPanelSide codeEditorRef={codeEditorRef} schemaBrowser={schemaBrowser} />}
      {panelPosition === 'bottom' && <CodeEditorPanelBottom schemaBrowser={schemaBrowser} />}
    </>
  );
});
