import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { Console } from '@/app/ui/menus/CodeEditor/Console';
import { PanelBox, calculatePanelBoxMinimizedSize } from '@/app/ui/menus/CodeEditor/panels/PanelBox';
import { useCodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface CodeEditorPanelSideProps {
  codeEditorRef: React.RefObject<HTMLDivElement>;
  schemaBrowser: React.ReactNode | undefined;
}

export function CodeEditorPanelSide({ codeEditorRef, schemaBrowser }: CodeEditorPanelSideProps) {
  const codeEditorPanelData = useCodeEditorPanelData();
  const minimizedSize = useMemo(() => {
    const minimizedSize = calculatePanelBoxMinimizedSize();
    return minimizedSize;
  }, []);

  const [containerHeight, setContainerHeight] = useState(0);
  useEffect(() => {
    if (codeEditorRef.current) {
      setContainerHeight(codeEditorRef.current.getBoundingClientRect().height);
    }
  }, [codeEditorRef]);

  const panels = useMemo(() => {
    // ensure containerHeight has a value > 0 to avoid division by zero
    // (sometimes happens when starting with ?state)
    const minimizedPercentage = minimizedSize / (containerHeight ? containerHeight : 1);
    let leftOverPercentage = 0;
    for (let i = 0; i < codeEditorPanelData.panelHidden.length; i++) {
      if (codeEditorPanelData.panelHidden[i]) {
        leftOverPercentage += codeEditorPanelData.panelHeightPercentages[i] / 100 - minimizedPercentage;
      }
    }

    const visiblePanels = codeEditorPanelData.panelHidden.filter((hidden) => !hidden).length;
    return codeEditorPanelData.panelHidden.map((hidden, i) => {
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
    });
  }, [codeEditorPanelData, containerHeight, minimizedSize]);

  // changes resize bar when dragging
  const changeResizeBar = useCallback(
    (e: MouseEvent) => {
      if (!codeEditorRef.current) return;

      e.stopPropagation();
      e.preventDefault();

      const containerRect = codeEditorRef.current.getBoundingClientRect();
      let containerHeight = containerRect.height;
      let clientY = e.clientY;

      const percent = (1 - (clientY - containerRect.top) / containerHeight) * 100;
      codeEditorPanelData.adjustPanelPercentage(1, percent);
    },
    [codeEditorPanelData, codeEditorRef]
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
            disabled={!panels[0].open || !panels[1].open}
            position="HORIZONTAL"
            setState={changeResizeBar}
          />
          <PanelBox
            id="panel-1"
            title="Schema"
            open={panels[1].open}
            toggleOpen={panels[1].toggleOpen}
            height={panels[1].height}
          >
            {schemaBrowser}
          </PanelBox>
        </>
      )}
    </div>
  );
}
