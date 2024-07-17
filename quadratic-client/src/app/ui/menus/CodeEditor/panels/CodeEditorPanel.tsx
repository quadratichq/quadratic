import { editorInteractionStateAtom } from '@/app/atoms/editorInteractionStateAtom';
import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useRootRouteLoaderData } from '@/routes/_root';
import { useFileRouteLoaderData } from '@/routes/file.$uuid';
import { memo } from 'react';
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
  } = useFileRouteLoaderData();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);
  const { codeEditorPanelData } = props;
  const { panelPosition } = codeEditorPanelData;

  const showSchemaViewer = Boolean(isAuthenticated && isConnection && teamPermissions?.includes('TEAM_EDIT'));
  const showAiAssistant = Boolean(isAuthenticated);

  return (
    <>
      {panelPosition === 'left' && (
        <CodeEditorPanelSide
          showSchemaViewer={showSchemaViewer}
          showAiAssistant={showAiAssistant}
          codeEditorPanelData={props.codeEditorPanelData}
        />
      )}
      {panelPosition === 'bottom' && (
        <CodeEditorPanelBottom
          showSchemaViewer={showSchemaViewer}
          showAiAssistant={showAiAssistant}
          codeEditorPanelData={props.codeEditorPanelData}
        />
      )}
    </>
  );
});
