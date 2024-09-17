import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox, calculatePanelBoxMinimizedSize } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { useCodeEditorContainer } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorContainer';
import { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
  schemaBrowser: React.ReactNode | undefined;
}

export function CodeEditorPanelSide({ schemaBrowser, codeEditorPanelData }: Props) {
  const container = useCodeEditorContainer();
  const minimizedSize = useMemo(() => {
    const minimizedSize = calculatePanelBoxMinimizedSize();
    return minimizedSize;
  }, []);

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
    (e: MouseEvent) => {
      if (!container) return;

      e.stopPropagation();
      e.preventDefault();

      const containerRect = container.getBoundingClientRect();
      let containerHeight = containerRect.height;
      let clientY = e.clientY;

      if (!panels[0].open) {
        const percentOfVisible = (containerRect.bottom - clientY - containerRect.top) / adjustedContainerHeight;
        const percent =
          ((containerRect.bottom - clientY - containerRect.top) / containerHeight) * 100 -
          leftOverPercentage * percentOfVisible;
        codeEditorPanelData.adjustPanelPercentage(1, percent);
      } else {
        const percent = (1 - (clientY - containerRect.top) / containerHeight) * 100;
        codeEditorPanelData.adjustPanelPercentage(1, percent);
      }
    },
    [adjustedContainerHeight, codeEditorPanelData, container, leftOverPercentage, panels]
  );

  return (
    <div className="h-full">
      <PanelBox
        id="panel-0"
        title={<>Console</>}
        open={panels[0].open}
        toggleOpen={panels[0].toggleOpen}
        height={panels[0].height}
      >
        <Console />
      </PanelBox>

      {schemaBrowser && (
        <>
          <ResizeControl
            style={{ top: panels[0].height }}
            disabled={!panels[0].open}
            position="HORIZONTAL"
            setState={changeResizeBar}
          />
          <PanelBox
            id="panel-2"
            title="Schema"
            open={panels[0].open}
            toggleOpen={panels[0].toggleOpen}
            height={panels[0].height}
          >
            {schemaBrowser}
          </PanelBox>
        </>
      )}
    </div>
  );
}
