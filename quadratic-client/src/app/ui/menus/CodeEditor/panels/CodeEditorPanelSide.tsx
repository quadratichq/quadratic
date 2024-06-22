import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { ResizeControl } from './ResizeControl';
import { useCodeEditor } from '../CodeEditorContext';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

export function CodeEditorPanelSide(props: Props) {
  const { codeEditorPanelData } = props;
  const { containerRef } = useCodeEditor();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);

  const panelHidden = codeEditorPanelData.panelHidden;
  const firstHidden = panelHidden[0];
  const secondHidden = panelHidden[1];
  const thirdHidden = panelHidden[2];

  const changeResizeBar = (e: MouseEvent, first: boolean) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (first) {
      const newValue = ((e.clientY - containerRect.top) / containerRect.height) * 100;
      codeEditorPanelData.adjustPanelPercentage(0, newValue);
    } else {
      const newValue = ((containerRect.bottom - e.clientY) / containerRect.height) * 100;
      codeEditorPanelData.adjustPanelPercentage(2, newValue);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <PanelBox title="Console" component={<Console />} index={0} codeEditorPanelData={codeEditorPanelData} />
      <ResizeControl
        style={{ position: 'relative' }}
        disabled={(firstHidden && secondHidden) || (secondHidden && thirdHidden)}
        position="HORIZONTAL"
        setState={(e) => changeResizeBar(e, true)}
      />
      <PanelBox title="AI Assistant" component={<AiAssistant />} index={1} codeEditorPanelData={codeEditorPanelData} />
      {isConnection && (
        <ResizeControl
          style={{ position: 'relative', flexShrink: 0 }}
          disabled={secondHidden && thirdHidden}
          position="HORIZONTAL"
          setState={(e) => changeResizeBar(e, false)}
        />
      )}
      {isConnection && (
        <PanelBox
          title="Data browser"
          component={<SchemaViewer />}
          index={2}
          codeEditorPanelData={codeEditorPanelData}
        />
      )}
    </div>
  );
}
