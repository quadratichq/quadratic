/* eslint-disable @typescript-eslint/no-unused-vars */
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

  // changes resize bar when dragging
  const changeResizeBar = (e: MouseEvent, first: boolean) => {
    if (!containerRef.current) return;

    e.stopPropagation();
    e.preventDefault();

    const containerRect = containerRef.current.getBoundingClientRect();

    // need to adjust the heights based on hidden content
    const containerHeight = containerRect.height;
    let clientY = e.clientY;

    const panel0 = containerRef.current.querySelector('#panel-0');
    const panel1 = containerRef.current.querySelector('#panel-1');
    const panel2 = containerRef.current.querySelector('#panel-2');

    // We need to adjust the percentage based on the size of the hidden panel.
    if (first) {
      if (panelHidden[1] && panel1) {
        // const collapsedHeight = panel1.getBoundingClientRect().height;
        // const expandedPercent = codeEditorPanelData.panelHeightPercentages[1] / 100;
        // containerHeight -= collapsedHeight;
        // adjustPercent = expandedPercent / 2;
        // clientY += panel1.getBoundingClientRect().height;
      } else if (panelHidden[2] && panel2) {
        // const desiredHeight = clientY - containerRect.top;
        // const percentage = desiredHeight / (containerHeight - panel2.getBoundingClientRect().height);
        // const expandedHeight = codeEditorPanelData.panelHeightPercentages[2] / 100;

        // const newValue = ((clientY - containerRect.top) / containerHeight) * 100;
        // codeEditorPanelData.adjustPanelPercentage(0, newValue);

        // this works when panel2 = min percentage
        clientY -= panel2.getBoundingClientRect().height;
      }
      const newValue = ((clientY - containerRect.top) / containerHeight) * 100;
      codeEditorPanelData.adjustPanelPercentage(0, newValue);
    } else {
      if (panelHidden[0]) {
        const panel0 = containerRef.current.querySelector('#panel-0');
        if (panel0) {
          clientY += panel0.getBoundingClientRect().height;
        }
      }
      const newValue = (1 - (clientY - containerRect.top) / containerHeight) * 100;
      codeEditorPanelData.adjustPanelPercentage(2, newValue);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <PanelBox
        id="panel-0"
        title="Console"
        component={<Console />}
        index={0}
        codeEditorPanelData={codeEditorPanelData}
      />
      <ResizeControl
        style={{ position: 'relative' }}
        disabled={firstHidden || (secondHidden && thirdHidden)}
        position="HORIZONTAL"
        setState={(e) => changeResizeBar(e, true)}
      />
      <PanelBox
        id="panel-1"
        title="AI Assistant"
        component={<AiAssistant />}
        index={1}
        codeEditorPanelData={codeEditorPanelData}
      />
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
          id="panel-2"
          title="Data browser"
          component={<SchemaViewer />}
          index={2}
          codeEditorPanelData={codeEditorPanelData}
        />
      )}
    </div>
  );
}
