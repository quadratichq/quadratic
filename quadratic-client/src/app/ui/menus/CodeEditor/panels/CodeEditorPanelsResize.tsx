import { showAIAnalystAtom } from '@/app/ai/atoms/aiAnalystAtoms';
import { ResizeControl } from '@/app/ui/components/ResizeControl';
import { useAIAnalystPanelWidth } from '@/app/ui/menus/AIAnalyst/hooks/useAIAnalystPanelWidth';
import { getRightPanelsWidth } from '@/app/ui/menus/CodeEditor/panels/getRightPanelsWidth';
import {
  MIN_WIDTH_PANEL,
  MIN_WIDTH_VISIBLE_GRID,
  useCodeEditorPanelData,
} from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import { useAtomValue } from 'jotai';
import { memo, useEffect, useState } from 'react';

const MIN_WIDTH_EDITOR = 350;

interface CodeEditorPanelsResizeProps {
  codeEditorRef: React.RefObject<HTMLDivElement | null>;
}

export const CodeEditorPanels = memo(({ codeEditorRef }: CodeEditorPanelsResizeProps) => {
  const codeEditorPanelData = useCodeEditorPanelData();
  const showAIAnalyst = useAtomValue(showAIAnalystAtom);
  const { panelWidth: aiAnalystPanelWidth } = useAIAnalystPanelWidth();

  // we need to calculate the console height after a change in bottomHidden
  const [consoleHeaderHeight, setConsoleHeaderHeight] = useState(0);

  useEffect(() => {
    const setHeight = () => {
      if (codeEditorPanelData.bottomHidden && codeEditorRef.current) {
        const editor = codeEditorRef.current.firstChild as HTMLDivElement;
        if (editor) {
          const editorRect = editor.getBoundingClientRect();
          setConsoleHeaderHeight(editorRect.height);
        }
      }
    };
    // ensures container is already rendered; otherwise we wait for the next tick
    if (!codeEditorRef.current) {
      setTimeout(setHeight, 0);
    } else {
      setHeight();
    }
  }, [codeEditorPanelData.bottomHidden, codeEditorRef]);

  return (
    <>
      {codeEditorPanelData.panelPosition === 'left' && (
        <>
          {/* left-to-right: outer edge */}
          <ResizeControl
            style={{ left: `0px` }}
            setState={(mouseEvent) => {
              const rightPanelsWidth = getRightPanelsWidth(codeEditorRef);
              const offsetFromRight = window.innerWidth - mouseEvent.x - rightPanelsWidth;
              const min = MIN_WIDTH_PANEL + MIN_WIDTH_EDITOR;
              const max =
                window.innerWidth -
                (showAIAnalyst ? aiAnalystPanelWidth : 0) -
                MIN_WIDTH_VISIBLE_GRID -
                rightPanelsWidth;

              if (offsetFromRight > min && offsetFromRight < max) {
                // change only the editor width
                let newEditorWidth = offsetFromRight - codeEditorPanelData.panelWidth;
                let newPanelWidth: number | undefined;
                if (newEditorWidth < MIN_WIDTH_EDITOR) {
                  newEditorWidth = MIN_WIDTH_EDITOR;
                  newPanelWidth = offsetFromRight - MIN_WIDTH_EDITOR;
                }
                codeEditorPanelData.setEditorWidth(newEditorWidth);
                if (newPanelWidth) {
                  codeEditorPanelData.setPanelWidth(newPanelWidth);
                }
              }
            }}
            position="VERTICAL"
          />
          {/* left-to-right: middle line */}
          <ResizeControl
            style={{ left: `${codeEditorPanelData.panelWidth}px` }}
            setState={(mouseEvent) => {
              const offsetFromRight = window.innerWidth - mouseEvent.x;
              const totalWidth = codeEditorPanelData.editorWidth + codeEditorPanelData.panelWidth;
              const newEditorWidth = Math.max(offsetFromRight, MIN_WIDTH_EDITOR);
              const newPanelWidth = Math.max(totalWidth - newEditorWidth, MIN_WIDTH_PANEL);

              // don't allow resizing if the total width changes
              if (newEditorWidth + newPanelWidth !== totalWidth) return;

              codeEditorPanelData.setEditorWidth(newEditorWidth);
              codeEditorPanelData.setPanelWidth(newPanelWidth);
            }}
            position="VERTICAL"
          />
        </>
      )}

      {codeEditorPanelData.panelPosition === 'bottom' && (
        <>
          {/* top-to-bottom: editor width */}
          <ResizeControl
            style={{ left: '0px' }}
            setState={(mouseEvent) => {
              const rightPanelsWidth = getRightPanelsWidth(codeEditorRef);
              const offsetFromRight = window.innerWidth - mouseEvent.x - rightPanelsWidth;
              const min = MIN_WIDTH_EDITOR;
              const max =
                window.innerWidth -
                (showAIAnalyst ? aiAnalystPanelWidth : 0) -
                MIN_WIDTH_VISIBLE_GRID -
                rightPanelsWidth;
              const newValue = offsetFromRight > max ? max : offsetFromRight < min ? min : offsetFromRight;
              codeEditorPanelData.setEditorWidth(newValue);
            }}
            position="VERTICAL"
          />
          {/* top-to-bottom: height of sections */}
          <ResizeControl
            disabled={codeEditorPanelData.bottomHidden}
            style={{
              top: codeEditorPanelData.bottomHidden
                ? consoleHeaderHeight + 'px'
                : codeEditorPanelData.editorHeightPercentage + '%',
              width: '100%',
            }}
            setState={(mouseEvent) => {
              if (!codeEditorRef.current) return;

              const containerRect = codeEditorRef.current.getBoundingClientRect();
              const newTopHeight = ((mouseEvent.clientY - containerRect.top) / containerRect.height) * 100;

              if (newTopHeight >= 35 && newTopHeight <= 70) {
                codeEditorPanelData.setBottomHidden(false);
                codeEditorPanelData.setEditorHeightPercentage(newTopHeight);
              } else if (newTopHeight > 65) {
                codeEditorPanelData.setBottomHidden(true);
              }
            }}
            position="HORIZONTAL"
          />
        </>
      )}
    </>
  );
});
