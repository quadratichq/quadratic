import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { CodeEditorPanelBottom } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { CodeEditorPanelSide } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelSide';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useConnectionSchemaBrowserTableQueryActionInsertQuery } from '@/dashboard/hooks/useConnectionSchemaBrowserTableQueryAction';
import { useRootRouteLoaderData } from '@/routes/_root';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import type * as monaco from 'monaco-editor';
import { memo, useMemo } from 'react';
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
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const connectionInfo = useMemo(() => getConnectionInfo(language), [language]);
  const { panelPosition } = useCodeEditorPanelData();

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

  const showAIAssistant = Boolean(isAuthenticated);

  return (
    <>
      {panelPosition === 'left' && (
        <CodeEditorPanelSide
          codeEditorRef={codeEditorRef}
          schemaBrowser={schemaBrowser}
          showAIAssistant={showAIAssistant}
        />
      )}
      {panelPosition === 'bottom' && (
        <CodeEditorPanelBottom schemaBrowser={schemaBrowser} showAIAssistant={showAIAssistant} />
      )}
    </>
  );
});
