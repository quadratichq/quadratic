import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { useCodeEditor } from '@/app/ui/menus/CodeEditor/CodeEditorContext';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { ResizeControl } from './ResizeControl';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

export function CodeEditorPanelSide(props: Props) {
  const { codeEditorPanelData } = props;
  const { containerRef } = useCodeEditor();
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);

  return (
    <div className="flex h-full flex-col relative">
      <PanelBox
        title="Console"
        component={<Console />}
        index={0}
        codeEditorPanelData={codeEditorPanelData}

      />

      <ResizeControl
        disabled={codeEditorPanelData.panelHidden[0]}
        style={{ position: 'relative' }}
        setState={(mouseEvent) => {
          if (!containerRef.current) return;

          const containerRect = containerRef.current?.getBoundingClientRect();
          const newValue = ((mouseEvent.clientY - containerRect.top) / containerRect.height) * 100;
          codeEditorPanelData.adjustPanelPercentage(0, newValue);
        }}
        position="HORIZONTAL"
      />
      <PanelBox
        title="AI Assistant"
        component={<AiAssistant />}
        index={1}
        codeEditorPanelData={codeEditorPanelData}
      />

      {isConnection && (
        <>
          <ResizeControl
            disabled={codeEditorPanelData.panelHidden[1]}
            style={{ position: 'relative' }}
            setState={(mouseEvent) => {
              if (!containerRef.current) return;

              const containerRect = containerRef.current?.getBoundingClientRect();
              const newValue = ((mouseEvent.clientY - containerRect.top) / containerRect.height) * 100;
              codeEditorPanelData.adjustPanelPercentage(1, newValue);
            }}
            position="HORIZONTAL"
          />
          <PanelBox
            title="Data browser"
            component={<SchemaViewer />}
            index={2}
            codeEditorPanelData={codeEditorPanelData}
          />
        </>
      )}
    </div>
  );
}
