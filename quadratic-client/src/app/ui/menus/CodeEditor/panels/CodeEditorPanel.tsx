import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { isEmbed } from '@/app/helpers/isEmbed';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import { CodeEditorPanelBottom } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { CodeEditorPanelSide } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelSide';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useRootRouteLoaderData } from '@/routes/_root';
import {
  ConnectionSchemaBrowser,
  SCHEMA_BROWSER_TABLE_ACTIONS,
  type SchemaBrowserTableActionOnClick,
} from '@/shared/components/connections/ConnectionSchemaBrowser';
import { SaveAndRunIcon } from '@/shared/components/Icons';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import type * as monaco from 'monaco-editor';
import { memo, useMemo } from 'react';
import { useRecoilValue } from 'recoil';

type CodeEditorPanelProps = {
  editorInst: monaco.editor.IStandaloneCodeEditor | null;
  codeEditorRef: React.RefObject<HTMLDivElement | null>;
};

export const CodeEditorPanel = memo(({ editorInst, codeEditorRef }: CodeEditorPanelProps) => {
  const { isAuthenticated } = useRootRouteLoaderData();
  const fileRouteData = useFileRouteLoaderData();
  const teamPermissions = fileRouteData?.userMakingRequest?.teamPermissions;
  const teamUuid = fileRouteData?.team?.uuid;
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const connectionInfo = useMemo(() => getConnectionInfo(language), [language]);
  const { panelPosition } = useCodeEditorPanelData();
  const { saveAndRunCell } = useSaveAndRunCell();

  const handleOnClick = useMemo(
    () =>
      ({ tableQuery }: SchemaBrowserTableActionOnClick) => {
        trackEvent('[ConnectionSchemaBrowser].insertQuery', { language: connectionInfo?.kind });

        if (editorInst) {
          const model = editorInst.getModel();
          if (!model) return;

          const range = model.getFullModelRange();
          editorInst.executeEdits('insert-query', [
            {
              range,
              text: tableQuery,
            },
          ]);

          editorInst.focus();
          saveAndRunCell();
        }
      },
    [connectionInfo?.kind, editorInst, saveAndRunCell]
  );

  const schemaBrowser =
    isAuthenticated && connectionInfo !== undefined && teamUuid && teamPermissions?.includes('TEAM_EDIT') ? (
      <ConnectionSchemaBrowser
        teamUuid={teamUuid}
        type={connectionInfo.kind}
        uuid={connectionInfo.id}
        tableActions={[
          { label: 'Insert & run query in code editor', onClick: handleOnClick, Icon: SaveAndRunIcon },
          SCHEMA_BROWSER_TABLE_ACTIONS.COPY_QUERY,
          SCHEMA_BROWSER_TABLE_ACTIONS.COPY_NAME,
        ]}
        eventSource="app-right-side"
      />
    ) : undefined;

  const showAIAssistant = Boolean(isAuthenticated) && !isEmbed;

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
