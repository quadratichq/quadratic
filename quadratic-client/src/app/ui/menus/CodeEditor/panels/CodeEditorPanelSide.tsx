/* eslint-disable @typescript-eslint/no-unused-vars */
import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/connections/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox, calculatePanelBoxMinimizedSize } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { ResizeControl } from './ResizeControl';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

export function CodeEditorPanelSide(props: Props) {
  const container = document.querySelector('#code-editor-container');
  const minimizedSize = useMemo(() => {
    const minimizedSize = calculatePanelBoxMinimizedSize();
    return minimizedSize;
  }, []);

  const { codeEditorPanelData } = props;
  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);

  const [containerHeight, setContainerHeight] = useState(0);
  useEffect(() => {
    if (container) {
      setContainerHeight(container.getBoundingClientRect().height);
    }
  }, [container]);

  const { panels, adjustedContainerHeight } = useMemo(() => {
    let adjustedContainerHeight = containerHeight;
    for (let i = 0; i < codeEditorPanelData.panelHidden.length; i++) {
      if (codeEditorPanelData.panelHidden[i]) {
        adjustedContainerHeight +=
          (codeEditorPanelData.panelHeightPercentages[i] / 100) * containerHeight - minimizedSize;
      }
    }
    return {
      panels: codeEditorPanelData.panelHidden.map((hidden, i) => {
        const toggleOpen = () => {
          codeEditorPanelData.setPanelHidden((prevState) => prevState.map((val, j) => (i === j ? !val : val)));
        };
        let height: number;
        if (hidden) {
          height = minimizedSize;
        } else {
          height = (codeEditorPanelData.panelHeightPercentages[i] / 100) * adjustedContainerHeight;
        }
        return { open: !hidden, toggleOpen, height };
      }),
      adjustedContainerHeight,
    };
  }, [containerHeight, codeEditorPanelData, minimizedSize]);

  const a = panels[0].height;
  const b = panels[1].height;
  const c = panels[2].height;
  // console.log(a, b, c, a + b + c, containerHeight, minimizedSize);

  // changes resize bar when dragging
  const changeResizeBar = useCallback(
    (e: MouseEvent, first: boolean) => {
      if (!container) return;

      e.stopPropagation();
      e.preventDefault();

      const containerRect = container.getBoundingClientRect();

      // need to adjust the heights based on hidden content
      let containerHeight = containerRect.height;
      let clientY = e.clientY;

      // We need to adjust the percentage based on the size of the hidden panel.
      if (first) {
        if (!panels[2].open) {
          const percent = (clientY - containerRect.top) / adjustedContainerHeight;
          codeEditorPanelData.adjustPanelPercentage(0, percent * 100);
        } else {
          const newValue = ((clientY - containerRect.top) / containerHeight) * 100;
          codeEditorPanelData.adjustPanelPercentage(0, newValue);
        }
      } else {
        if (!panels[0].open) {
          const percent = ((containerRect.bottom - clientY) / adjustedContainerHeight) * 100;
          codeEditorPanelData.adjustPanelPercentage(2, percent);
        } else {
          const newValue = (1 - (clientY - containerRect.top) / containerHeight) * 100;
          codeEditorPanelData.adjustPanelPercentage(2, newValue);
        }
      }
    },
    [adjustedContainerHeight, codeEditorPanelData, container, panels]
  );

  return (
    <div className="h-full">
      <PanelBox
        id="panel-0"
        title="Console"
        open={panels[0].open}
        toggleOpen={panels[0].toggleOpen}
        height={panels[0].height}
      >
        <Console />
      </PanelBox>
      <ResizeControl
        style={{ top: panels[0].height }}
        disabled={!panels[0].open || (!panels[1].open && !panels[2].open)}
        position="HORIZONTAL"
        setState={(e) => changeResizeBar(e, true)}
      />
      <PanelBox
        id="panel-1"
        title="AI Assistant"
        open={panels[1].open}
        toggleOpen={panels[1].toggleOpen}
        height={panels[1].height}
      >
        <AiAssistant />
      </PanelBox>
      {isConnection && panels.length === 3 && (
        <ResizeControl
          style={{ top: panels[0].height + panels[1].height }}
          disabled={!panels[1].open && !panels[2].open}
          position="HORIZONTAL"
          setState={(e) => changeResizeBar(e, false)}
        />
      )}
      {isConnection && (
        <PanelBox
          id="panel-2"
          title="Data browser"
          open={panels[2].open}
          toggleOpen={panels[2].toggleOpen}
          height={panels[2].height}
        >
          <SchemaViewer />
        </PanelBox>
      )}
    </div>
  );
}
