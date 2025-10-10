import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { getConnectionInfo } from '@/app/helpers/codeCellLanguage';
import { useSaveAndRunCell } from '@/app/ui/menus/CodeEditor/hooks/useSaveAndRunCell';
import { CodeEditorPanelBottom } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelBottom';
import { CodeEditorPanelSide } from '@/app/ui/menus/CodeEditor/panels/CodeEditorPanelSide';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useRootRouteLoaderData } from '@/routes/_root';
import { ConnectionSchemaBrowser } from '@/shared/components/connections/ConnectionSchemaBrowser';
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
  const {
    userMakingRequest: { teamPermissions },
    team: { uuid: teamUuid },
  } = useFileRouteLoaderData();
  const { language } = useRecoilValue(codeEditorCodeCellAtom);
  const connectionInfo = useMemo(() => getConnectionInfo(language), [language]);
  const { panelPosition } = useCodeEditorPanelData();
  const { saveAndRunCell } = useSaveAndRunCell();

  const handleOnClick = useMemo(
    () =>
      ({ tableQuery, tableName }: { tableQuery: string; tableName: string }) => {
        trackEvent('[ConnectionSchemaBrowser].insertQuery');

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
    [editorInst, saveAndRunCell]
  );

  const schemaBrowser =
    isAuthenticated && connectionInfo !== undefined && teamPermissions?.includes('TEAM_EDIT') ? (
      <ConnectionSchemaBrowser
        teamUuid={teamUuid}
        type={connectionInfo.kind}
        uuid={connectionInfo.id}
        additionalDropdownItems={[
          { label: 'Insert query in code editor', onClick: handleOnClick, Icon: SaveAndRunIcon },
        ]}
        eventSource="app-right-side"
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
