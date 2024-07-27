import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { events } from '@/app/events/events';
import { CodeHint } from '@/app/gridGL/HTMLGrid/CodeHint';
import { CodeRunning } from '@/app/gridGL/HTMLGrid/codeRunning/CodeRunning';
import { HoverCell } from '@/app/gridGL/HTMLGrid/hoverCell/HoverCell';
import { HtmlCells } from '@/app/gridGL/HTMLGrid/htmlCells/HtmlCells';
import { InlineEditor } from '@/app/gridGL/HTMLGrid/inlineEditor/InlineEditor';
import { MultiplayerCursors } from '@/app/gridGL/HTMLGrid/multiplayerCursor/MulitplayerCursors';
import { MultiplayerCellEdits } from '@/app/gridGL/HTMLGrid/multiplayerInput/MultiplayerCellEdits';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';

interface Props {
  parent?: HTMLDivElement;
}

export interface HtmlGridContainerProps {
  leftHeading: number;
  topHeading: number;
}

export const HTMLGridContainer = (props: Props): ReactNode | null => {
  const { parent } = props;

  const [container, setContainer] = useState<HTMLDivElement>();
  const containerRef = useCallback((node: HTMLDivElement) => {
    if (node) setContainer(node);
  }, []);

  const [showInput, setShowInput] = useState(false);
  useEffect(() => {
    const changeInput = (input: boolean) => setShowInput(input);
    events.on('changeInput', changeInput);
    return () => {
      events.off('changeInput', changeInput);
    };
  }, []);

  useEffect(() => {
    if (!container || !parent) return;
    const viewport = pixiApp.viewport;
    const updateTransform = () => {
      viewport.updateTransform();
      let worldTransform = viewport.worldTransform;
      container.style.transform = `matrix(${worldTransform.a}, ${worldTransform.b}, ${worldTransform.c}, ${
        worldTransform.d
      }, ${worldTransform.tx + parent.offsetLeft}, ${worldTransform.ty + parent.offsetTop})`;
    };
    updateTransform();
    viewport.on('moved', updateTransform);
    viewport.on('moved-end', updateTransform);
    viewport.on('zoomed', updateTransform);
    window.addEventListener('resize', updateTransform);
    return () => {
      viewport.off('moved', updateTransform);
      viewport.off('moved-end', updateTransform);
      viewport.off('zoomed', updateTransform);
      window.removeEventListener('resize', updateTransform);
    };
  }, [parent, container]);

  const [topHeading, setTopHeading] = useState(0);
  const [leftHeading, setLeftHeading] = useState(0);
  useEffect(() => {
    const updateHeadingSize = (width: number, height: number) => {
      setLeftHeading(width);
      setTopHeading(height);
    };
    events.on('headingSize', updateHeadingSize);
    return () => {
      events.off('headingSize', updateHeadingSize);
    };
  }, []);

  if (!parent) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftHeading}px`,
        top: `${topHeading}px`,
        overflow: 'hidden',
        width: `calc(100% - ${leftHeading}px)`,
        height: `calc(100% - ${topHeading}px)`,
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            top: `${-topHeading}px`,
            left: `${-leftHeading}px`,
            pointerEvents: 'none',
          }}
        >
          <div style={{ position: 'relative' }}>
            {!showInput && <CodeHint />}
            <MultiplayerCellEdits />
            <InlineEditor />
            <HtmlCells />
            <CodeRunning />
            <HoverCell />
            <MultiplayerCursors topHeading={topHeading} leftHeading={leftHeading} />
          </div>
        </div>
      </div>
    </div>
  );
};
