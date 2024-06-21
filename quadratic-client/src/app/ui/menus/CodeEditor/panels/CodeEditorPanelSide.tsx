import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import './ResizeControl.css';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}


export function CodeEditorPanelSide(props: Props) {
  const { codeEditorPanelData } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);

  const panelHidden = codeEditorPanelData.panelHidden;
  const firstHidden = panelHidden[0];
  const secondHidden = panelHidden[1];
  const thirdHidden = panelHidden[2];

  return (<PanelGroup autoSaveId={`codeEditorSide-${isConnection ? 'connection' : 'normal'}`} direction="vertical">
    <Panel order={0} id="panel-console" defaultSize={isConnection ? 33 : 50} minSize={20} maxSize={80}>
        <PanelBox
          title="Console"
          component={<Console />}
          index={0}
          codeEditorPanelData={codeEditorPanelData}
        />
    </Panel>
    <PanelResizeHandle disabled={firstHidden} className={firstHidden ? "bg-slate-200 h-1" : "transition ease-in-out delay-150 bg-slate-200 hover:bg-resize h-1"} />
    {firstHidden &&
      <PanelBox
        title="AI Assistant"
        component={<AiAssistant />}
        index={1}
        codeEditorPanelData={codeEditorPanelData}
      />
    }
    {!firstHidden &&
      <Panel order={1} id="panel-ai" defaultSize={isConnection ? 33 : 50} minSize={20} maxSize={80}>
      <PanelBox
        title="AI Assistant"
        component={<AiAssistant />}
        index={1}
        codeEditorPanelData={codeEditorPanelData}
      />
      </Panel>
    }
    {isConnection && (<PanelResizeHandle disabled={secondHidden} className={secondHidden ? "bg-slate-200 h-1" : "transition ease-in-out delay-150 bg-slate-200 hover:bg-resize h-1"} />)}
    {(isConnection && thirdHidden) && (
      <PanelBox title="Data browser" component={<SchemaViewer />} index={2} codeEditorPanelData={codeEditorPanelData} />
    )}
    {(isConnection && !thirdHidden) && (
      <Panel order={2} id="panel-connection" defaultSize={34} minSize={20} maxSize={80}>
          <PanelBox
            title="Data browser"
            component={<SchemaViewer />}
            index={2}
            codeEditorPanelData={codeEditorPanelData}
          />
      </Panel>
    )}

  </PanelGroup>);
}
