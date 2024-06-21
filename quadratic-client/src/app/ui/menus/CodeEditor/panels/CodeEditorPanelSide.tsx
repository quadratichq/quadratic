import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useRef } from 'react';
import { ImperativePanelGroupHandle, Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import './ResizeControl.css';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

const MIN_SIZE = 20;
const MAX_SIZE = 80;

export function CodeEditorPanelSide(props: Props) {
  const { codeEditorPanelData } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);

  const panelHidden = codeEditorPanelData.panelHidden;
  const firstHidden = panelHidden[0];
  const secondHidden = panelHidden[1];
  const thirdHidden = panelHidden[2];

  const groupApi = useRef<ImperativePanelGroupHandle>(null);

  const ConsolePanel = (
    <PanelBox title="Console" component={<Console />} index={0} codeEditorPanelData={codeEditorPanelData} />
  );

  const AIPanel = (
    <PanelBox title="AI Assistant" component={<AiAssistant />} index={1} codeEditorPanelData={codeEditorPanelData} />
  );

  const DataBrowserPanel = (
    <PanelBox title="Data browser" component={<SchemaViewer />} index={2} codeEditorPanelData={codeEditorPanelData} />
  );

  const resizeHandleClasses = (hidden: boolean): string => {
    if (hidden) {
      return 'bg-slate-200 h-1';
    } else {
      return 'transition ease-in-out delay-150 bg-slate-200 hover:bg-resize h-1';
    }
  };

  return (
    <PanelGroup
      ref={groupApi}
      autoSaveId={`codeEditorSide-${isConnection ? 'connection' : 'normal'}`}
      direction="vertical"
    >
      {firstHidden ? (
        <>{ConsolePanel}</>
      ) : (
        <Panel order={0} id="panel-console" defaultSize={isConnection ? 33 : 50} minSize={MIN_SIZE} maxSize={MAX_SIZE}>
          {ConsolePanel}
        </Panel>
      )}

      <PanelResizeHandle
        disabled={firstHidden && secondHidden}
        className={resizeHandleClasses(firstHidden && secondHidden)}
      />

      {secondHidden ? (
        <>{AIPanel}</>
      ) : (
        <Panel
          order={firstHidden ? 0 : 1}
          id="panel-ai"
          defaultSize={isConnection ? 33 : 50}
          minSize={MIN_SIZE}
          maxSize={MAX_SIZE}
        >
          {AIPanel}
        </Panel>
      )}

      {isConnection && (
        <>
          <PanelResizeHandle
            disabled={secondHidden && thirdHidden}
            className={resizeHandleClasses(secondHidden && thirdHidden)}
          />
          {thirdHidden ? (
            <>{DataBrowserPanel}</>
          ) : (
            <Panel
              order={(firstHidden && !secondHidden) || (!firstHidden && secondHidden) ? 1 : 2}
              id="panel-connection"
              defaultSize={34}
              minSize={MIN_SIZE}
              maxSize={MAX_SIZE}
            >
              <PanelBox
                title="Data browser"
                component={<SchemaViewer />}
                index={2}
                codeEditorPanelData={codeEditorPanelData}
              />
            </Panel>
          )}
        </>
      )}
    </PanelGroup>
  );
}
