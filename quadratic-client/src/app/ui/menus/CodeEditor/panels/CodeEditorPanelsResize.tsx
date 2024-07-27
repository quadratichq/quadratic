import { memo, useEffect, useState } from 'react';

import { ResizeControl } from '@/app/ui/menus/CodeEditor/panels/ResizeControl';
import { useCodeEditorContainer } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorContainer';
import { MIN_WIDTH_PANEL, MIN_WIDTH_VISIBLE_GRID } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';
import type { CodeEditorPanelData } from '@/app/ui/menus/CodeEditor/panels/useCodeEditorPanelData';

interface Props {
  codeEditorPanelData: CodeEditorPanelData;
}

const MIN_WIDTH_EDITOR = 350;

export const CodeEditorPanels = memo((props: Props) => {
  const { codeEditorPanelData } = props;

  // we need to calculate the console height after a change in bottomHidden
  const [consoleHeaderHeight, setConsoleHeaderHeight] = useState(0);

  const container = useCodeEditorContainer();
  useEffect(() => {
    const setHeight = () => {
      if (codeEditorPanelData.bottomHidden && container) {
        const editor = container.firstChild as HTMLDivElement;
        if (editor) {
          const editorRect = editor.getBoundingClientRect();
          setConsoleHeaderHeight(editorRect.height);
        }
      }
    };
    // ensures container is already rendered; otherwise we wait for the next tick
    if (!container) {
      setTimeout(setHeight, 0);
    } else {
      setHeight();
    }
  }, [codeEditorPanelData.bottomHidden, container]);

  return (
    <>
      {codeEditorPanelData.panelPosition === 'left' && (
        <>
          {/* left-to-right: outer edge */}
          <ResizeControl
            style={{ left: `-1px` }}
            setState={(mouseEvent) => {
              const offsetFromRight = window.innerWidth - mouseEvent.x;
              const min = MIN_WIDTH_PANEL + MIN_WIDTH_EDITOR;
              const max = window.innerWidth - MIN_WIDTH_VISIBLE_GRID;

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
            style={{ left: '-1px' }}
            setState={(mouseEvent) => {
              const offsetFromRight = window.innerWidth - mouseEvent.x;
              const min = MIN_WIDTH_EDITOR;
              const max = window.innerWidth - MIN_WIDTH_VISIBLE_GRID;
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
              if (!container) return;

              const containerRect = container.getBoundingClientRect();
              const newTopHeight = ((mouseEvent.clientY - containerRect.top) / containerRect.height) * 100;

              if (newTopHeight >= 25 && newTopHeight <= 75) {
                codeEditorPanelData.setEditorHeightPercentage(newTopHeight);
              }
            }}
            position="HORIZONTAL"
          />
        </>
      )}
    </>
  );
});
