/* eslint-disable @typescript-eslint/no-unused-vars */
import { codeCellIsAConnection } from '@/app/helpers/codeCellLanguage';
import { SchemaViewer } from '@/app/ui/components/SchemaViewer';
import { AiAssistant } from '@/app/ui/menus/CodeEditor/AiAssistant';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox, calculatePanelBoxMinimizedSize } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { useCodeEditorContainer } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorContainer';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useFileRouteLoaderData } from '@/shared/hooks/useFileRouteLoaderData';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { editorInteractionStateAtom } from '../../../../atoms/editorInteractionStateAtom';
import { ResizeControl } from './ResizeControl';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
  showSchemaViewer: boolean;
  showAiAssistant: boolean;
}

export function CodeEditorPanelSide({ showSchemaViewer, showAiAssistant, codeEditorPanelData }: Props) {
  const {
    userMakingRequest: { teamPermissions },
  } = useFileRouteLoaderData();
  const container = useCodeEditorContainer();
  const minimizedSize = useMemo(() => {
    const minimizedSize = calculatePanelBoxMinimizedSize();
    return minimizedSize;
  }, []);

  const editorInteractionState = useRecoilValue(editorInteractionStateAtom);
  const isConnection = codeCellIsAConnection(editorInteractionState.mode);

  const [containerHeight, setContainerHeight] = useState(0);
  useEffect(() => {
    if (container) {
      setContainerHeight(container.getBoundingClientRect().height);
    }
  }, [container]);

  const { panels, leftOverPercentage, adjustedContainerHeight } = useMemo(() => {
    let leftOverPercentage = 0;
    let adjustedContainerHeight = containerHeight;

    // ensure containerHeight has a value > 0 to avoid division by zero
    // (sometimes happens when starting with ?state)
    const minimizedPercentage = minimizedSize / (containerHeight ? containerHeight : 1);
    for (let i = 0; i < codeEditorPanelData.panelHidden.length; i++) {
      if (codeEditorPanelData.panelHidden[i]) {
        leftOverPercentage += codeEditorPanelData.panelHeightPercentages[i] / 100 - minimizedPercentage;
        adjustedContainerHeight -= minimizedSize;
      }
    }
    const visiblePanels = codeEditorPanelData.panelHidden.filter((hidden) => !hidden).length;
    return {
      panels: codeEditorPanelData.panelHidden.map((hidden, i) => {
        const toggleOpen = () => {
          codeEditorPanelData.setPanelHidden((prevState) => prevState.map((val, j) => (i === j ? !val : val)));
        };
        let height: number;
        if (hidden) {
          height = minimizedSize;
        } else {
          height =
            (codeEditorPanelData.panelHeightPercentages[i] / 100 +
              (visiblePanels ? leftOverPercentage / visiblePanels : 0)) *
            containerHeight;
        }
        return { open: !hidden, toggleOpen, height };
      }),
      leftOverPercentage,
      adjustedContainerHeight,
    };
  }, [containerHeight, codeEditorPanelData, minimizedSize]);

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
        if (!panels[1].open) {
          const percentOfVisible = (clientY - containerRect.top) / adjustedContainerHeight;
          const percent = (clientY - containerRect.top) / containerHeight - leftOverPercentage * percentOfVisible;
          codeEditorPanelData.adjustPanelPercentage(0, percent * 100);
        }
        if (!panels[2]?.open) {
          const percentOfVisible = (clientY - containerRect.top) / adjustedContainerHeight;
          const percent = (clientY - containerRect.top) / containerHeight - leftOverPercentage * percentOfVisible;
          codeEditorPanelData.adjustPanelPercentage(0, percent * 100);
        } else {
          const percent = ((clientY - containerRect.top) / containerHeight) * 100;
          codeEditorPanelData.adjustPanelPercentage(0, percent);
        }
      } else {
        if (!panels[0].open) {
          const percentOfVisible = (containerRect.bottom - clientY - containerRect.top) / adjustedContainerHeight;
          const percent =
            ((containerRect.bottom - clientY - containerRect.top) / containerHeight) * 100 -
            leftOverPercentage * percentOfVisible;
          codeEditorPanelData.adjustPanelPercentage(2, percent);
        } else {
          const percent = (1 - (clientY - containerRect.top) / containerHeight) * 100;
          codeEditorPanelData.adjustPanelPercentage(2, percent);
        }
      }
    },
    [adjustedContainerHeight, codeEditorPanelData, container, leftOverPercentage, panels]
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
      {showAiAssistant && (
        <>
          <ResizeControl
            style={{ top: panels[0].height }}
            disabled={!panels[0].open || (!panels[1].open && !panels[2]?.open)}
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
        </>
      )}

      {showSchemaViewer && (
        <>
          <ResizeControl
            style={{ top: panels[0].height + panels[1].height }}
            disabled={
              (panels[0].open && panels[1].open && !panels[2].open) ||
              (panels[0].open && !panels[1].open && !panels[2].open) ||
              (!panels[0].open && !panels[1].open)
            }
            position="HORIZONTAL"
            setState={(e) => changeResizeBar(e, false)}
          />
          <PanelBox
            id="panel-2"
            title="Schema"
            open={panels[2].open}
            toggleOpen={panels[2].toggleOpen}
            height={panels[2].height}
          >
            <SchemaViewer />
          </PanelBox>
        </>
      )}
    </div>
  );
}
