/* eslint-disable @typescript-eslint/no-unused-vars */
import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { useCodeEditor } from '../CodeEditorContext';
import { ResizeControl } from './ResizeControl';
import { MIN_PANEL_HEIGHT_PERCENT } from './adjustPercentages';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

const MIN_PANEL_HEIGHT = 0.2;
const MAX_PANEL_HEIGHT = 0.8;

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
  const changeResizeBar = useCallback(
    (e: MouseEvent, first: boolean) => {
      if (!containerRef.current) return;

      e.stopPropagation();
      e.preventDefault();

      const containerRect = containerRef.current.getBoundingClientRect();

      // need to adjust the heights based on hidden content
      let containerHeight = containerRect.height;
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
        } else if (panelHidden[2] && panel2 && panel0) {
          const panel0Rect = panel0.getBoundingClientRect();
          const originalY = panel0Rect.bottom;

          const collapsedHeight = panel2.getBoundingClientRect().height;
          const expandedHeight = (codeEditorPanelData.panelHeightPercentages[2] / 100) * containerHeight;

          // this is the easy case; we can just increase the percentage of the panel by reducing the clientY position
          if (codeEditorPanelData.panelHeightPercentages[2] === MIN_PANEL_HEIGHT_PERCENT) {
            const topPercent = (clientY - containerRect.top) / containerHeight;
            const leftOver = 1 - MIN_PANEL_HEIGHT;
            let top = topPercent * leftOver;
            let middle = (1 - topPercent) * leftOver;
            if (top > MAX_PANEL_HEIGHT) {
              top = MAX_PANEL_HEIGHT;
              middle = leftOver - top;
            } else if (middle < MIN_PANEL_HEIGHT) {
              middle = MIN_PANEL_HEIGHT;
              top = leftOver - middle;
            } else if (top < MIN_PANEL_HEIGHT) {
              top = MIN_PANEL_HEIGHT;
              middle = leftOver - top;
            }

            const panelHeights = [Math.round(top * 100), Math.round(middle * 100), MIN_PANEL_HEIGHT_PERCENT];
            codeEditorPanelData.setPanelHeightPercentages(panelHeights);
            console.log(panelHeights);
          } else return;

          // the percentage height of the cursor relative to the entire container except for the collapsed panel
          // const screenPercentage = (clientY - containerRect.top) / (containerHeight - collapsedHeight);
          // const expandedHeight = (codeEditorPanelData.panelHeightPercentages[2] / 100) * containerHeight;

          // // const percentage = desiredHeight / (containerHeight - panel2.getBoundingClientRect().height);
          // // const expandedHeight = codeEditorPanelData.panelHeightPercentages[2] / 100;

          // // const newValue = ((clientY - containerRect.top) / containerHeight) * 100;
          // // codeEditorPanelData.adjustPanelPercentage(0, newValue);

          // clientY -= panel2.getBoundingClientRect().height;
          // // containerHeight -= panel2.getBoundingClientRect().height;
        }
        // const newValue = ((clientY - containerRect.top) / containerHeight) * 100;
        // codeEditorPanelData.adjustPanelPercentage(0, newValue);
      } else {
        if (panelHidden[0]) {
          const panel0 = containerRef.current.querySelector('#panel-0');
          if (panel0) {
            clientY += panel0.getBoundingClientRect().height;
          }
        }
        console.log('huh???');
        const newValue = (1 - (clientY - containerRect.top) / containerHeight) * 100;
        codeEditorPanelData.adjustPanelPercentage(2, newValue);
      }
    },
    [codeEditorPanelData, containerRef, panelHidden]
  );

  return (
    <div className="relative flex h-full flex-col">
      <PanelBox id="panel-0" title="Console" index={0} codeEditorPanelData={codeEditorPanelData}>
        <Console />
      </PanelBox>
      <ResizeControl
        style={{ position: 'relative' }}
        disabled={firstHidden || (secondHidden && thirdHidden)}
        position="HORIZONTAL"
        setState={(e) => changeResizeBar(e, true)}
      />
      <PanelBox id="panel-1" title="AI Assistant" index={1} codeEditorPanelData={codeEditorPanelData}>
        <AiAssistant />
      </PanelBox>
      {isConnection && (
        <ResizeControl
          style={{ position: 'relative', flexShrink: 0 }}
          disabled={secondHidden && thirdHidden}
          position="HORIZONTAL"
          setState={(e) => changeResizeBar(e, false)}
        />
      )}
      {isConnection && (
        <PanelBox id="panel-2" title="Data browser" index={2} codeEditorPanelData={codeEditorPanelData}>
          <SchemaViewer />
        </PanelBox>
      )}
    </div>
  );
}
